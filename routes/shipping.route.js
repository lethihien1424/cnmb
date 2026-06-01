// routes/shipping.route.js

const express = require("express");

const router = express.Router();

const shippingController =
  require("../controllers/shipping.controller");

const {
  verifyToken,
  checkRole,
} = require("../middlewares/auth.middleware");

router.post(
  "/calculate",

  verifyToken,

  checkRole(["Customer"]),

  shippingController.calculateFee
);

module.exports = router;