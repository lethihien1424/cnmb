//D:\CongNgheMoi-hien\CongNgheMoi\Backend\controllers\cart.controller.js
const cartService = require("../services/cart.service");

const getUserId = (req) => {
  return req.user.userId || req.user.id; // ✅ FIX CHÍNH
};

const addToCart = async (req, res) => {
  try {
    const { product_id, quantity, size, color } = req.body;
    const userId = getUserId(req);

    await cartService.addToCart(userId, product_id, quantity, size, color);

    res.json({ message: "Added to cart" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateQuantity = async (req, res) => {
  try {
    const { product_id, quantity, size, color } = req.body;
    const userId = getUserId(req);

    await cartService.updateQuantity(userId, product_id, quantity, size, color);

    res.json({ message: "Updated quantity" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getCart = async (req, res) => {
  try {
    const userId = getUserId(req);

    const data = await cartService.getCart(userId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  addToCart,
  updateQuantity,
  getCart,
};