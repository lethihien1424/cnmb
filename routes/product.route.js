const express = require("express");
const router = express.Router(); // <--- DÒNG NÀY LÀ CÁI BẠN ĐANG THIẾU
const productController = require("../controllers/product.controller");
const { verifyToken, checkRole } = require("../middlewares/auth.middleware");
const { uploadProductImages } = require("../middlewares/upload.middleware");
const { checkToxicContent } = require("../middlewares/aiModeration");

// Các route GET không cần bảo mật (Ai cũng xem được)
router.get("/", productController.searchProducts);
router.get("/:id", productController.getProductDetail);
router.get(
  "/:id/flash-sale/suggest",
  verifyToken,
  checkRole(["Customer", "Business"]),
  productController.suggestFlashSale,
);

// Các route cần bảo mật (POST, PUT, DELETE)
router.post(
  "/",
  verifyToken,
  checkRole(["Customer", "Business"]),
  uploadProductImages,
  checkToxicContent,
  productController.createProduct,
);

router.put(
  "/:id",
  verifyToken,
  checkRole(["Customer", "Business"]),
  uploadProductImages,
  checkToxicContent,
  productController.updateProduct,
);

router.delete(
  "/:id",
  verifyToken,
  checkRole(["Customer", "Business"]),
  productController.deleteProduct,
);

router.put(
  "/:id/flash-sale",
  verifyToken,
  checkRole(["Customer", "Business"]),
  productController.setFlashSale,
);
router.put(
  "/:id/flash-sale/schedule",
  verifyToken,
  checkRole(["Customer", "Business"]),
  productController.scheduleFlashSale,
);

router.patch(
  "/:id/status",
  verifyToken,
  checkRole(["Customer", "Business"]),
  productController.toggleProductStatus,
);

module.exports = router;
