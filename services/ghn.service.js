const axios = require("axios");

const GHN_URL = "https://online-gateway.ghn.vn/shiip/public-api";

const headers = {
  Token: process.env.GHN_TOKEN,
  ShopId: process.env.GHN_SHOP_ID,
  "Content-Type": "application/json",
};

// Master-data endpoints (province/district/ward) không cần ShopId
const masterHeaders = {
  Token: process.env.GHN_TOKEN,
  "Content-Type": "application/json",
};

const getProvinces = async () => {
  try {
    const res = await axios.get(`${GHN_URL}/master-data/province`, { headers: masterHeaders });
    return res.data.data;
  } catch (err) {
    console.log("GHN PROVINCE ERROR:", err.response?.data);
    throw new Error("Không lấy được tỉnh");
  }
};

const getDistricts = async (province_id) => {
  try {
    const res = await axios.post(
      `${GHN_URL}/master-data/district`,
      { province_id: Number(province_id) },
      { headers: masterHeaders }
    );
    return res.data.data;
  } catch (err) {
    console.log("GHN DISTRICT ERROR:", err.response?.data);
    throw new Error("Không lấy được quận/huyện");
  }
};

const getWards = async (district_id) => {
  try {
    // GHN ward endpoint dùng POST với body, không dùng GET params
    const res = await axios.post(
      `${GHN_URL}/master-data/ward`,
      { district_id: Number(district_id) },
      { headers: masterHeaders }
    );
    return res.data.data;
  } catch (err) {
    console.log("GHN WARD ERROR:", err.response?.data);
    throw new Error("Không lấy được phường/xã");
  }
};

const getServiceId = async (from_district, to_district) => {
  try {
    const res = await axios.post(
      `${GHN_URL}/v2/shipping-order/available-services`,
      { from_district, to_district },
      { headers }
    );
    const service = res.data.data[0];
    if (!service) throw new Error("Không có service");
    return service.service_id;
  } catch (err) {
    console.log("GET SERVICE ERROR:", err.response?.data);
    throw new Error("Không lấy được service_id");
  }
};

const calculateShipping = async (from_district_id, to_district_id, to_ward_code) => {
  try {
    const service_id = await getServiceId(from_district_id, to_district_id);
    const res = await axios.post(
      `${GHN_URL}/v2/shipping-order/fee`,
      {
        from_district_id,
        to_district_id,
        to_ward_code,
        service_id,
        weight: 1000,
        length: 10,
        width: 10,
        height: 10,
      },
      { headers }
    );
    return res.data.data.total;
  } catch (err) {
    console.log("GHN ERROR:", err.response?.data);
    throw new Error("Không tính được phí ship GHN");
  }
};

const getAvailableServices = async (from_district, to_district) => {
  try {
    const res = await axios.post(
      `${GHN_URL}/v2/shipping-order/available-services`,
      {
        shop_id: Number(process.env.GHN_SHOP_ID),
        from_district: Number(from_district),
        to_district: Number(to_district),
      },
      { headers }
    );
    return res.data.data || [];
  } catch (err) {
    console.log("GHN AVAILABLE SERVICES ERROR:", err.response?.data);
    return [];
  }
};

// ─── Tính phí theo service_id, hỗ trợ truyền dimensions tùy chỉnh ────────────
const calculateFeeByServiceId = async (
  service_id,
  from_district_id,
  to_district_id,
  to_ward_code,
  options = {}   // ← thêm param này
) => {
  const {
    weight = 1000,
    length = 10,
    width = 10,
    height = 10,
  } = options;

  const res = await axios.post(
    `${GHN_URL}/v2/shipping-order/fee`,
    {
      service_id: Number(service_id),
      from_district_id: Number(from_district_id),
      to_district_id: Number(to_district_id),
      to_ward_code: String(to_ward_code),
      weight,
      length,
      width,
      height,
    },
    { headers }
  );
  if (!res.data?.data?.total) throw new Error("GHN không trả về phí ship");
  return res.data.data.total;
};

module.exports = {
  getProvinces,
  getDistricts,
  getWards,
  calculateShipping,
  getAvailableServices,
  calculateFeeByServiceId,
};