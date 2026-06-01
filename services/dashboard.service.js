// Backend/services/dashboard.service.js
const { buildOrderWhere } = require("../repositories/order.repository");
const { Order, Product } = require("../models");
const { Sequelize } = require("sequelize");

const getStoreOverview = async (storeId, filters = {}) => {
  try {
    console.log("=== DASHBOARD SERVICE FILTERS ===", { storeId, filters });
    const orderWhere = buildOrderWhere(storeId, filters);
    console.log("=== DASHBOARD SERVICE ORDERWHERE ===", orderWhere);

    // Tổng sản phẩm
    const totalProducts = await Product.count({
      where: { store_id: storeId },
      paranoid: false,
    });

    // Tổng khách hàng
    const totalCustomers = await Order.count({
      where: orderWhere,
      distinct: true,
      col: "buyer_id",
    });

    // Tổng đơn hàng
    const totalOrders = await Order.count({ where: orderWhere });

    // Doanh thu (chỉ tính đơn đã giao và đã thanh toán)
    const revenueResult = await Order.findOne({
      where: {
        ...orderWhere,
        payment_status: "PAID",
        order_status: "DELIVERED",
      },
      attributes: [
        [Sequelize.fn("SUM", Sequelize.col("total_amount")), "revenue"],
      ],
      raw: true,
    });

    const revenue = Number(revenueResult?.revenue || 0);

    // Thống kê trạng thái đơn hàng
    const statusRaw = await Order.findAll({
      where: orderWhere,
      attributes: [
        "order_status",
        [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
      ],
      group: ["order_status"],
      raw: true,
    });

    const statusStats = {
      pending: 0,
      pickup: 0,
      shipping: 0,
      delivered: 0,
      cancelled: 0,
    };

    statusRaw.forEach((item) => {
      const status = item.order_status;
      const count = Number(item.count);

      if (status === "PENDING") statusStats.pending = count;
      else if (status === "PICKUP") statusStats.pickup = count;
      else if (status === "SHIPPING") statusStats.shipping = count;
      else if (status === "DELIVERED") statusStats.delivered = count;
      else if (status === "CANCELLED" || status === "REFUNDED") {
        statusStats.cancelled += count;
      }
    });

    return {
      totalProducts,
      totalCustomers,
      totalOrders,
      revenue,
      statusStats,
    };
  } catch (error) {
    console.error("Dashboard Service Error:", error);
    throw error;
  }
};

module.exports = {
  getStoreOverview,
};
