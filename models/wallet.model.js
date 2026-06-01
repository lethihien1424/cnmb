const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Wallet = sequelize.define(
    "Wallet",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
      },
      balance: {
        type: DataTypes.BIGINT,
        defaultValue: 0,
      },

      bank_code: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      bank_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      bank_account_number: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      bank_account_holder: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
    },
    {
      tableName: "wallets",
      timestamps: true,
      underscored: true,
    }
  );

  return Wallet;
};