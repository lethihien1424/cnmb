//D:\CongNgheMoi-hien\CongNgheMoi\Backend\models\cart.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Cart = sequelize.define(
    "Cart",
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
    },
    {
      tableName: "carts",
      timestamps: true,
      underscored: true,
    }
  );

  return Cart;
};