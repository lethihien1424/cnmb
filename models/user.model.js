// models/user.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      username: {
        type: DataTypes.STRING(255), // Nới rộng từ 50 → 255
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING(255), // Nới rộng từ 100 → 255
        allowNull: false,
        unique: true,
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      address: {
        type: DataTypes.STRING(255),
        allowNull: true, // Cho phép trống vì lúc mới đăng ký chưa có địa chỉ
      },
      role: {
        type: DataTypes.ENUM("Admin", "Customer", "Business"),
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: "ACTIVE",
      },
      xu_balance: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      last_xu_claim_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // Đã di chuyển 2 trường này vào ĐÚNG vị trí (bên trong block định nghĩa cột)
      resetOtp: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      resetOtpExpires: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      avatar: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      gender: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      date_of_birth: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: "users",
      timestamps: true,
      underscored: true,
      paranoid: true,
      deletedAt: "deleted_at",
    },
  );

  return User;
};
