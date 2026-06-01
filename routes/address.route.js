const express = require("express");

const router = express.Router();

const ctrl =
  require("../controllers/address.controller");

const {
  verifyToken,
} = require("../middlewares/auth.middleware");

// ───────────────────────────────────────────────────────
// CREATE ADDRESS
// ───────────────────────────────────────────────────────
router.post(
  "/",

  verifyToken,

  ctrl.createAddress
);

// ───────────────────────────────────────────────────────
// GET ALL ADDRESSES
// ───────────────────────────────────────────────────────
router.get(
  "/",

  verifyToken,

  ctrl.getAddresses
);

// ───────────────────────────────────────────────────────
// GET ADDRESS DETAIL
// ───────────────────────────────────────────────────────
router.get(
  "/:id",

  verifyToken,

  ctrl.getAddressById
);
router.put("/:id", verifyToken, ctrl.updateAddress);
module.exports = router;