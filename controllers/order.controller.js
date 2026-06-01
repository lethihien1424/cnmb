// Backend/controllers/order.controller.js
const { Sequelize } = require("sequelize");
const orderService = require("../services/order.service");
const { Payment } = require("../models");
const {
  buildSepayTransferContent,
  buildSepayQrUrl,
} = require("../services/sepay.service");

// ── Helper: build response sau khi tạo order ────────────────────────────────
const buildOrderResponse = async (res, orders, paymentMethod, userId) => {
  paymentMethod = String(paymentMethod || "COD").toUpperCase();

  if (paymentMethod === "SEPAY") {
    const payments = [];

    for (const order of orders) {
      const transferContent = buildSepayTransferContent(order.id);

      const qrUrl = buildSepayQrUrl({
        amount: order.total_amount,
        transferContent,
      });

    
      const payment = await Payment.create({
  order_id: order.id,
  user_id: userId,
  payment_method: "SEPAY",
  amount: order.total_amount,
  status: "PENDING",
  transfer_content: transferContent,

  // dùng giờ của PostgreSQL, tránh lệch timezone Node/Postgres
  expires_at: Sequelize.literal("NOW() + INTERVAL '15 minutes'"),

  receiver_name: process.env.SEPAY_ACCOUNT_NAME || null,
  receiver_bank_name: process.env.SEPAY_BANK_CODE || null,
  receiver_account_number: process.env.SEPAY_ACCOUNT_NUMBER || null,
});

await payment.reload();

      payments.push({
        payment_id: payment.id,
        order_id: order.id,
        amount: Number(order.total_amount),
        transfer_content: transferContent,
        qr_url: qrUrl,
        expires_at: payment.expires_at,
        receiver_name: payment.receiver_name,
        receiver_bank_name: payment.receiver_bank_name,
        receiver_account_number: payment.receiver_account_number,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Đặt hàng thành công, vui lòng quét QR để thanh toán",
      payment_method: "SEPAY",
      data: orders,
      payments,
    });
  }

  return res.status(201).json({
    success: true,
    message: "Đặt hàng thành công",
    data: orders,
    shipping_summary: orders.map((o) => ({
      order_id: o.id,
      shipping_fee: o.shipping_fee,
      distance_km: o.distance_km,
      estimated_delivery_time: o.estimated_delivery_time,
    })),
  });
};
// ── CREATE ORDER FROM CART ───────────────────────────────────────────────────
const createFromCart = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const {
      selected_items,
      payment_method,
      address_id,
      shipping_service_type = "STANDARD",
      platform_voucher_id,
      shop_voucher_id,
    } = req.body;
    const orders = await orderService.createOrderFromCart(
      userId,
      selected_items,
      payment_method,
      address_id,
      shipping_service_type,
      platform_voucher_id,
      shop_voucher_id,
    );
    return await buildOrderResponse(res, orders, payment_method, userId);
  } catch (error) {
    console.error("createFromCart error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

// ── BUY NOW ──────────────────────────────────────────────────────────────────
const buyNow = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const {
      quantity,
      payment_method,
      address_id,
      shipping_service_type = "STANDARD",
      size = null,
      color = null,
      platform_voucher_id,
      shop_voucher_id,
    } = req.body;

    // Đọc product_id linh hoạt (đề phòng FE gửi 'id' hoặc 'productId')
    const product_id = req.body.product_id || req.body.productId || req.body.id;

    // Validate chi tiết
    if (!address_id) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu address_id" });
    }
    if (!product_id || !quantity) {
      console.log("Dữ liệu FE gửi lên bị sai format:", req.body);
      return res.status(400).json({
        success: false,
        message: "product_id hoặc quantity không hợp lệ",
        received: { product_id, quantity },
      });
    }

    const orders = await orderService.buyNow(
      userId,
      product_id,
      quantity,
      payment_method,
      address_id,
      shipping_service_type,
      size,
      color,
      platform_voucher_id,
      shop_voucher_id,
    );
    return await buildOrderResponse(res, orders, payment_method, userId);
  } catch (error) {
    console.error("buyNow error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};
const linkWalletBankAccount = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    const wallet = await orderService.linkWalletBankAccount(userId, req.body);

    return res.json({
      success: true,
      message: "Liên kết tài khoản ngân hàng thành công",
      data: wallet,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const createWalletTopup = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    const result = await orderService.createWalletTopup(
      userId,
      req.body.amount
    );

    return res.status(201).json({
      success: true,
      message: "Tạo mã QR nạp ví thành công",
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getWalletTopupStatus = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    const result = await orderService.getWalletTopupStatus(
      userId,
      req.params.transactionId
    );

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const createWalletWithdraw = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    const result = await orderService.createWalletWithdraw(
      userId,
      req.body.amount
    );

    return res.status(201).json({
      success: true,
      message: "Đã tạo yêu cầu rút tiền, vui lòng chờ admin xử lý",
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
// ── GET MY ORDERS ────────────────────────────────────────────────────────────
const getMyOrders = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const orders = await orderService.getOrdersByUser(userId);
    return res.json({ success: true, data: orders });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET STORE ORDERS ─────────────────────────────────────────────────────────
const getStoreOrders = async (req, res) => {
  try {
    const storeId = req.params.storeId;
    const orders = await orderService.getOrdersByStore(storeId);
    return res.json({ success: true, data: orders });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET ORDER DETAIL ─────────────────────────────────────────────────────────
const getOrderDetail = async (req, res) => {
  try {
    const order = await orderService.getOrderById(req.params.id);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    return res.json({ success: true, data: order });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── UPDATE ORDER STATUS ──────────────────────────────────────────────────────
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await orderService.updateOrderStatus(req.params.id, status);

    // Hoàn kho khi đơn hàng bị hủy
    if (status === "CANCELLED" || status === "REFUNDED") {
      await orderService.refundOrderStock(req.params.id);
    }

    return res.json({
      success: true,
      message: "Cập nhật trạng thái thành công",
      data: order,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// ── CANCEL ORDER (CUSTOMER hoặc STORE) ───────────────────────────────────────
// Body: { cancel_reason: string, cancelled_by: 'CUSTOMER' | 'STORE' }
const cancelOrder = async (req, res) => {
  try {
    console.log("CANCEL BODY:", req.body);
    console.log("CANCEL PARAMS:", req.params);
    console.log("CANCEL USER:", req.user);
    const { cancel_reason, cancelled_by } = req.body;
    const order = await orderService.cancelOrder(
      req.params.id,
      cancelled_by,
      cancel_reason,
    );

    // Hoàn kho khi đơn hàng bị hủy (CANCELLED hoặc REFUNDED)
    if (
      order.order_status === "CANCELLED" ||
      order.order_status === "REFUNDED"
    ) {
      await orderService.refundOrderStock(req.params.id);
    }

    return res.json({
      success: true,
      message:
        order.order_status === "REFUNDED"
          ? "Đã hủy đơn và hoàn tiền vào ví"
          : "Đã hủy đơn hàng",
      data: order,
    });
  } catch (error) {
    console.error("CANCEL ERROR:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

// ── DELETE ORDER (legacy) ────────────────────────────────────────────────────
const deleteOrder = async (req, res) => {
  try {
    await orderService.deleteOrder(req.params.id);
    return res.json({ success: true, message: "Đã xóa đơn hàng" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// ── GET MY WALLET ────────────────────────────────────────────────────────────
const getMyWallet = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { wallet, transactions } = await orderService.getWallet(userId);
    return res.json({ success: true, data: { wallet, transactions } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createFromCart,
  buyNow,
  getMyOrders,
  getStoreOrders,
  getOrderDetail,
  updateOrderStatus,
  cancelOrder,
  deleteOrder,
  getMyWallet,

  linkWalletBankAccount,
  createWalletTopup,
  getWalletTopupStatus,
  createWalletWithdraw,
};
