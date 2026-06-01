//D:\CongNgheMoi-hien\CongNgheMoi\Backend\routes\cart.route.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/cart.controller");

const { verifyToken, checkRole } = require("../middlewares/auth.middleware");

router.post("/add", verifyToken, checkRole(["Customer"]), ctrl.addToCart);

router.put(
  "/update",
  verifyToken,
  checkRole(["Customer"]),
  ctrl.updateQuantity
);

router.get("/", verifyToken, checkRole(["Customer"]), ctrl.getCart);

module.exports = router;