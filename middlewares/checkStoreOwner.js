// middlewares/checkStoreOwner.js
const { Store, Order } = require("../models");

const checkStoreOwner = async (req, res, next) => {
  try {
    let storeId = req.params.storeId;

    // Nếu không có storeId trên URL → lấy từ order (cho PUT /:id/status và DELETE /:id)
    if (!storeId && req.params.id) {
      const order = await Order.findByPk(req.params.id);
      if (!order) return res.status(404).json({ message: "Đơn hàng không tồn tại" });
      storeId = order.store_id;
      req.order = order; // gắn vào req dùng lại trong controller
    }

    if (!storeId) {
      return res.status(400).json({ message: "Thiếu store_id" });
    }

    const store = await Store.findByPk(storeId);
    if (!store) return res.status(404).json({ message: "Store không tồn tại" });
    console.log("JWT USER", req.user);
console.log("STORE OWNER", store.owner_id);
    if (store.owner_id !== req.user.userId && req.user.role !== "Admin") {
      return res.status(403).json({ message: "Bạn không có quyền quản lý store này" });
    }

    req.store = store;
    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { checkStoreOwner };