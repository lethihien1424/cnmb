// Backend/services/shipping.service.js
const geolib = require("geolib");
const { Address, Store } = require("../models");

// ─── Normalize text ──────────────────────────────────
const normalize = (s = "") =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(
      /quan |huyen |thi xa |tp\.|thanh pho |phuong |xa |thi tran /g,
      ""
    )
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// ─── Fee table ───────────────────────────────────────
//  Mức phí chuẩn (hàng thường) theo vị trí / khoảng cách
//  bulky multiplier tuỳ tier (xem bên dưới)
const TIERS = [

  { label: "same_district", fee: 15000, bulkyMul: 4, eta: "1-2 ngày" },

  { label: "same_province", fee: 30000, bulkyMul: 3, eta: "2-3 ngày" },

  { label: "dist_50", fee: 35000, maxKm: 50, bulkyMul: 3, eta: "3-5 ngày" },

  { label: "dist_100", fee: 45000, maxKm: 100, bulkyMul: 3, eta: "3-5 ngày" },

  { label: "dist_200", fee: 60000, maxKm: 200, bulkyMul: 2, eta: "4-6 ngày" },

  { label: "dist_far", fee: 80000, maxKm: Infinity, bulkyMul: 2, eta: "5-7 ngày" },

];

// Express chỉ áp dụng khi distance <= EXPRESS_MAX_KM
const EXPRESS_MAX_KM     = 10;
const EXPRESS_FEE        = 60_000;   // hàng thường
const EXPRESS_BULKY_FEE  = 120_000;  // hàng cồng kềnh
const EXPRESS_ETA        = "1-3 giờ";

// ─── Core calculator ─────────────────────────────────
const calculateShippingFee = async (
  userId,
  addressId,
  shippingType = "STANDARD",
  storeId,
  isBulky = false
) => {
  try {
    // ── Address ───────────────────────────────────────
    const address = await Address.findByPk(addressId);
    if (!address)
      return { success: false, message: "Địa chỉ không tồn tại" };

    if (String(address.user_id) !== String(userId))
      return { success: false, message: "Địa chỉ không thuộc về user" };

    // ── Store ─────────────────────────────────────────
    const store = await Store.findByPk(storeId);
    if (!store)
      return { success: false, message: "Shop không tồn tại" };

    // ── Check lat/lng ─────────────────────────────────
    if (
      !store.latitude  || !store.longitude ||
      !address.latitude || !address.longitude
    ) {
      return { success: false, message: "Thiếu tọa độ để tính phí ship" };
    }

    // ── Distance (km) ─────────────────────────────────
    const distanceM = geolib.getDistance(
      { latitude: Number(store.latitude),   longitude: Number(store.longitude)   },
      { latitude: Number(address.latitude), longitude: Number(address.longitude) }
    );
    const distance = distanceM / 1000;

    // ── Express path ──────────────────────────────────
    if (shippingType === "EXPRESS") {
      if (distance > EXPRESS_MAX_KM) {
        return {
          success: false,
          message: `Hỏa tốc chỉ hỗ trợ trong phạm vi ${EXPRESS_MAX_KM}km`,
        };
      }
      const fee = isBulky ? EXPRESS_BULKY_FEE : EXPRESS_FEE;
      return {
        success: true,
        shippingFee: fee,
        distanceKm: Number(distance.toFixed(1)),
        estimatedDeliveryTime: EXPRESS_ETA,
      };
    }

    // ── Standard path: xác định tier ─────────────────
    const storeAddr  = normalize(store.address || "");
    const sameDistrict = storeAddr.includes(normalize(address.district));
    const sameProvince = storeAddr.includes(normalize(address.province));

    let tier;
    if (sameDistrict) {
      tier = TIERS.find((t) => t.label === "same_district");
    } else if (sameProvince) {
      tier = TIERS.find((t) => t.label === "same_province");
    } else {
      tier = TIERS.find((t) => t.label !== "same_district" && t.label !== "same_province" && distance <= t.maxKm);
    }

    if (!tier) tier = TIERS[TIERS.length - 1]; // fallback to furthest

    const fee = isBulky ? tier.fee * tier.bulkyMul : tier.fee;

    return {
      success: true,
      shippingFee: fee,
      distanceKm: Number(distance.toFixed(1)),
      estimatedDeliveryTime: tier.eta,
    };

  } catch (error) {
    console.error("calculateShippingFee error:", error);
    return { success: false, message: error.message };
  }
};

module.exports = { calculateShippingFee };