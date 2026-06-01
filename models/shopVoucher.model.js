// Backend/models/shopVoucher.model.js
// Voucher Shop - Shop tự tạo, chỉ áp dụng cho sản phẩm/đơn hàng của shop đó
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const ShopVoucher = sequelize.define(
    "ShopVoucher",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      store_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: "ID của shop tạo voucher",
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: "Tên chương trình khuyến mãi",
      },
      code: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: "Mã voucher (unique trong phạm vi shop)",
      },
      voucher_type: {
        type: DataTypes.ENUM("PERCENT", "FIXED"),
        allowNull: false,
        comment: "Loại giảm giá: PERCENT=%, FIXED=tiền mặt",
      },
      discount_value: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        comment: "Giá trị giảm",
      },
      max_discount_amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        comment: "Giảm tối đa (cho loại PERCENT)",
      },
      min_order_value: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        comment: "Đơn hàng tối thiểu",
      },
      // Áp dụng cho sản phẩm cụ thể (JSON array of product IDs) hoặc null = toàn shop
      applicable_product_ids: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "JSON array of product IDs, null = tất cả sản phẩm trong shop",
        get() {
          const raw = this.getDataValue("applicable_product_ids");
          if (!raw) return null;
          try { return JSON.parse(raw); } catch { return null; }
        },
        set(val) {
          this.setDataValue(
            "applicable_product_ids",
            val ? JSON.stringify(val) : null
          );
        },
      },
      start_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      end_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "Số lượng (null = không giới hạn)",
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
    },
    {
      tableName: "shop_vouchers",
      timestamps: true,
      underscored: true,

      indexes: [
        {
          unique: true,
          fields: [
            "store_id",
            "code"
          ],
          name: "unique_shop_code"
        }
      ]
    }
  );

  return ShopVoucher;
};
