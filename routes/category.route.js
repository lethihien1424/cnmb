const express = require("express");
const router = express.Router();
const { Category } = require("../models");
const { Op } = require("sequelize");
const { verifyToken, checkRole } = require("../middlewares/auth.middleware");

// Xem danh sách danh mục (Ai cũng xem được)
router.get("/", async (req, res) => {
  try {
    const categories = await Category.findAll();
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// 1. Chỉnh sửa danh mục (Chỉ Admin)
router.put("/:id", verifyToken, checkRole(["Admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findByPk(id);

    if (!category) {
      return res.status(404).json({ message: "Không tìm thấy danh mục" });
    }

    // Kiểm tra trùng tên (bỏ qua chính mình)
    if (req.body.name && req.body.name.trim()) {
      const duplicate = await Category.findOne({
        where: {
          name: { [Op.iLike]: req.body.name.trim() },
          id: { [Op.ne]: id },
        },
      });
      if (duplicate) {
        return res.status(409).json({ message: `Tên danh mục "${req.body.name.trim()}" đã tồn tại` });
      }
    }

    await category.update(req.body);
    res.json({ success: true, message: "Cập nhật thành công", data: category });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. Xóa danh mục (Chỉ Admin)
router.delete("/:id", verifyToken, checkRole(["Admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findByPk(id);

    if (!category) {
      return res.status(404).json({ message: "Không tìm thấy danh mục" });
    }

    // Sequelize sẽ tự động thực hiện Soft Delete vì bạn đã cấu hình paranoid: true
    await category.destroy();
    res.json({ success: true, message: "Xóa danh mục thành công" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin mới được tạo danh mục
router.post("/", verifyToken, checkRole(["Admin"]), async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) {
      return res.status(400).json({ message: "Tên danh mục không được để trống" });
    }

    // Kiểm tra trùng tên (case-insensitive)
    const existing = await Category.findOne({
      where: { name: { [Op.iLike]: name } },
    });
    if (existing) {
      return res.status(409).json({ message: `Tên danh mục "${name}" đã tồn tại` });
    }

    const category = await Category.create({ ...req.body, name });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
