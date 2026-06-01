const express = require("express");

const router = express.Router();

const voucherController = require(
  "../controllers/voucher.controller"
);

const {
  verifyToken,
  checkRole,
} = require(
  "../middlewares/auth.middleware"
);

// ======================
// PLATFORM VOUCHER (ADMIN)
// ======================

router.post(
  "/admin/platform",
  verifyToken,
  checkRole(["Admin"]),
  voucherController.createPlatformVoucher
);

router.get(
  "/admin/platform",
  verifyToken,
  checkRole(["Admin"]),
  voucherController.getPlatformVouchers
);

router.put(
  "/admin/platform/:id",
  verifyToken,
  checkRole(["Admin"]),
  voucherController.updatePlatformVoucher
);

router.patch(
  "/admin/platform/:id/disable",
  verifyToken,
  checkRole(["Admin"]),
  voucherController.disablePlatformVoucher
);

router.patch(
  "/admin/platform/:id/enable",
  verifyToken,
  checkRole(["Admin"]),
  voucherController.enablePlatformVoucher
);

// ======================
// SHOP VOUCHER
// ======================

router.post(
  "/shop",
  verifyToken,
  voucherController.createShopVoucher
);

router.get(
  "/shop/my",
  verifyToken,
  voucherController.getMyShopVouchers
);

router.get(
  "/shop/:storeId",
  voucherController.getShopVouchers
);

router.put(
  "/shop/:id",
  verifyToken,
  voucherController.updateShopVoucher
);

router.patch(
  "/shop/:id/disable",
  verifyToken,
  voucherController.disableShopVoucher
);

router.patch(
  "/shop/:id/enable",
  verifyToken,
  voucherController.enableShopVoucher
);

// ======================
// USER VOUCHER
// ======================

router.get(
  "/my-vouchers",
  verifyToken,
  voucherController.getMyVouchers
);

router.post(
  "/validate",
  verifyToken,
  voucherController.validateVoucher
);
 router.get('/public', verifyToken, voucherController.getPublicPlatformVouchers);
  router.post('/save',  verifyToken, voucherController.saveVoucher);
module.exports = router;