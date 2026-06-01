// Backend/controllers/shipping.controller.js
const shippingService = require("../services/shipping.service");

// POST /api/shipping/calculate
// Body: { address_id, store_id, is_bulky? }
// Response: { success, standard: ShippingOption, express: ShippingOption }
const calculateFee = async (req, res) => {
  try {
    const userId    = req.user.userId || req.user.id;
    const { address_id, store_id, is_bulky = false } = req.body;

    if (!address_id)
      return res.status(400).json({ success: false, message: "Thiếu address_id" });
    if (!store_id)
      return res.status(400).json({ success: false, message: "Thiếu store_id" });

    const bulky = Boolean(is_bulky);

    // ── Tính cả 2 option song song ────────────────────
    const [stdResult, expResult] = await Promise.all([
      shippingService.calculateShippingFee(userId, address_id, "STANDARD", store_id, bulky),
      shippingService.calculateShippingFee(userId, address_id, "EXPRESS",  store_id, bulky),
    ]);

    // ── Standard không khả dụng (thiếu tọa độ, ...) ──
    if (!stdResult.success) {
      return res.status(400).json({ success: false, message: stdResult.message });
    }

    // ── Build response ────────────────────────────────
    const standard = {
      fee:       stdResult.shippingFee,
      available: true,
      name:      "Giao Hàng Nhanh",
      eta:       stdResult.estimatedDeliveryTime,
    };

    const express = expResult.success
      ? {
          fee:       expResult.shippingFee,
          available: true,
          name:      "Hỏa tốc",
          eta:       expResult.estimatedDeliveryTime,
        }
      : {
          fee:       0,
          available: false,
          name:      "Hỏa tốc",
          eta:       "",
          reason:    expResult.message,
        };

    return res.json({
      success: true,
      distance_km: stdResult.distanceKm,
      standard,
      express,
    });

  } catch (err) {
    console.error("calculateFee controller error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { calculateFee };