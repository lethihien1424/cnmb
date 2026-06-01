//D:\CongNgheMoi-hien\CongNgheMoi\Backend\services\cart.service.js
// services/cart.service.js
const cartRepo = require("../repositories/cart.repository");
const { Product } = require("../models");

// ADD
const addToCart = async (
  userId,
  productId,
  quantity,
  size = null,
  color = null,
) => {
  if (!quantity || quantity <= 0) {
    throw new Error("Số lượng không hợp lệ");
  }

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

  // 🔥 check product tồn tại (bao gồm cả sản phẩm đã soft-delete)
  const product = await Product.findByPk(productId, { paranoid: false });
  if (!product) {
    throw new Error("Sản phẩm không tồn tại");
  }

  // 🚫 Chặn thêm sản phẩm ngừng bán vào giỏ hàng
  if (product.status === "DISCONTINUED" || product.deleted_at) {
    const error = new Error(
      "Sản phẩm này đã ngừng bán, không thể thêm vào giỏ hàng",
    );
    error.statusCode = 400;
    throw error;
  }

  //  check tồn kho
  if (quantity > product.stock_quantity) {
    throw new Error("Số lượng vượt quá tồn kho");
  }

  let cart = await cartRepo.findCartByUserId(userId);

  if (!cart) {
    cart = await cartRepo.createCart(userId);
  }

  const existingItem = await cartRepo.findItem(
    cart.id,
    productId,
    normSize,
    normColor,
  );

  if (existingItem) {
    const newQuantity = existingItem.quantity + quantity;

    // 🔥 check lại tồn kho khi cộng dồn
    if (newQuantity > product.stock_quantity) {
      throw new Error("Tổng số lượng vượt quá tồn kho");
    }

    return await cartRepo.updateItem(existingItem, newQuantity);
  }

  return await cartRepo.createItem({
    cart_id: cart.id,
    product_id: productId,
    quantity,
    size: normSize,
    color: normColor,
  });
};

// UPDATE
const updateQuantity = async (
  userId,
  productId,
  quantity,
  size = null,
  color = null,
) => {
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

  const cart = await cartRepo.findCartByUserId(userId);
  if (!cart) throw new Error("Cart not found");

  const item = await cartRepo.findItem(cart.id, productId, normSize, normColor);
  if (!item) throw new Error("Item not found");

  const product = await Product.findByPk(productId);
  if (!product) throw new Error("Product not found");

  // 🔥 nếu = 0 → xóa
  if (quantity <= 0) {
    await cartRepo.deleteItem(item);
    return;
  }

  // 🔥 check tồn kho
  if (quantity > product.stock_quantity) {
    throw new Error("Số lượng vượt quá tồn kho");
  }

  return await cartRepo.updateItem(item, quantity);
};

// GET
const getCart = async (userId) => {
  const cart = await cartRepo.findCartByUserId(userId);
  if (!cart) return [];

  return await cartRepo.getCartItems(cart.id);
};

module.exports = {
  addToCart,
  updateQuantity,
  getCart,
};
