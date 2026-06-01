// Backend/services/payment.service.js

const { Op } = require("sequelize");
const { Order, Payment } = require("../models");
const { buildSepayQrUrl } = require("./sepay.service");

const normalizeSepayText = (value) => String(value || "").trim();

const getSepayTransferAmount = (payload) =>
  Number(
    payload.transferAmount ||
      payload.transfer_amount ||
      payload.amount ||
      payload.money ||
      payload.value ||
      0,
  );

const getSepayTransactionId = (payload) =>
  normalizeSepayText(
    payload.referenceCode ||
      payload.reference_code ||
      payload.transaction_id ||
      payload.transactionId ||
      payload.id ||
      payload.code,
  );

const getSepayPaidAt = (payload) => {
  const raw =
    payload.transactionDate ||
    payload.transaction_date ||
    payload.paid_at ||
    payload.created_at;

  const date = raw ? new Date(raw) : new Date();

  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const getSenderName = (payload) =>
  normalizeSepayText(
    payload.senderName ||
      payload.sender_name ||
      payload.corresponsiveName ||
      payload.corresponsive_name ||
      payload.accountName ||
      payload.account_name ||
      payload.subAccountName ||
      payload.sub_account_name,
  );

const getSenderBankName = (payload) =>
  normalizeSepayText(
    payload.senderBankName ||
      payload.sender_bank_name ||
      payload.bankName ||
      payload.bank_name ||
      payload.gateway ||
      payload.bank ||
      payload.corresponsiveBank ||
      payload.corresponsive_bank,
  );

const getSenderAccountNumber = (payload) =>
  normalizeSepayText(
    payload.senderAccountNumber ||
      payload.sender_account_number ||
      payload.corresponsiveAccount ||
      payload.corresponsive_account ||
      payload.accountNumber ||
      payload.account_number ||
      payload.subAccountNumber ||
      payload.sub_account_number,
  );

const expirePaymentIfNeeded = async (payment) => {
  if (!payment) return null;

  if (payment.status !== "PENDING") {
    return payment;
  }

  if (!payment.expires_at) {
    return payment;
  }

  const now = new Date();
  const expiredAt = new Date(payment.expires_at);

  if (now <= expiredAt) {
    return payment;
  }

  payment.status = "EXPIRED";
  await payment.save();

  const order = payment.order || (await Order.findByPk(payment.order_id));

  if (
    order &&
    order.payment_method === "SEPAY" &&
    order.payment_status === "UNPAID" &&
    order.order_status === "PENDING"
  ) {
    order.payment_status = "FAILED";
    order.order_status = "CANCELLED";
    order.cancelled_by_role = "SYSTEM";
    order.cancel_reason = "PAYMENT_TIMEOUT";
    order.cancelled_at = new Date();

    await order.save();
  }

  return payment;
};

const handleSepayWebhook = async (payload) => {
  const content = normalizeSepayText(
    payload.content ||
      payload.description ||
      payload.transferContent ||
      payload.transfer_content,
  );

  const description = normalizeSepayText(payload.description);

  const transferText = `${content} ${description}`.trim();

  const transferAmount = getSepayTransferAmount(payload);

  if (!transferText) {
    throw new Error("Webhook SePay thiếu nội dung chuyển khoản");
  }

  const pendingPayments = await Payment.findAll({
    where: {
      payment_method: "SEPAY",
      status: {
        [Op.ne]: "PAID",
      },
      transfer_content: {
        [Op.ne]: null,
      },
    },
    include: [
      {
        model: Order,
        as: "order",
      },
    ],
    order: [["created_at", "DESC"]],
  });

  const matchedPayment = pendingPayments.find((candidate) =>
    transferText.includes(String(candidate.transfer_content || "")),
  );

  if (!matchedPayment) {
    throw new Error("Không tìm thấy payment SePay phù hợp");
  }

  await expirePaymentIfNeeded(matchedPayment);

  if (matchedPayment.status === "EXPIRED") {
    throw new Error("QR thanh toán đã hết hạn");
  }

  if (transferAmount > 0 && transferAmount !== Number(matchedPayment.amount)) {
    throw new Error("Số tiền chuyển khoản không khớp với đơn hàng");
  }

  const senderName = getSenderName(payload);
  const senderBankName = getSenderBankName(payload);
  const senderAccountNumber = getSenderAccountNumber(payload);

  matchedPayment.status = "PAID";
  matchedPayment.transaction_id = getSepayTransactionId(payload) || null;

  matchedPayment.sender_name =
    senderName || matchedPayment.sender_name || null;

  matchedPayment.sender_bank_name =
    senderBankName || matchedPayment.sender_bank_name || null;

  matchedPayment.sender_account_number =
    senderAccountNumber || matchedPayment.sender_account_number || null;

  matchedPayment.paid_at = getSepayPaidAt(payload);
  matchedPayment.raw_webhook = payload;

  await matchedPayment.save();

  const order =
    matchedPayment.order || (await Order.findByPk(matchedPayment.order_id));

  if (order && order.payment_status !== "PAID") {
    order.payment_status = "PAID";
    order.order_status = "PICKUP";

    await order.save();
  }

  return {
    payment: matchedPayment,
    order,
  };
};

const getPaymentStatus = async (paymentId, userId) => {
  let payment = await Payment.findOne({
    where: {
      id: paymentId,
      user_id: userId,
    },
    include: [
      {
        model: Order,
        as: "order",
      },
    ],
  });

  if (!payment) {
    throw new Error("Không tìm thấy giao dịch thanh toán");
  }

  payment = await expirePaymentIfNeeded(payment);

  const order = payment.order || (await Order.findByPk(payment.order_id));

  return {
    payment_id: payment.id,
    order_id: payment.order_id,
    status: payment.status,
    amount: Number(payment.amount),
    payment_method: payment.payment_method,
    transfer_content: payment.transfer_content,
    paid_at: payment.paid_at,
    transaction_id: payment.transaction_id,
    expires_at: payment.expires_at,

    sender_name: payment.sender_name,
    sender_bank_name: payment.sender_bank_name,
    sender_account_number: payment.sender_account_number,

    order: order
      ? {
          id: order.id,
          order_status: order.order_status,
          payment_status: order.payment_status,
          total_amount: Number(order.total_amount),
        }
      : null,
  };
};

const getSepayQrByOrder = async (orderId, userId) => {
  const order = await Order.findOne({
    where: {
      id: orderId,
      buyer_id: userId,
      payment_method: "SEPAY",
    },
  });

  if (!order) {
    throw new Error("Không tìm thấy đơn hàng SePay");
  }

  if (order.payment_status === "PAID") {
    throw new Error("Đơn hàng đã thanh toán");
  }

  if (order.order_status !== "PENDING") {
    throw new Error("Đơn hàng không còn ở trạng thái chờ thanh toán");
  }

  let payment = await Payment.findOne({
    where: {
      order_id: order.id,
      user_id: userId,
      payment_method: "SEPAY",
      status: "PENDING",
    },
    order: [["created_at", "DESC"]],
  });

  if (!payment) {
    throw new Error("Không tìm thấy giao dịch thanh toán đang chờ");
  }

  payment = await expirePaymentIfNeeded(payment);

  if (payment.status === "EXPIRED") {
    throw new Error("QR thanh toán đã hết hạn");
  }

  const qrUrl = buildSepayQrUrl({
    amount: payment.amount,
    transferContent: payment.transfer_content,
  });

  return {
    payment_id: payment.id,
    order_id: order.id,
    amount: Number(payment.amount),
    transfer_content: payment.transfer_content,
    qr_url: qrUrl,
    expires_at: payment.expires_at,
  };
};

module.exports = {
  handleSepayWebhook,
  getPaymentStatus,
  getSepayQrByOrder,
};