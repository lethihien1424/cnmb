// utils/shipping.js

const getShippingFee = (province) => {
  if (!province) return 30000;

  const p = province.toLowerCase();

  // nội thành HCM
  if (p.includes("hồ chí minh") || p.includes("ho chi minh")) {
    return 20000;
  }

  // Hà Nội
  if (p.includes("hà nội") || p.includes("ha noi")) {
    return 25000;
  }

  // còn lại
  return 30000;
};

module.exports = {
  getShippingFee,
};