const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Payment = sequelize.define(
    "Payment",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      order_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      payment_method: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "SEPAY",
      },
      amount: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "PENDING",
      },
      transaction_id: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      transfer_content: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      sender_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      sender_bank_name: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      sender_account_number: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      receiver_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      receiver_bank_name: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      receiver_account_number: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      paid_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      raw_webhook: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "payments",
      timestamps: true,
      underscored: true,
    },
  );

  return Payment;
};
