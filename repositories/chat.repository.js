// Backend/repositories/chat.repository.js
//
// Secure data-access layer for the Customer Support AI Agent.
// All queries enforce userId boundary — AI never accesses other users' data.

const { Op } = require("sequelize");
const { Order, OrderDetail, Product, Store, Category } = require("../models");

/**
 * Loại bỏ dấu tiếng Việt để tìm kiếm linh hoạt.
 * "váy" → "vay", "Áo sơ mi" → "Ao so mi"
 */
const removeVietnameseTones = (str) => {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Loại bỏ combining diacritical marks
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9\s]/g, "") // Loại bỏ ký tự đặc biệt
    .trim();
};

/**
 * Get order status and details for a specific user.
 * Enforces: buyer_id = userId
 */
const getOrderStatus = async (userId, orderId) => {
  const order = await Order.findOne({
    where: { id: orderId, buyer_id: userId },
    include: [
      {
        model: OrderDetail,
        as: "items",
        attributes: ["id", "product_name", "quantity", "price"],
      },
      {
        model: Store,
        as: "store",
        attributes: ["id", "store_name"],
      },
    ],
  });

  if (!order) {
    return {
      found: false,
      message: "Không tìm thấy đơn hàng hoặc bạn không có quyền truy cập.",
    };
  }

  return {
    found: true,
    orderId: order.id,
    status: order.order_status,
    paymentStatus: order.payment_status,
    totalAmount: order.total_amount,
    shippingFee: order.shipping_fee,
    shippingAddress: order.shipping_address,
    paymentMethod: order.payment_method,
    createdAt: order.createdAt,
    store: order.store?.store_name || "N/A",
    items: (order.items || []).map((item) => ({
      name: item.product_name,
      quantity: item.quantity,
      price: item.price,
    })),
  };
};

/**
 * Get cancellation policy and fee for a specific order.
 * Enforces: buyer_id = userId
 */
const getCancelPolicy = async (userId, orderId) => {
  const order = await Order.findOne({
    where: { id: orderId, buyer_id: userId },
    include: [
      {
        model: Store,
        as: "store",
        attributes: [
          "id",
          "store_name",
          "return_fee_cap_standard",
          "return_fee_cap_express",
        ],
      },
    ],
  });

  if (!order) {
    return {
      found: false,
      message: "Không tìm thấy đơn hàng hoặc bạn không có quyền truy cập.",
    };
  }

  // Determine if order can be cancelled
  const cancellableStatuses = ["PENDING", "CONFIRMED", "PROCESSING"];
  const canCancel = cancellableStatuses.includes(order.order_status);

  // Calculate cancellation fee
  let cancelFee = 0;
  if (canCancel && order.store) {
    const isExpress =
      order.shipping_service_type === "express" ||
      order.shipping_provider?.toLowerCase().includes("express");
    const feeCap = isExpress
      ? order.store.return_fee_cap_express || 0
      : order.store.return_fee_cap_standard || 0;
    cancelFee = Math.min(order.shipping_fee || 0, feeCap);
  }

  return {
    found: true,
    orderId: order.id,
    currentStatus: order.order_status,
    canCancel,
    cancelFee,
    shippingFee: order.shipping_fee,
    totalAmount: order.total_amount,
    store: order.store?.store_name || "N/A",
    message: canCancel
      ? `Đơn hàng có thể hủy. Phí hủy dự kiến: ${cancelFee.toLocaleString("vi-VN")}đ`
      : `Đơn hàng đang ở trạng thái "${order.order_status}" nên không thể hủy.`,
  };
};

/**
 * Search products by keyword.
 * Only returns AVAILABLE products from approved stores.
 */
const searchProducts = async (keyword) => {
  console.log(`[AI Search] Bắt đầu tìm trong DB từ khóa: "${keyword}"`);

  if (!keyword || keyword.trim().length === 0) {
    return { results: [], message: "Vui lòng nhập từ khóa." };
  }

  const safeKeyword = keyword.trim();
  const searchTerm = `%${safeKeyword}%`;
  // Tạo phiên bản không dấu để tìm kiếm linh hoạt (váy → vay)
  const keywordNoTones = removeVietnameseTones(safeKeyword);
  const searchTermNoTones = `%${keywordNoTones}%`;

  try {
    const products = await Product.findAll({
      where: {
        [Op.and]: [
          {
            [Op.or]: [
              // Tìm với từ khóa gốc (có dấu)
              { name: { [Op.iLike]: searchTerm } },
              { description: { [Op.iLike]: searchTerm } },
              { "$store.store_name$": { [Op.iLike]: searchTerm } },
              // Tìm với từ khóa không dấu (fallback)
              ...(keywordNoTones !== safeKeyword
                ? [
                    { name: { [Op.iLike]: searchTermNoTones } },
                    { description: { [Op.iLike]: searchTermNoTones } },
                    { "$store.store_name$": { [Op.iLike]: searchTermNoTones } },
                  ]
                : []),
            ],
          },
        ],
      },
      attributes: ["id", "name", "price", "stock_quantity", "status", "images"],
      include: [
        {
          model: Store,
          as: "store",
          attributes: ["id", "store_name"],
        },
      ],
      limit: 5,
      paranoid: false,
      order: [["created_at", "DESC"]],
    });

    console.log(
      `[AI Search] Đã tìm thấy ${products.length} sản phẩm khớp trong Database!`,
    );

    if (products.length === 0) {
      return {
        results: [],
        message: `Không tìm thấy sản phẩm nào khớp với từ khóa "${safeKeyword}".`,
      };
    }

    return {
      results: products.map((p) => {
        // Parse images: may be PostgreSQL ARRAY, JSON string, or plain string
        let imageUrl = null;
        try {
          const raw = p.images;
          let imgs;
          if (Array.isArray(raw)) {
            imgs = raw;
          } else if (typeof raw === "string") {
            try {
              imgs = JSON.parse(raw);
            } catch {
              imgs = [raw];
            }
          } else {
            imgs = [];
          }
          if (Array.isArray(imgs) && imgs.length > 0) {
            imageUrl = imgs[0];
          }
        } catch (_) {
          imageUrl = null;
        }
        // Prepend backend domain for relative image paths
        if (
          imageUrl &&
          typeof imageUrl === "string" &&
          imageUrl.startsWith("/")
        ) {
          imageUrl = `http://localhost:5000${imageUrl}`;
        }
        const priceNum = Number(p.price);
        const frontendBaseUrl =
          process.env.FRONTEND_URL || "http://localhost:5173";
        return {
          id: p.id,
          name: p.name,
          price: priceNum,
          priceFormatted: priceNum.toLocaleString("vi-VN"),
          stockQuantity: p.stock_quantity,
          storeName: p.store?.store_name || "Cửa hàng",
          imageUrl,
          productUrl: `${frontendBaseUrl}/product/${p.id}`,
        };
      }),
      total: products.length,
    };
  } catch (error) {
    console.error("[AI Search Error]:", error);
    return { error: "Lỗi truy vấn cơ sở dữ liệu." };
  }
};

/**
 * Get store info (public, no userId boundary needed).
 */
const getStoreInfo = async (storeId) => {
  const store = await Store.findOne({
    where: { id: storeId, status: "APPROVED" },
    attributes: ["id", "store_name", "description", "address"],
  });

  if (!store) {
    return { found: false, message: "Không tìm thấy cửa hàng." };
  }

  return {
    found: true,
    store: {
      id: store.id,
      name: store.store_name,
      description: store.description,
      address: store.address,
    },
  };
};

module.exports = {
  getOrderStatus,
  getCancelPolicy,
  searchProducts,
  getStoreInfo,
};
