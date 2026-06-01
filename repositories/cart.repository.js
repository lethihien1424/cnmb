//D:\CongNgheMoi-hien\CongNgheMoi\Backend\repositories\cart.repository.js
const { Cart, CartDetail, Product } = require("../models");

// ================= CART =================
const findCartByUserId = async (userId) => {
  return await Cart.findOne({
    where: { user_id: userId },
  });
};

const createCart = async (userId) => {
  return await Cart.create({
    user_id: userId,
  });
};

// ================= CART ITEM =================
const findItem = async (cartId, productId, size = null, color = null) => {
  const normSize =
    size === undefined ||
    size === null ||
    String(size).trim() === "" ||
    String(size).trim() === "null" ||
    String(size).trim() === "undefined"
      ? null
      : String(size).trim();
  const normColor =
    color === undefined ||
    color === null ||
    String(color).trim() === "" ||
    String(color).trim() === "null" ||
    String(color).trim() === "undefined"
      ? null
      : String(color).trim();

  return await CartDetail.findOne({
    where: {
      cart_id: cartId,
      product_id: productId,
      size: normSize,
      color: normColor,
    },
  });
};

const createItem = async (payload) => {
  return await CartDetail.create(payload);
};

const updateItem = async (item, quantity) => {
  return await item.update({
    quantity,
  });
};

const deleteItem = async (item) => {
  return await item.destroy();
};

// ================= GET CART =================
const getCartItems = async (cartId) => {
  return await CartDetail.findAll({
    where: { cart_id: cartId },
    include: [
      {
        model: Product,
        as: "product",
        paranoid: false, // Bao gồm cả sản phẩm đã soft-delete (ngừng bán)
      },
    ],
    order: [["created_at", "DESC"]],
  });
};

module.exports = {
  findCartByUserId,
  createCart,
  findItem,
  createItem,
  updateItem,
  deleteItem,
  getCartItems,
};
