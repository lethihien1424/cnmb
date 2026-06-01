// services/admin.store.service.js
const storeRepository = require("../repositories/store.repository");
const notificationRepository = require("../repositories/notification.repository");
const { User, Store, Order, Product, Address } = require("../models");
const { Op } = require("sequelize");

const STATUS = {
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  INACTIVE: "INACTIVE",
};

const EXCLUDED_ORDER_STATUSES = new Set(["CANCELLED", "CANCELED", "FAILED"]);
const EXCLUDED_PAYMENT_STATUSES = new Set(["FAILED", "REFUNDED"]);

const toSafeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getDateRangeByPeriod = (period, now = new Date()) => {
  const date = new Date(now);

  if (period === "day") {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  if (period === "month") {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return { start, end };
  }

  if (period === "quarter") {
    const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
    const start = new Date(date.getFullYear(), quarterStartMonth, 1);
    const end = new Date(date.getFullYear(), quarterStartMonth + 3, 1);
    return { start, end };
  }

  const start = new Date(date.getFullYear(), 0, 1);
  const end = new Date(date.getFullYear() + 1, 0, 1);
  return { start, end };
};

const buildRangeLabel = (period, start, end) => {
  if (period === "custom") return "custom";
  if (period === "day") return "day";
  if (period === "month") return "month";
  if (period === "quarter") return "quarter";
  return "year";
};

const parseDateFromQuery = (rawDate, fieldName) => {
  if (!rawDate) return null;
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error(`${fieldName} is not a valid date`);
    error.statusCode = 400;
    throw error;
  }
  return parsed;
};

const getDateRangeByFilter = ({ period, from, to }) => {
  if (period === "custom") {
    const start = parseDateFromQuery(from, "from");
    const end = parseDateFromQuery(to, "to");
    if (!start || !end) {
      const error = new Error("from and to are required when period=custom");
      error.statusCode = 400;
      throw error;
    }
    if (end <= start) {
      const error = new Error("to must be greater than from");
      error.statusCode = 400;
      throw error;
    }
    return { period: "custom", start, end };
  }

  const normalizedPeriod = ["day", "month", "quarter", "year"].includes(period)
    ? period
    : "month";
  const { start, end } = getDateRangeByPeriod(normalizedPeriod);
  return { period: normalizedPeriod, start, end };
};

const computePlatformIncomeByDateRange = async ({ period, start, end }) => {
  const orders = await Order.findAll({
    where: {
      createdAt: { [Op.gte]: start, [Op.lt]: end },
    },
    attributes: ["id", "total_amount", "order_status", "payment_status"],
    include: [
      {
        model: Store,
        as: "store",
        attributes: [
          "id",
          "store_name",
          "fixed_fee_rate",
          "payment_fee_rate",
          "service_fee_rate",
        ],
        required: false,
      },
    ],
  });

  let totalOrderRevenue = 0;
  let fixedFeeIncome = 0;
  let paymentFeeIncome = 0;
  let serviceFeeIncome = 0;
  let totalPlatformIncome = 0;
  let totalOwnerIncome = 0;
  let orderCount = 0;
  const storeStatsMap = new Map();

  for (const order of orders) {
    const orderStatus = String(order.order_status || "").toUpperCase();
    const paymentStatus = String(order.payment_status || "").toUpperCase();

    if (
      EXCLUDED_ORDER_STATUSES.has(orderStatus) ||
      EXCLUDED_PAYMENT_STATUSES.has(paymentStatus)
    )
      continue;

    const orderAmount = toSafeNumber(order.total_amount);
    const fixedRate = toSafeNumber(order.store?.fixed_fee_rate);
    const paymentRate = toSafeNumber(order.store?.payment_fee_rate);
    const serviceRate = toSafeNumber(order.store?.service_fee_rate);

    const fixedPart = orderAmount * fixedRate;
    const paymentPart = orderAmount * paymentRate;
    const servicePart = orderAmount * serviceRate;
    const totalPart = fixedPart + paymentPart + servicePart;
    const ownerIncomePart = orderAmount - totalPart;

    const storeId = order.store?.id || "unknown";
    const currentStoreStats = storeStatsMap.get(storeId) || {
      storeId,
      storeName: order.store?.store_name || "Cửa hàng không xác định",
      orderCount: 0,
      totalOrderRevenue: 0,
      totalPlatformIncome: 0,
      totalOwnerIncome: 0,
    };

    currentStoreStats.orderCount += 1;
    currentStoreStats.totalOrderRevenue += orderAmount;
    currentStoreStats.totalPlatformIncome += totalPart;
    currentStoreStats.totalOwnerIncome += ownerIncomePart;
    storeStatsMap.set(storeId, currentStoreStats);

    totalOrderRevenue += orderAmount;
    fixedFeeIncome += fixedPart;
    paymentFeeIncome += paymentPart;
    serviceFeeIncome += servicePart;
    totalPlatformIncome += totalPart;
    totalOwnerIncome += ownerIncomePart;
    orderCount += 1;
  }

  const sortedStoresByRevenueDesc = Array.from(storeStatsMap.values()).sort(
    (a, b) => b.totalOrderRevenue - a.totalOrderRevenue,
  );
  const topStores = sortedStoresByRevenueDesc.slice(0, 5);
  const bottomStores = [...sortedStoresByRevenueDesc].reverse().slice(0, 5);
  const allStores = sortedStoresByRevenueDesc;
  const takeRate =
    totalOrderRevenue > 0 ? totalPlatformIncome / totalOrderRevenue : 0;

  return {
    period: buildRangeLabel(period, start, end),
    range: { from: start.toISOString(), to: end.toISOString() },
    orderCount,
    totalOrderRevenue,
    fixedFeeIncome,
    paymentFeeIncome,
    serviceFeeIncome,
    totalPlatformIncome,
    totalOwnerIncome,
    takeRate,
    totalStoresWithOrders: storeStatsMap.size,
    topStores,
    bottomStores,
    allStores,
  };
};

const computePlatformIncomeByPeriod = async (period) => {
  const { start, end } = getDateRangeByPeriod(period);
  return computePlatformIncomeByDateRange({ period, start, end });
};

const getPendingB2CStores = async () => {
  return storeRepository.findPendingB2CStores();
};

const getUserNotifications = async (userId) => {
  return await notificationRepository.findAllByRecipientId(userId);
};

const updateStoreStatus = async (storeId, status, reason) => {
  if (!Object.values(STATUS).includes(status)) {
    const error = new Error(
      `status must be one of: ${Object.values(STATUS).join(", ")}`,
    );
    error.statusCode = 400;
    throw error;
  }

  const store = await storeRepository.findStoreById(storeId);
  if (!store) {
    const error = new Error("Store not found");
    error.statusCode = 404;
    throw error;
  }

  if (
    status === STATUS.APPROVED &&
    store.store_type === "B2C" &&
    (!store.business_license || !store.tax_code)
  ) {
    const error = new Error(
      "Cannot approve B2C store without business_license and tax_code",
    );
    error.statusCode = 400;
    throw error;
  }

  store.status = status;
  store.reject_reason =
    status === STATUS.REJECTED ? (reason ? reason.trim() : null) : null;
  await store.save();

  let title = "";
  let message = "";

  switch (status) {
    case STATUS.APPROVED:
      title = "Cửa hàng được duyệt";
      message = `Ðơn đăng ký cửa hàng "${store.store_name}" của bạn đã được Admin duyệt. Bạn có thể bắt đầu bán hàng ngay!`;
      break;
    case STATUS.REJECTED: {
      title = "Cửa hàng bị từ chối";
      const reasonText = store.reject_reason
        ? `\nLý do: ${store.reject_reason}`
        : "";
      message = `Đơn đăng ký cửa hàng "${store.store_name}" của bạn đã bị từ chối.${reasonText}\n\nVui lòng kiểm tra lại hồ sơ và đăng ký lại.`;
      break;
    }
    case STATUS.INACTIVE:
      title = "Cửa hàng ngưng hoạt động";
      message = `Cửa hàng "${store.store_name}" của bạn đã được Admin chuyển sang trạng thái Ngưng hoạt động.`;
      break;
  }

  await notificationRepository.createNotification({
    recipient_id: store.owner_id,
    title,
    message,
    type: "SHOP_UPDATE",
    is_read: false,
    related_id: store.id,
  });

  return store;
};

const getCurrentUserStoreStatus = async (userId, role) => {
  const storeType = role === "Business" ? "B2C" : "C2C";
  const store = await storeRepository.findLatestStoreByOwner(userId, storeType);

  if (!store) {
    return {
      hasStore: false,
      hasManageShop: false,
      storeId: null,
      storeType,
      storeStatus: null,
      storeName: null,
    };
  }

  return {
    hasStore: true,
    hasManageShop: store.status === "APPROVED",
    storeId: store.id,
    storeType: store.store_type,
    storeStatus: store.status,
    storeName: store.store_name,
  };
};

const getAdminDashboardStats = async () => {
  const [
    totalCustomers,
    totalStores,
    totalProducts,
    totalRevenue,
    pendingStores,
    approvedStores,
    rejectedStores,
    inactiveStores,
  ] = await Promise.all([
    User.count({ where: { role: "Customer" } }),
    Store.count(),
    Product.count(),
    Order.sum("total_amount"),
    Store.count({ where: { status: "PENDING" } }),
    Store.count({ where: { status: "APPROVED" } }),
    Store.count({ where: { status: "REJECTED" } }),
    Store.count({ where: { status: "INACTIVE" } }),
  ]);

  return {
    totalCustomers,
    totalStores,
    totalProducts,
    totalRevenue: Number(totalRevenue || 0),
    storeStatusSummary: {
      pending: pendingStores,
      approved: approvedStores,
      rejected: rejectedStores,
      inactive: inactiveStores,
    },
  };
};

const BASE_URL = (process.env.BASE_URL || "http://localhost:5000").replace(
  /\/$/,
  "",
);

const buildLicenseImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith("http")) return imagePath;
  // Return relative path only — frontend resolves full URL via getAbsoluteImageUrl()
  const normalized = imagePath.replace(/\\/g, "/");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
};

const getAdminStoresWithDetails = async () => {
  const stores = await Store.findAll({
    include: [
      {
        model: User,
        as: "owner",
        attributes: ["id", "username", "email", "role", "status"],
      },
      {
        model: Product,
        as: "products",
        paranoid: false,
        attributes: ["id", "name", "price", "stock_quantity", "status"],
      },
      {
        model: Order,
        as: "orders",
        attributes: [
          "id",
          "total_amount",
          "order_status",
          "payment_status",
          "createdAt",
        ],
      },
    ],
    order: [["created_at", "DESC"]],
  });

  return stores.map((store) => {
    const revenue = (store.orders || []).reduce(
      (sum, order) => sum + Number(order.total_amount || 0),
      0,
    );
    const storeData = store.toJSON();
    return {
      ...storeData,
      totalRevenue: revenue,
      totalOrders: (store.orders || []).length,
      totalProducts: (store.products || []).length,
      business_license_image_url: buildLicenseImageUrl(
        storeData.business_license_image,
      ),
    };
  });
};

const getAdminStoreDetail = async (storeId) => {
  const store = await Store.findByPk(storeId, {
    include: [
      {
        model: User,
        as: "owner",
        attributes: ["id", "username", "email", "role", "status", "createdAt"],
      },
      {
        model: Product,
        as: "products",
        paranoid: false,
        attributes: [
          "id",
          "name",
          "price",
          "stock_quantity",
          "status",
          "createdAt",
        ],
      },
      {
        model: Order,
        as: "orders",
        attributes: [
          "id",
          "total_amount",
          "order_status",
          "payment_status",
          "createdAt",
        ],
      },
    ],
  });

  if (!store) {
    const error = new Error("Store not found");
    error.statusCode = 404;
    throw error;
  }

  const revenue = (store.orders || []).reduce(
    (sum, order) => sum + Number(order.total_amount || 0),
    0,
  );
  const storeData = store.toJSON();

  return {
    ...storeData,
    totalRevenue: revenue,
    totalOrders: (store.orders || []).length,
    totalProducts: (store.products || []).length,
    business_license_image_url: buildLicenseImageUrl(
      storeData.business_license_image,
    ),
  };
};

const getAdminCustomersWithDetails = async () => {
  const customers = await User.findAll({
    where: { role: "Customer" },
    attributes: ["id", "username", "email", "status", "createdAt"],
    include: [
      {
        model: Store,
        as: "stores",
        attributes: ["id", "store_name", "store_type", "status", "createdAt"],
      },
      {
        model: Order,
        as: "orders",
        attributes: [
          "id",
          "total_amount",
          "order_status",
          "payment_status",
          "createdAt",
        ],
      },
      {
        model: Address,
        as: "addresses",
        where: { is_default: true },
        required: false,
      },
    ],
    order: [["created_at", "DESC"]],
  });

  return customers.map((customer) => {
    const totalSpent = (customer.orders || []).reduce(
      (sum, order) => sum + Number(order.total_amount || 0),
      0,
    );
    return {
      ...customer.toJSON(),
      totalOrders: (customer.orders || []).length,
      totalSpent,
      totalStores: (customer.stores || []).length,
    };
  });
};

const getAdminCustomerDetail = async (customerId) => {
  const customer = await User.findOne({
    where: { id: customerId, role: "Customer" },
    attributes: ["id", "username", "email", "status", "createdAt"],
    include: [
      {
        model: Store,
        as: "stores",
        attributes: [
          "id",
          "store_name",
          "store_type",
          "status",
          "description",
          "createdAt",
        ],
      },
      {
        model: Order,
        as: "orders",
        attributes: [
          "id",
          "total_amount",
          "order_status",
          "payment_status",
          "createdAt",
        ],
      },
    ],
  });

  if (!customer) {
    const error = new Error("Customer not found");
    error.statusCode = 404;
    throw error;
  }

  const totalSpent = (customer.orders || []).reduce(
    (sum, order) => sum + Number(order.total_amount || 0),
    0,
  );

  return {
    ...customer.toJSON(),
    totalOrders: (customer.orders || []).length,
    totalSpent,
    totalStores: (customer.stores || []).length,
  };
};

const getAdminUsersWithDetails = async () => {
  const users = await User.findAll({
    where: { role: { [Op.in]: ["Customer", "Business"] } },
    attributes: ["id", "username", "email", "role", "status", "createdAt"],
    include: [
      {
        model: Store,
        as: "stores",
        attributes: [
          "id",
          "store_name",
          "store_type",
          "status",
          "createdAt",
          "contact_phone",
          "address",
        ],
      },
      {
        model: Order,
        as: "orders",
        attributes: [
          "id",
          "total_amount",
          "order_status",
          "payment_status",
          "createdAt",
        ],
      },
      {
        model: Address,
        as: "addresses",
        where: { is_default: true },
        required: false,
      },
    ],
    order: [["created_at", "DESC"]],
  });

  return users.map((user) => {
    const totalSpent = (user.orders || []).reduce(
      (sum, order) => sum + Number(order.total_amount || 0),
      0,
    );

    const latestStore = (user.stores || []).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    )[0];

    let address = null;
    let phone = null;

    if (
      (user.role === "Business" || (user.stores || []).length > 1) &&
      latestStore
    ) {
      address = latestStore.address;
      phone = latestStore.contact_phone;
    } else if (user.addresses?.[0]) {
      const addr = user.addresses[0];
      address = `${addr.detail}, ${addr.ward}, ${addr.district}, ${addr.province}`;
      phone = addr.phone;
    } else if (latestStore) {
      address = latestStore.address;
      phone = latestStore.contact_phone;
    }

    return {
      ...user.toJSON(),
      totalOrders: (user.orders || []).length,
      totalSpent,
      totalStores: (user.stores || []).length,
      accountType:
        latestStore?.store_type || (user.role === "Business" ? "B2C" : "C2C"),
      latestStoreStatus: latestStore?.status || null,
      address,
      phone,
    };
  });
};

// ─── FIX CHÍNH: getAdminUserDetail ───────────────────────────────────────────
// Vấn đề cũ: chỉ query orders (đơn mua) qua User association,
// KHÔNG có storeOrders (đơn bán theo store_id) → frontend không hiển thị được
const getAdminUserDetail = async (userId) => {
  // Bước 1: Lấy thông tin user + stores + orders mua + địa chỉ
  const user = await User.findOne({
    where: {
      id: userId,
      role: { [Op.in]: ["Customer", "Business"] },
    },
    attributes: ["id", "username", "email", "role", "status", "createdAt"],
    include: [
      {
        model: Store,
        as: "stores",
        attributes: [
          "id",
          "store_name",
          "store_type",
          "status",
          "description",
          "business_license",
          "contact_phone",
          "contact_email",
          "address",
          "createdAt",
          "updatedAt",
        ],
      },
      {
        model: Order,
        as: "orders",
        attributes: [
          "id",
          "total_amount",
          "order_status",
          "payment_status",
          "createdAt",
        ],
        order: [["createdAt", "DESC"]],
        limit: 10,
      },
      {
        model: Address,
        as: "addresses",
        where: { is_default: true },
        required: false,
      },
    ],
  });

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  // Bước 2: Lấy store IDs để query storeOrders
  const storeIds = (user.stores || []).map((s) => s.id);

  // Bước 3: FIX — Query đơn hàng theo store_id (đơn bán)
  // Đây là phần bị thiếu hoàn toàn trong code cũ
  const storeOrders =
    storeIds.length > 0
      ? await Order.findAll({
          where: { store_id: { [Op.in]: storeIds } },
          attributes: [
            "id",
            "total_amount",
            "shipping_fee",
            "order_status",
            "payment_status",
            "payment_method",
            "shipping_address",
            "store_id",
            "createdAt",
          ],
          order: [["createdAt", "DESC"]],
          limit: 10,
        })
      : [];

  // Bước 4: Đếm tổng đơn bán (không bị giới hạn limit)
  const totalStoreOrdersCount =
    storeIds.length > 0
      ? await Order.count({ where: { store_id: { [Op.in]: storeIds } } })
      : 0;

  // Bước 5: Tính doanh thu từ storeOrders đã lấy (10 gần nhất)
  // Dùng để hiển thị, không phải tổng chính xác
  const totalStoreRevenue = storeOrders.reduce(
    (sum, order) => sum + Number(order.total_amount || 0),
    0,
  );

  // Bước 6: Tính totalSpent (đơn mua)
  const totalSpent = (user.orders || []).reduce(
    (sum, order) => sum + Number(order.total_amount || 0),
    0,
  );

  // Bước 7: Metadata
  const latestStore = (user.stores || []).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  )[0];

  let address = null;
  let phone = null;

  if (
    (user.role === "Business" || (user.stores || []).length > 1) &&
    latestStore
  ) {
    address = latestStore.address;
    phone = latestStore.contact_phone;
  } else if (user.addresses?.[0]) {
    const addr = user.addresses[0];
    address = `${addr.detail}, ${addr.ward}, ${addr.district}, ${addr.province}`;
    phone = addr.phone;
  } else if (latestStore) {
    address = latestStore.address;
    phone = latestStore.contact_phone;
  }

  return {
    ...user.toJSON(),
    // Đơn mua (customer orders)
    totalOrders: (user.orders || []).length,
    totalSpent,
    // Đơn bán (store orders) — FIX: có đầy đủ
    storeOrders: storeOrders.map((o) => o.toJSON()),
    totalStoreOrders: totalStoreOrdersCount,
    totalStoreRevenue,
    // Metadata
    totalStores: (user.stores || []).length,
    accountType:
      latestStore?.store_type || (user.role === "Business" ? "B2C" : "C2C"),
    latestStoreStatus: latestStore?.status || null,
    address,
    phone,
  };
};

const getAdminPlatformIncomeSummary = async () => {
  const [day, month, quarter, year] = await Promise.all([
    computePlatformIncomeByPeriod("day"),
    computePlatformIncomeByPeriod("month"),
    computePlatformIncomeByPeriod("quarter"),
    computePlatformIncomeByPeriod("year"),
  ]);
  return { day, month, quarter, year };
};

const getAdminPlatformIncomeReport = async ({ period, from, to }) => {
  const range = getDateRangeByFilter({ period, from, to });
  return computePlatformIncomeByDateRange(range);
};

module.exports = {
  getPendingB2CStores,
  updateStoreStatus,
  getCurrentUserStoreStatus,
  getAdminDashboardStats,
  getAdminStoresWithDetails,
  getAdminStoreDetail,
  getAdminCustomersWithDetails,
  getAdminCustomerDetail,
  getAdminUsersWithDetails,
  getAdminUserDetail,
  getAdminPlatformIncomeSummary,
  getAdminPlatformIncomeReport,
};
