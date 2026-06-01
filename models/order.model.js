// Backend/models/order.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Order = sequelize.define(
    "Order",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      buyer_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      store_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      total_amount: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      shipping_fee: {
        type: DataTypes.BIGINT,
        defaultValue: 0,
      },
      subtotal_amount: {
        type: DataTypes.BIGINT,
        defaultValue: 0,
      },

      shipping_fee_original: {
        type: DataTypes.BIGINT,
        defaultValue: 0,
      },

      shipping_discount_amount: {
        type: DataTypes.BIGINT,
        defaultValue: 0,
      },

      shop_discount_amount: {
        type: DataTypes.BIGINT,
        defaultValue: 0,
      },

      platform_discount_amount: {
        type: DataTypes.BIGINT,
        defaultValue: 0,
      },
      platform_voucher_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      shop_voucher_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      discount_amount: {
        type: DataTypes.BIGINT,
        defaultValue: 0,
      },
      // VẬN CHUYỂN
      shipping_provider: {
        type: DataTypes.STRING(20),
        defaultValue: "GHN",
        allowNull: false,
      },
      shipping_service_type: {
        type: DataTypes.STRING(20),
        defaultValue: "STANDARD",
        allowNull: false,
      },

      shipping_address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      payment_method: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      payment_status: {
        type: DataTypes.STRING(50),
        defaultValue: "UNPAID",
      },
      order_status: {
        type: DataTypes.STRING(50),
        defaultValue: "PENDING",
      },

      distance_km: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      estimated_delivery_time: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      // Cancel fields
      cancelled_by_role: { type: DataTypes.STRING(50), allowNull: true },
      cancel_reason: { type: DataTypes.STRING(100), allowNull: true },
      cancelled_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "orders",
      timestamps: true,
      underscored: true,
    }
  );

  return Order;
};