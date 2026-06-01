const express = require("express");
const router = express.Router();
const { Notification } = require("../models"); //
const { verifyToken } = require("../middlewares/auth.middleware"); //

// API lấy danh sách thông báo của chính mình
router.get("/", verifyToken, async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { recipient_id: req.user.userId }, // Chỉ lấy thông báo của người đang đăng nhập
      order: [["created_at", "DESC"]], // Thông báo mới nhất hiện lên đầu
    });
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
