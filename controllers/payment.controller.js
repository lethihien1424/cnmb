// Backend/controllers/payment.controller.js
const { Op } = require("sequelize");
const { Order, Payment, Wallet, WalletTransaction } = require("../models");
const { buildSepayPaymentLookup } = require("../services/sepay.service");

const getWebhookApiKey = (req) => {
  const header =
    req.headers.authorization ||
    req.headers["x-api-key"] ||
    req.headers.apikey ||
    "";

  return String(header).replace(/^Apikey\s+/i, "").trim();
};

const isIncomingTransfer = (payload) => {
  const transferType = String(
    payload?.transferType || payload?.transfer_type || "",
  )
    .trim()
    .toLowerCase();

  return !transferType || transferType === "in" || transferType === "deposit";
};

const getWebhookAmount = (payload) => {
  const raw =
    payload?.transferAmount ??
    payload?.transfer_amount ??
    payload?.amount ??
    payload?.money ??
    0;

  return Number(String(raw).replace(/[^\d.-]/g, ""));
};

const normalizePaidAt = (payload) => {
  const value =
    payload?.transactionDate ||
    payload?.transaction_date ||
    payload?.paidAt ||
    payload?.paid_at;

  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const buildTransactionId = (payload) =>
  String(
    payload?.referenceCode ||
      payload?.reference_code ||
      payload?.id ||
      payload?.transaction_id ||
      "",
  ).trim();

const cleanText = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
};

const firstText = (...values) => {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return null;
};

const buildWebhookPaymentFields = (payment, payload, transactionId) => ({
  transaction_id: transactionId || payment.transaction_id,
  raw_webhook: payload,
  paid_at: normalizePaidAt(payload),

  sender_name: firstText(
    payload.senderName,
    payload.sender_name,
    payload.fromName,
    payload.from_name,
    payload.transferFrom,
    payload.counterAccountName,
    payload.counter_account_name,
    payment.sender_name,
  ),

  sender_bank_name: firstText(
    payload.senderBankName,
    payload.sender_bank_name,
    payload.fromBankName,
    payload.from_bank_name,
    payload.counterBankName,
    payload.counter_bank_name,
    payment.sender_bank_name,
  ),

  sender_account_number: firstText(
    payload.senderAccountNumber,
    payload.sender_account_number,
    payload.fromAccountNumber,
    payload.from_account_number,
    payload.counterAccountNumber,
    payload.counter_account_number,
    payment.sender_account_number,
  ),

  receiver_name: firstText(
    payload.receiverName,
    payload.receiver_name,
    payment.receiver_name,
  ),

  receiver_bank_name: firstText(
    payload.receiverBankName,
    payload.receiver_bank_name,
    payload.gateway,
    payment.receiver_bank_name,
  ),

  receiver_account_number: firstText(
    payload.receiverAccountNumber,
    payload.receiver_account_number,
    payload.accountNumber,
    payload.account_number,
    payment.receiver_account_number,
  ),
});

const findMatchingSepayPayment = async (lookup, amount) => {
  const baseWhere = {
    payment_method: "SEPAY",
    status: { [Op.in]: ["PENDING", "FAILED"] },
  };

  if (lookup) {
    const payment = await Payment.findOne({
      where: {
        ...baseWhere,
        ...lookup,
      },
      order: [["created_at", "DESC"]],
    });

    if (payment) return payment;
  }

  if (amount > 0) {
    const candidates = await Payment.findAll({
      where: {
        ...baseWhere,
        amount,
      },
      order: [["created_at", "DESC"]],
      limit: 2,
    });

    if (candidates.length === 1) return candidates[0];
  }

  return null;
};

const refundCancelledSepayOrderToWallet = async (order, payment, payload) => {
  let wallet = await Wallet.findOne({
    where: { user_id: order.buyer_id },
  });

  if (!wallet) {
    wallet = await Wallet.create({
      user_id: order.buyer_id,
      balance: 0,
    });
  }

  const amount = Number(payment.amount || order.total_amount || 0);

  wallet.balance = Number(wallet.balance) + amount;
  await wallet.save();

  await WalletTransaction.create({
    wallet_id: wallet.id,
    type: "REFUND",
    amount,
    status: "SUCCESS",
    order_id: order.id,
    description: `Hoàn tiền giao dịch SePay đến sau khi hủy đơn #${order.id}`,
  });

  await payment.update({
    status: "REFUNDED",
    ...buildWebhookPaymentFields(payment, payload, buildTransactionId(payload)),
  });

  await order.update({
    payment_status: "REFUNDED",
    order_status: "REFUNDED",
  });
};

const handleWalletTopupWebhook = async (payload, amount) => {
  const content = [
    payload.code,
    payload.content,
    payload.description,
  ]
    .filter(Boolean)
    .map(String)
    .join(" ")
    .toUpperCase();

  if (!content || amount <= 0) return false;

  const pendingTopups = await WalletTransaction.findAll({
    where: {
      type: "TOPUP",
      status: "PENDING",
      amount,
    },
    order: [["created_at", "DESC"]],
    limit: 20,
  });

  const transaction = pendingTopups.find((tx) => {
    const transferContent = String(tx.transfer_content || "").toUpperCase();
    return transferContent && content.includes(transferContent);
  });

  if (!transaction) return false;

  const wallet = await Wallet.findByPk(transaction.wallet_id);

  if (!wallet) {
    transaction.status = "FAILED";
    transaction.description = "Nạp ví thất bại do không tìm thấy ví";
    await transaction.save();
    return true;
  }

  wallet.balance = Number(wallet.balance) + Number(transaction.amount);
  await wallet.save();

  transaction.status = "SUCCESS";
  transaction.paid_at = normalizePaidAt(payload);
  transaction.description = "Nạp tiền vào ví thành công";
  await transaction.save();

  return true;
};
const handleSepayWebhook = async (req, res) => {
  try {
    if (process.env.SEPAY_WEBHOOK_API_KEY) {
      const apiKey = getWebhookApiKey(req);

      if (apiKey !== process.env.SEPAY_WEBHOOK_API_KEY) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }
    }

    const payload = req.body || {};

    if (!isIncomingTransfer(payload)) {
      return res.json({ success: true });
    }

    const lookup = buildSepayPaymentLookup(payload);
    const transactionId = buildTransactionId(payload);
    const amount = getWebhookAmount(payload);

    if (!lookup && amount <= 0) {
      return res.json({ success: true });
    }

    // Ưu tiên xử lý nạp ví trước.
    const handledTopup = await handleWalletTopupWebhook(payload, amount);

if (handledTopup) {
  return res.json({
    success: true,
    message: "Đã xử lý giao dịch nạp ví",
  });
}
    const payment = await findMatchingSepayPayment(lookup, amount);

    if (!payment) {
      return res.json({ success: true });
    }

    const order = await Order.findByPk(payment.order_id);

    if (!order) {
      return res.json({ success: true });
    }

    if (Number(payment.amount) !== amount) {
      await payment.update({
        status: "FAILED",
        ...buildWebhookPaymentFields(payment, payload, transactionId),
      });

      await order.update({
        payment_status: "FAILED",
        order_status: "CANCELLED",
      });

      return res.json({ success: true });
    }

    if (order.order_status === "CANCELLED") {
      await refundCancelledSepayOrderToWallet(order, payment, payload);

      return res.json({ success: true });
    }

    await payment.update({
      status: "PAID",
      ...buildWebhookPaymentFields(payment, payload, transactionId),
    });

    await order.update({
      payment_status: "PAID",
      order_status: "PICKUP",
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Sepay webhook error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getSepayPaymentStatus = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    const payment = await Payment.findByPk(req.params.paymentId, {
      include: [{ model: Order, as: "order" }],
    });

    if (!payment || payment.user_id !== userId) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy giao dịch",
      });
    }

    return res.json({
      success: true,
      data: {
        payment_id: payment.id,
        order_id: payment.order_id,
        payment_status: payment.status,
        paid_at: payment.paid_at,
        transaction_id: payment.transaction_id,

        sender_name: payment.sender_name,
        sender_bank_name: payment.sender_bank_name,
        sender_account_number: payment.sender_account_number,

        receiver_name: payment.receiver_name,
        receiver_bank_name: payment.receiver_bank_name,
        receiver_account_number: payment.receiver_account_number,

        order: payment.order
          ? {
              id: payment.order.id,
              payment_status: payment.order.payment_status,
              order_status: payment.order.order_status,
              total_amount: payment.order.total_amount,
            }
          : null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  handleSepayWebhook,
  getSepayPaymentStatus,
};