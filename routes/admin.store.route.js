// routes/admin.store.route.js
const express = require("express");
const adminStoreController = require("../controllers/admin.store.controller");
const ocrController = require("../controllers/ocr.controller");
const { verifyToken, checkRole } = require("../middlewares/auth.middleware");
const { uploadStoreDocuments } = require("../middlewares/upload.middleware");
const { Store, User, Order } = require("../models");
const { Op } = require("sequelize");
const storeRepository = require("../repositories/store.repository");
const { verifyCccdImages } = require("../utils/cccd.verification");
const {
  STORE_FEE_POLICY,
  STORE_POLICY_VERSION,
  buildDossierKey,
} = require("../utils/store.policy");
const authService = require("../services/auth.service");

const router = express.Router();

const REPORT_EXCLUDED_ORDER_STATUSES = new Set([
  "CANCELLED",
  "CANCELED",
  "FAILED",
  "REFUNDED",
  "RETURNED",
  "RETURN",
]);

const REPORT_EXCLUDED_PAYMENT_STATUSES = new Set(["FAILED", "REFUNDED"]);

const getReportRangeByPeriod = (period, now = new Date()) => {
  const date = new Date(now);

  if (period === "day") {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end, bucket: "hour" };
  }

  if (period === "year") {
    const start = new Date(date.getFullYear(), 0, 1);
    const end = new Date(date.getFullYear() + 1, 0, 1);
    return { start, end, bucket: "month" };
  }

  if (period === "quarter") {
    const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
    const start = new Date(date.getFullYear(), quarterStartMonth, 1);
    const end = new Date(date.getFullYear(), quarterStartMonth + 3, 1);
    return { start, end, bucket: "month" };
  }

  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end, bucket: "day" };
};

const createBucketKey = (date, bucket) => {
  const d = new Date(date);

  if (bucket === "hour") {
    return `${String(d.getHours()).padStart(2, "0")}h`;
  }

  if (bucket === "month") {
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

router.get(
  "/stores/pending",
  verifyToken,
  checkRole(["Admin"]),
  adminStoreController.getPendingStores,
);

router.put(
  "/stores/:id/status",
  verifyToken,
  checkRole(["Admin"]),
  adminStoreController.updateStoreStatus,
);

// Alias để tương thích với client đang gọi POST thay vì PUT
router.post(
  "/stores/:id/status",
  verifyToken,
  checkRole(["Admin"]),
  adminStoreController.updateStoreStatus,
);

// Alias ngắn: POST /api/admin/stores/:id với body { status }
router.post(
  "/stores/:id",
  verifyToken,
  checkRole(["Admin"]),
  adminStoreController.updateStoreStatus,
);

router.get(
  "/dashboard/stats",
  verifyToken,
  checkRole(["Admin"]),
  adminStoreController.getDashboardStats,
);

router.get(
  "/dashboard/platform-income",
  verifyToken,
  checkRole(["Admin"]),
  adminStoreController.getPlatformIncomeSummary,
);

router.get(
  "/dashboard/platform-income/report",
  verifyToken,
  checkRole(["Admin"]),
  adminStoreController.getPlatformIncomeReport,
);

router.get(
  "/dashboard/stores",
  verifyToken,
  checkRole(["Admin"]),
  adminStoreController.getStoresDetails,
);

router.get(
  "/dashboard/stores/:id",
  verifyToken,
  checkRole(["Admin"]),
  adminStoreController.getStoreDetails,
);

router.get(
  "/dashboard/customers",
  verifyToken,
  checkRole(["Admin"]),
  adminStoreController.getCustomersDetails,
);

router.get(
  "/dashboard/customers/:id",
  verifyToken,
  checkRole(["Admin"]),
  adminStoreController.getCustomerDetail,
);

router.get(
  "/dashboard/users",
  verifyToken,
  checkRole(["Admin"]),
  adminStoreController.getUsersDetails,
);

router.get(
  "/dashboard/users/:id",
  verifyToken,
  checkRole(["Admin"]),
  adminStoreController.getUserDetail,
);
// Route lấy danh sách cửa hàng đã đăng ký thành công
router.get(
  "/approved-stores",
  verifyToken,
  checkRole(["Admin"]),
  async (req, res) => {
    try {
      const stores = await Store.findAll({
        where: { status: "APPROVED" },
        include: [
          {
            model: User,
            as: "owner",
            attributes: ["id", "username", "email"],
          },
        ],
      });

      // Route kiểm tra trạng thái shop C2C của tài khoản hiện tại
      router.get("/my-c2c-status", verifyToken, async (req, res) => {
        try {
          const c2cStore = await Store.findOne({
            where: {
              owner_id: req.user.userId,
              store_type: "C2C",
              status: "APPROVED",
            },
            order: [["created_at", "DESC"]],
          });

          res.json({
            success: true,
            data: {
              hasC2CStore: !!c2cStore,
              c2cStoreId: c2cStore ? c2cStore.id : null,
              storeName: c2cStore ? c2cStore.store_name : null,
            },
          });
        } catch (error) {
          res.status(500).json({ message: error.message });
        }
      });
      res.json({ success: true, data: stores });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
);

router.get("/my-c2c-status", verifyToken, async (req, res) => {
  try {
    const c2cStore = await Store.findOne({
      where: {
        owner_id: req.user.userId,
        store_type: "C2C",
        status: "APPROVED",
      },
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: {
        hasC2CStore: !!c2cStore,
        c2cStoreId: c2cStore ? c2cStore.id : null,
        storeName: c2cStore ? c2cStore.store_name : null,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get(
  "/my-store-status",
  verifyToken,
  adminStoreController.getMyStoreStatus,
);

router.put("/update-info", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const updatedStore = await authService.updateStoreInfo(
      userId,
      req.body || {},
    );

    return res.status(200).json({
      success: true,
      message: "Cập nhật thành công",
      data: updatedStore,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Lỗi hệ thống",
    });
  }
});

router.get("/my-report", verifyToken, async (req, res) => {
  try {
    const periodRaw = String(req.query.period || "month").toLowerCase();
    const period = ["day", "month", "quarter", "year"].includes(periodRaw)
      ? periodRaw
      : "month";

    const store = await Store.findOne({
      where: {
        owner_id: req.user.userId,
        status: "APPROVED",
      },
      order: [["created_at", "DESC"]],
    });

    if (!store) {
      return res.status(404).json({
        message: "Bạn chưa có shop để xem báo cáo",
      });
    }

    const { start, end, bucket } = getReportRangeByPeriod(period);

    const orders = await Order.findAll({
      where: {
        store_id: store.id,
        createdAt: {
          [Op.gte]: start,
          [Op.lt]: end,
        },
      },
      attributes: [
        "id",
        "total_amount",
        "shipping_fee",
        "order_status",
        "payment_status",
        "createdAt",
      ],
      order: [["created_at", "ASC"]],
    });

    let totalRevenue = 0;
    let fixedFee = 0;
    let paymentFee = 0;
    let shippingFee = 0;
    let serviceFee = 0;
    let returnFee = 0;
    let platformCost = 0;
    let netIncome = 0;
    let orderCount = 0;

    const timelineMap = new Map();

    for (const order of orders) {
      const orderStatus = String(order.order_status || "").toUpperCase();
      const paymentStatus = String(order.payment_status || "").toUpperCase();

      if (
        REPORT_EXCLUDED_ORDER_STATUSES.has(orderStatus) ||
        REPORT_EXCLUDED_PAYMENT_STATUSES.has(paymentStatus)
      ) {
        continue;
      }

      const shipping =
  toNumber(order.shipping_fee);

const amount =
  toNumber(order.total_amount)
  - shipping;
      const fixedPart = amount * toNumber(store.fixed_fee_rate);
      const paymentPart = amount * toNumber(store.payment_fee_rate);
      const servicePart = amount * toNumber(store.service_fee_rate);

      const returnCap =
        paymentStatus === "EXPRESS"
          ? toNumber(store.return_fee_cap_express)
          : toNumber(store.return_fee_cap_standard);

      const shouldApplyReturnFee =
        orderStatus === "RETURNED" ||
        orderStatus === "RETURN" ||
        orderStatus === "REFUND";

      const returnPart = shouldApplyReturnFee ? returnCap : 0;
      const platformPart = fixedPart + paymentPart + servicePart + returnPart;
      const incomePart = amount - platformPart;

      totalRevenue += amount;
      fixedFee += fixedPart;
      paymentFee += paymentPart;
      shippingFee += shipping;
      serviceFee += servicePart;
      returnFee += returnPart;
      platformCost += platformPart;
      netIncome += incomePart;
      orderCount += 1;

      const bucketKey = createBucketKey(order.createdAt, bucket);
      const current = timelineMap.get(bucketKey) || {
        label: bucketKey,
        revenue: 0,
        cost: 0,
        income: 0,
      };

      current.revenue += amount;
      current.cost += platformPart;
      current.income += incomePart;
      timelineMap.set(bucketKey, current);
    }

    return res.status(200).json({
      success: true,
      data: {
        storeId: store.id,
        storeName: store.store_name,
        period,
        range: {
          from: start.toISOString(),
          to: end.toISOString(),
        },
        orderCount,
        summary: {
          revenue: totalRevenue,
          fixedFee,
          paymentFee,
          serviceFee,
          returnFee,
          platformCost,
          netIncome,
          shippingFee,
        },
        timeline: Array.from(timelineMap.values()),
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Không thể tải báo cáo shop",
    });
  }
});

router.post("/check-c2c-availability", verifyToken, async (req, res) => {
  try {
    const { email, phone, store_name } = req.body;
    const userId = req.user.userId;

    if (!email || !phone || !store_name) {
      return res.status(400).json({
        message: "email, phone và store_name là bắt buộc",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPhone = String(phone).replace(/\D/g, "").trim();
    const normalizedStoreName = String(store_name).trim();

    const emailOwner = await User.findOne({
      where: { email: normalizedEmail },
      attributes: ["id", "email"],
    });

    const duplicatedPhoneStore = await Store.findOne({
      where: {
        contact_phone: normalizedPhone,
      },
      attributes: ["id", "store_name"],
    });

    const duplicatedStoreName = await Store.findOne({
      where: {
        store_name: {
          [Op.iLike]: normalizedStoreName,
        },
      },
      attributes: ["id", "store_name"],
    });

    const duplicateFlags = {
      email: !!emailOwner && emailOwner.id !== userId,
      phone: !!duplicatedPhoneStore,
      storeName: !!duplicatedStoreName,
    };

    if (
      duplicateFlags.email ||
      duplicateFlags.phone ||
      duplicateFlags.storeName
    ) {
      return res.status(409).json({
        message: "Dữ liệu bị trùng trong hệ thống",
        data: {
          duplicateFlags,
          duplicateMessages: {
            email: duplicateFlags.email
              ? "Email đã tồn tại trong hệ thống"
              : null,
            phone: duplicateFlags.phone
              ? "Số điện thoại đã được dùng cho shop khác"
              : null,
            storeName: duplicateFlags.storeName
              ? "Tên shop đã tồn tại, vui lòng chọn tên khác"
              : null,
          },
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        emailAvailable: true,
        phoneAvailable: true,
        storeNameAvailable: true,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Không thể kiểm tra dữ liệu trùng",
    });
  }
});

router.post(
  "/verify-c2c-identity",
  verifyToken,
  ...uploadStoreDocuments,
  async (req, res) => {
    try {
      const { identity_card, representative_name } = req.body;
      const frontFile = req.files?.front_id_image?.[0];
      const backFile = req.files?.back_id_image?.[0];

      if (!frontFile || !backFile) {
        return res.status(400).json({
          message: "Bạn phải tải đủ ảnh CCCD mặt trước và mặt sau",
        });
      }

      if (!/^\d{12}$/.test(String(identity_card || ""))) {
        return res.status(400).json({
          message: "Số CCCD không hợp lệ (phải đủ 12 số)",
        });
      }

      if (!String(representative_name || "").trim()) {
        return res.status(400).json({
          message: "Vui lòng nhập Họ và Tên để đối chiếu CCCD",
        });
      }

      await verifyCccdImages({
        frontImagePath: frontFile.path,
        backImagePath: backFile.path,
        expectedIdentityNumber: identity_card,
        expectedFullName: representative_name,
      });

      return res.status(200).json({
        success: true,
        message: "Xác thực CCCD thành công",
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Không thể xác thực CCCD",
      });
    }
  },
);

router.post(
  "/activate-c2c",
  verifyToken,
  ...uploadStoreDocuments,
  async (req, res) => {
    try {
      const {
        store_name,
        description,
        address,
        contact_email,
        contact_phone,
        identity_card,
        representative_name,
        bank_account,
        policy_accepted,
        service_fee_rate,
      } = req.body;

      if (!store_name) {
        return res.status(400).json({
          message: "store_name là bắt buộc",
        });
      }

      const owner = await User.findByPk(req.user.userId, {
        attributes: ["id", "email"],
      });

      const fallbackEmail = String(contact_email || owner?.email || "")
        .trim()
        .toLowerCase();
      const normalizedPhone = String(contact_phone || "")
        .replace(/\D/g, "")
        .trim();

      if (!fallbackEmail || !normalizedPhone) {
        return res.status(400).json({
          message: "contact_email và contact_phone là bắt buộc",
        });
      }

      const normalizedEmail = fallbackEmail;
      const normalizedStoreName = String(store_name).trim();

      const emailOwner = await User.findOne({
        where: { email: normalizedEmail },
        attributes: ["id", "email"],
      });
      if (emailOwner && emailOwner.id !== req.user.userId) {
        return res.status(409).json({
          message: "Email đã tồn tại trong hệ thống",
        });
      }

      const duplicatedPhoneStore = await Store.findOne({
        where: { contact_phone: normalizedPhone },
        attributes: ["id", "store_name"],
      });
      if (duplicatedPhoneStore) {
        return res.status(409).json({
          message: "Số điện thoại đã được dùng cho shop khác",
        });
      }

      const duplicatedStoreName = await Store.findOne({
        where: {
          store_name: {
            [Op.iLike]: normalizedStoreName,
          },
        },
        attributes: ["id", "store_name"],
      });
      if (duplicatedStoreName) {
        return res.status(409).json({
          message: "Tên shop đã tồn tại, vui lòng chọn tên khác",
        });
      }

      const frontFile = req.files?.front_id_image?.[0];
      const backFile = req.files?.back_id_image?.[0];

      if (!frontFile || !backFile) {
        return res.status(400).json({
          message:
            "Bạn phải tải đủ ảnh CCCD mặt trước và mặt sau để kích hoạt shop C2C",
        });
      }

      await verifyCccdImages({
        frontImagePath: frontFile.path,
        backImagePath: backFile.path,
        expectedIdentityNumber: identity_card,
        expectedFullName: representative_name,
      });

      if (!policy_accepted) {
        return res.status(400).json({
          message:
            "Bạn cần chấp nhận điều khoản phí và vận hành trước khi đăng ký bán hàng",
        });
      }

      const normalizedServiceFeeRate = Number(
        service_fee_rate ?? STORE_FEE_POLICY.defaultServiceFeeRate,
      );

      if (
        !Number.isFinite(normalizedServiceFeeRate) ||
        normalizedServiceFeeRate < 0 ||
        normalizedServiceFeeRate > STORE_FEE_POLICY.maxServiceFeeRate
      ) {
        return res.status(400).json({
          message: `service_fee_rate phải nằm trong khoảng 0 - ${STORE_FEE_POLICY.maxServiceFeeRate}`,
        });
      }

      if (
        normalizedServiceFeeRate > 0 &&
        normalizedServiceFeeRate < STORE_FEE_POLICY.minServiceFeeRate
      ) {
        return res.status(400).json({
          message: `service_fee_rate tối thiểu là ${STORE_FEE_POLICY.minServiceFeeRate} khi tham gia gói dịch vụ`,
        });
      }

      const dossierKey = buildDossierKey({
        identityCard: identity_card,
        taxCode: null,
        bankAccount: bank_account,
      });

      const registeredStoreCount =
        await storeRepository.countStoresByDossierKey(dossierKey);
      if (registeredStoreCount >= 3) {
        return res.status(400).json({
          message:
            "Một bộ hồ sơ (CCCD/MST/Ngân hàng) chỉ được đăng ký tối đa 3 tài khoản bán hàng",
        });
      }

      const existingStore = await Store.findOne({
        where: {
          owner_id: req.user.userId,
          store_type: "C2C",
          status: "APPROVED",
        },
        order: [["created_at", "DESC"]],
      });

      if (existingStore) {
        return res.status(200).json({
          success: true,
          message: "Tài khoản đã có shop C2C, dùng lại shop hiện tại.",
          data: existingStore,
        });
      }

      const newStore = await Store.create({
        owner_id: req.user.userId,
        store_name: normalizedStoreName,
        description,
        address: typeof address === "string" ? address.trim() : null,
        contact_email: normalizedEmail,
        contact_phone: normalizedPhone,
        identity_card, // Sửa: Bổ sung lưu CCCD cho C2C
        representative_name: representative_name || null,
        bank_account,
        dossier_key: dossierKey,
        store_type: "C2C",
        policy_accepted: true,
        policy_accepted_at: new Date(),
        fee_policy_version: STORE_POLICY_VERSION,
        fixed_fee_rate: STORE_FEE_POLICY.fixedFeeRate,
        payment_fee_rate: STORE_FEE_POLICY.paymentFeeRate,
        service_fee_rate: normalizedServiceFeeRate,
        return_fee_cap_standard: STORE_FEE_POLICY.returnFeeCapStandard,
        return_fee_cap_express: STORE_FEE_POLICY.returnFeeCapExpress,
        tax_threshold_per_year: STORE_FEE_POLICY.taxThresholdPerYear,
        vat_tax_rate: STORE_FEE_POLICY.vatTaxRate,
        pit_tax_rate: STORE_FEE_POLICY.pitTaxRate,
        status: "APPROVED", // C2C không cần chờ duyệt
      });

      res.status(201).json({
        success: true,
        message: "Kích hoạt shop C2C thành công!",
        data: newStore,
      });
    } catch (error) {
      res.status(error.statusCode || 500).json({
        message: error.message || "Không thể kích hoạt shop C2C",
      });
    }
  },
);

// ─── AI OCR: Quét ảnh Giấy Phép Kinh Doanh ───────────────────────────────────
// POST /api/admin/scan-license/:storeId
// Chỉ Admin được phép gọi. Không cần upload file —
// Backend tự tìm ảnh business_license đã lưu trong DB.
router.post(
  "/scan-license/:storeId",
  verifyToken,
  checkRole(["Admin"]),
  ocrController.scanBusinessLicense,
);

module.exports = router;
