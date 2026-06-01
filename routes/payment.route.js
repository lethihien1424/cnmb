const express = require("express");
const router = express.Router();
const {
  handleSepayWebhook,
  getSepayPaymentStatus,
} = require("../controllers/payment.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

router.post("/", handleSepayWebhook);
router.post("/sepay/webhook", handleSepayWebhook);
router.post("/webhook", handleSepayWebhook);
router.get("/sepay/:paymentId/status", verifyToken, getSepayPaymentStatus);

module.exports = router;
