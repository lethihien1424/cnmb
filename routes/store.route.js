// routes/store.route.js
const express = require('express');
const router = express.Router();
const storeController = require('../controllers/store.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

// THÊM DÒNG NÀY: Lấy thông tin shop để nạp vào Form
router.get('/my-store', verifyToken, storeController.getMyStore);

// Route cũ của bạn: Cập nhật thông tin shop
router.put('/update-info', verifyToken, storeController.updateStoreInfo);

module.exports = router;