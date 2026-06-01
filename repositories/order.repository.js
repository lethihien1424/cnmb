// repositories/order.repository.js
const { Op } = require("sequelize");
const {
  Order,
  OrderDetail,
  Product,
  Review,
  Wallet,
  WalletTransaction,
  User,
  Payment,
} = require("../models");

const createOrder = async (data) => Order.create(data);

const createOrderItem = async (data) => OrderDetail.create(data);

// ─── Helper: gắn is_reviewed vào mỗi order ───────────────────────────────────
const attachReviewStatus = async (orders) => {
  const orderIds = orders.map((o) => o.id);
  if (orderIds.length === 0) return orders;

  const reviews = await Review.findAll({
    where: { order_id: orderIds },
    attributes: ["order_id"],
  });

  const reviewedOrderIds = new Set(reviews.map((r) => r.order_id));

  return orders.map((order) => {
    const o = order.toJSON ? order.toJSON() : { ...order };
    o.is_reviewed = reviewedOrderIds.has(o.id);
    return o;
  });
};

// ─── getOrdersByUser ──────────────────────────────────────────────────────────
const getOrdersByUser = async (userId) => {
  const orders = await Order.findAll({
    where: { buyer_id: userId },
    include: [
      {
        model: OrderDetail,
        as: "items",
        include: [{ model: Product, as: "product", paranoid: false }],
      },
      { model: Payment, as: "payments" },
    ],
    order: [["created_at", "DESC"]],
  });

  return await attachReviewStatus(orders);
};

// ─── getOrdersByStore ─────────────────────────────────────────────────────────
const getOrdersByStore = async (storeId) => {
  const orders = await Order.findAll({
    where: { store_id: storeId },
    include: [
      {
        model: OrderDetail,
        as: "items",
        include: [{ model: Product, as: "product", paranoid: false }],
      },
      { model: Payment, as: "payments" },
    ],
    order: [["created_at", "DESC"]],
  });

  return await attachReviewStatus(orders);
};

// ─── getOrderById ─────────────────────────────────────────────────────────────
const getOrderById = async (id) => {
  const order = await Order.findByPk(id, {
    include: [
      {
        model: OrderDetail,
        as: "items",
        include: [{ model: Product, as: "product", paranoid: false }],
      },
      { model: Payment, as: "payments" },
    ],
  });

  if (!order) return null;

  const [withStatus] = await attachReviewStatus([order]);
  return withStatus;
};

// ─── updateOrderStatus ────────────────────────────────────────────────────────
const updateOrderStatus = async (orderId, status) => {
  const order = await Order.findByPk(orderId);
  if (!order) throw new Error("Order not found");

  const allowedFlow = {
    PENDING: ["PICKUP", "CANCELLED", "REFUNDED"],
    PICKUP: ["SHIPPING", "CANCELLED", "REFUNDED"],
    SHIPPING: ["DELIVERED"],
  };

  const current = order.order_status;

  if (allowedFlow[current] && !allowedFlow[current].includes(status)) {
    throw new Error("Không thể chuyển trạng thái");
  }

  order.order_status = status;

  // COD: tự động PAID khi DELIVERED
  if (
    status === "DELIVERED" &&
    order.payment_method === "COD" &&
    order.payment_status === "UNPAID"
  ) {
    order.payment_status = "PAID";
  }

  return order.save();
};

// ─── updatePaymentStatus (dùng cho callback thanh toán) ──────────────────────
const updatePaymentStatus = async (orderId, paymentStatus, orderStatus) => {
  const order = await Order.findByPk(orderId);
  if (!order) throw new Error("Order not found");
  order.payment_status = paymentStatus;
  if (orderStatus) order.order_status = orderStatus;
  return order.save();
};

// ─── cancelOrder ─────────────────────────────────────────────────────────────
// Chỉ cho hủy khi PENDING hoặc PICKUP
// cancelledBy: 'CUSTOMER' | 'STORE'
// cancelReason: mã lý do (string)
// Nếu SEPAY/WALLET + PAID → hoàn tiền vào ví → REFUNDED
// Nếu COD            → CANCELLED
const cancelOrder = async (orderId, cancelledBy, cancelReason) => {
  const order = await Order.findByPk(orderId);

  if (!order) throw new Error("Không tìm thấy đơn hàng");

  if (order.order_status !== "PENDING" && order.order_status !== "PICKUP") {
    throw new Error("Chỉ được hủy đơn ở trạng thái PENDING hoặc PICKUP");
  }

  const isRefund =
    (order.payment_method === "SEPAY" || order.payment_method === "WALLET") &&
    order.payment_status === "PAID";

  if (isRefund) {
    let wallet = await Wallet.findOne({ where: { user_id: order.buyer_id } });
    if (!wallet) {
      wallet = await Wallet.create({ user_id: order.buyer_id, balance: 0 });
    }

    const refundAmount = Number(order.total_amount);
    wallet.balance = Number(wallet.balance) + refundAmount;
    await wallet.save();

    await WalletTransaction.create({
      wallet_id: wallet.id,
      type: "REFUND",
      amount: refundAmount,
      status: "SUCCESS",
      order_id: order.id,
      description: `Hoàn tiền đơn hàng #${order.id}`,
    });

    order.order_status = "REFUNDED";
    order.payment_status = "REFUNDED";

    await Payment.update(
      { status: "REFUNDED" },
      { where: { order_id: order.id, payment_method: "SEPAY" } },
    );
  } else {
    order.order_status = "CANCELLED";

    if (order.payment_method === "SEPAY" && order.payment_status === "UNPAID") {
      order.payment_status = "FAILED";
      await Payment.update(
        { status: "FAILED" },
        { where: { order_id: order.id, status: "PENDING" } },
      );
    }
  }

  order.cancelled_by_role = cancelledBy;
  order.cancel_reason = cancelReason;
  order.cancelled_at = new Date();

  await order.save();
  return order;
};
// ─── deleteOrder (legacy — giữ cho tương thích) ──────────────────────────────
const deleteOrder = async (orderId) => {
  const order = await Order.findByPk(orderId);

  if (!order) {
    throw new Error("Không tìm thấy đơn hàng");
  }

  if (order.order_status !== "PENDING" && order.order_status !== "PICKUP") {
    throw new Error("Chỉ được xóa đơn ở trạng thái PENDING hoặc PICKUP");
  }

  await OrderDetail.destroy({ where: { order_id: orderId } });
  await order.destroy();

  return true;
};
// ─── HELPER: Lọc theo ngày/tháng/năm ─────────────────────────────────────
const buildOrderWhere = (storeId, filters = {}) => {
  const { period, date, month, year, status } = filters;

  let createdAtFilter = null;

  if (period === "day" && date) {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    createdAtFilter = { [Op.gte]: start, [Op.lt]: end };
  }

  if (period === "month" && month) {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    createdAtFilter = { [Op.gte]: start, [Op.lt]: end };
  }

  if (period === "year" && year) {
    const start = new Date(Number(year), 0, 1);
    const end = new Date(Number(year) + 1, 0, 1);
    createdAtFilter = { [Op.gte]: start, [Op.lt]: end };
  }

  return {
    store_id: storeId,
    ...(createdAtFilter && { created_at: createdAtFilter }),
    ...(status && { order_status: status }),
  };
};
// ─── getWalletByUser ──────────────────────────────────────────────────────────
const getWalletByUser = async (userId) => {
  let wallet = await Wallet.findOne({
    where: { user_id: userId },
  });
  if (!wallet) {
    wallet = await Wallet.create({ user_id: userId, balance: 0 });
  }

  const transactions = await WalletTransaction.findAll({
    where: { wallet_id: wallet.id },
    order: [["created_at", "DESC"]],
    limit: 50,
  });

  return { wallet, transactions };
};

// ─── getOrdersByUserFiltered (lọc theo tháng/năm/trạng thái, giới hạn kết quả) ──
const getOrdersByUserFiltered = async (
  userId,
  { month, year, status, limit = 5 } = {},
) => {
  const whereClause = { buyer_id: userId };

  // Lọc theo tháng/năm
  if (month && year) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    whereClause.created_at = { [Op.between]: [startDate, endDate] };
  } else if (year) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
    whereClause.created_at = { [Op.between]: [startDate, endDate] };
  }

  // Lọc theo trạng thái
  if (status) {
    whereClause.order_status = status.toUpperCase();
  }

  const orders = await Order.findAll({
    where: whereClause,
    include: [
      {
        model: OrderDetail,
        as: "items",
        include: [{ model: Product, as: "product", paranoid: false }],
      },
      { model: Payment, as: "payments" },
    ],
    order: [["created_at", "DESC"]],
    limit,
  });

  return await attachReviewStatus(orders);
};

// ─── getPurchaseSummaryByUser (thống kê tổng quát — rất nhanh, không load chi tiết) ──
const getPurchaseSummaryByUser = async (userId) => {
  const totalOrders = await Order.count({ where: { buyer_id: userId } });

  const completedOrders = await Order.findAll({
    where: { buyer_id: userId, order_status: "DELIVERED" },
    attributes: [
      [
        Order.sequelize.fn("SUM", Order.sequelize.col("total_amount")),
        "totalSpent",
      ],
      [
        Order.sequelize.fn("COUNT", Order.sequelize.col("id")),
        "totalCompleted",
      ],
    ],
    raw: true,
  });

  const statusCounts = await Order.findAll({
    where: { buyer_id: userId },
    attributes: [
      "order_status",
      [Order.sequelize.fn("COUNT", Order.sequelize.col("id")), "count"],
    ],
    group: ["order_status"],
    raw: true,
  });

  // Tìm sản phẩm được mua nhiều nhất
  const topProduct = await OrderDetail.findAll({
    include: [
      {
        model: Order,
        as: "order",
        where: { buyer_id: userId },
        attributes: [],
      },
      {
        model: Product,
        as: "product",
        attributes: ["name"],
        paranoid: false,
      },
    ],
    attributes: [
      "product_id",
      [
        OrderDetail.sequelize.fn(
          "COUNT",
          OrderDetail.sequelize.col("order_detail.product_id"),
        ),
        "buyCount",
      ],
    ],
    group: ["product_id", "product.name"],
    order: [
      [
        OrderDetail.sequelize.fn(
          "COUNT",
          OrderDetail.sequelize.col("order_detail.product_id"),
        ),
        "DESC",
      ],
    ],
    limit: 1,
    raw: true,
  });

  return {
    totalOrders,
    totalSpent: Number(completedOrders[0]?.totalSpent || 0),
    totalCompleted: Number(completedOrders[0]?.totalCompleted || 0),
    statusBreakdown: statusCounts.reduce((acc, s) => {
      acc[s.order_status] = Number(s.count);
      return acc;
    }, {}),
    mostPurchasedProduct: topProduct[0]?.["product.name"] || null,
  };
};

module.exports = {
  createOrder,
  createOrderItem,
  getOrdersByUser,
  getOrdersByStore,
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus,
  cancelOrder,
  deleteOrder,
  buildOrderWhere,
  getWalletByUser,
  getOrdersByUserFiltered,
  getPurchaseSummaryByUser,
};
