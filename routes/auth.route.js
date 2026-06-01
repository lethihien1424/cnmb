// const express = require("express");
// const authController = require("../controllers/auth.controller");

// const router = express.Router();
// const { uploadProductImages } = require("../middlewares/upload.middleware"); // Tận dụng middleware có sẵn

// // Sửa dòng này để cho phép upload 1 file ảnh với key là 'business_license'
// router.post("/register", uploadProductImages, authController.register);
// router.post("/login", authController.login);

// module.exports = router;
const express = require("express");
const authController = require("../controllers/auth.controller");
const { verifyToken } = require("../middlewares/auth.middleware");
const router = express.Router();

// Import middleware mới chuyên up giấy tờ
const { uploadStoreDocuments } = require("../middlewares/upload.middleware");

// Dùng uploadStoreDocuments thay vì uploadProductImages
router.post("/register", uploadStoreDocuments, authController.register);
router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.get("/daily-xu/status", verifyToken, authController.getDailyXuStatus);
router.post("/daily-xu/claim", verifyToken, authController.claimDailyXu);

module.exports = router;
