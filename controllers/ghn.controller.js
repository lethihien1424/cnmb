//D:\CNM_cu\CongNgheMoi\Backend\controllers\ghn.controller.js
const ghnService = require("../services/ghn.service");

const getProvinces = async (req, res) => {
  try {
    const data = await ghnService.getProvinces();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getProvinces };