// routes/user.route.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/user.controller");
const { verifyToken, checkRole } = require("../middlewares/auth.middleware");
const { uploadAvatar } = require("../middlewares/upload.middleware");

// ⚠️ QUAN TRỌNG: /profile phải đứng TRƯỚC /:id
// Nếu /:id đứng trước, Express sẽ match "profile" như một id → 404
router.get("/profile", verifyToken, ctrl.getProfile);
router.put("/profile", verifyToken, ctrl.updateProfile);
// POST /profile — dùng cho FormData (multipart/form-data) để upload avatar
router.post("/profile", verifyToken, uploadAvatar, ctrl.updateProfile);

// Admin routes
router.post("/", verifyToken, checkRole(["Admin"]), ctrl.createUser);
router.get("/", verifyToken, checkRole(["Admin"]), ctrl.getAllUsers);
router.get("/:id", verifyToken, checkRole(["Admin"]), ctrl.getUserById);
router.put("/:id", verifyToken, checkRole(["Admin"]), ctrl.updateUser);
router.delete("/:id", verifyToken, checkRole(["Admin"]), ctrl.deleteUser);

module.exports = router;
