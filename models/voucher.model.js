const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Voucher = sequelize.define(
    "Voucher",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      code: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      voucher_type: {
        type: DataTypes.ENUM("PERCENT", "FIXED", "FREESHIP"),
        allowNull: false,
      },
      discount_value: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      max_discount_amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      min_order_value: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      target_audience: {
        type: DataTypes.ENUM("ALL", "NEW_USER"),
        allowNull: false,
        defaultValue: "ALL",
      },

      // ==================== FIELDS CHO FREESHIP ====================
      applicable_shipping_type: {
        type: DataTypes.ENUM("ALL", "STANDARD", "EXPRESS"),
        allowNull: true,
        defaultValue: "ALL",
      },
      applicable_product_type: {
        type: DataTypes.ENUM("ALL", "BULKY"),
        allowNull: true,
        defaultValue: "ALL",
      },
      freeship_discount_percent: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 100,
      },
      max_distance_km: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "Khoảng cách tối đa (km) để áp dụng freeship",
      },
      // ============================================================

      validity_hours_after_grant: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      used_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      usage_limit_per_user: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "vouchers",
      timestamps: true,
      underscored: true,
    }
  );

  return Voucher;
};