// Backend/models/passwordHistory.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const PasswordHistory = sequelize.define(
    "PasswordHistory",
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
      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
    },
    {
      tableName: "password_histories",
      timestamps: true,
      underscored: true,
    },
  );

  return PasswordHistory;
};
