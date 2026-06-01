// Backend/models/userVoucher.model.js
// Kho Voucher của người dùng - lưu voucher sàn đã được cấp cho user
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const UserVoucher = sequelize.define(
    "UserVoucher",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      voucher_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: "FK tới bảng vouchers (voucher sàn)",
      },
      // Thời hạn riêng của voucher này với user này
      // (ưu tiên hơn ngày hết hạn chung của voucher)
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "Thời hạn riêng cho user này, tính từ lúc được cấp",
      },
      is_used: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      used_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      used_on_order_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: "Order đã dùng voucher này",
      },
      granted_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: "Thời điểm được cấp voucher",
      },
    },
    {
      tableName: "user_vouchers",
      timestamps: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ["user_id", "voucher_id"],
          name: "unique_user_voucher",
        },
      ],
    }
  );

  return UserVoucher;
};
