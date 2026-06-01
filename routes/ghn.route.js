//D:\CNM_cu\CongNgheMoi\Backend\routes\ghn.route.js
const express = require("express");
const router = express.Router();
const ghnService = require("../services/ghn.service");

// ===== PROVINCES =====
router.get("/provinces", async (req, res) => {
  try {
    const data = await ghnService.getProvinces();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ===== DISTRICTS =====
router.get("/districts/:province_id", async (req, res) => {
  try {
    const data = await ghnService.getDistricts(req.params.province_id);
    res.json({ data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// ===== WARDS =====
router.get("/wards/:district_id", async (req, res) => {
  try {
    const data = await ghnService.getWards(req.params.district_id);
    res.json({ data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;