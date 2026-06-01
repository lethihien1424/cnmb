// controllers/store.controller.js
const authService = require('../services/auth.service');
const { Store } = require('../models');

// THÊM HÀM NÀY ĐỂ LẤY THÔNG TIN
const getMyStore = async (req, res) => {
  try {
    const store = await Store.findOne({ where: { owner_id: req.user.id } });
    res.status(200).json({ success: true, data: store });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi lấy dữ liệu" });
  }
};

const updateStoreInfo = async (req, res) => {
  try {
    const userId = req.user.id; 
    const updateData = req.body;
    
    const updatedStore = await authService.updateStoreInfo(userId, updateData);
    
    res.status(200).json({
      success: true,
      message: "Cập nhật thành công",
      data: updatedStore
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Lỗi hệ thống"
    });
  }
};

module.exports = { 
  updateStoreInfo, 
  getMyStore 
};