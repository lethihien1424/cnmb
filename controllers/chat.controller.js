// Backend/controllers/chat.controller.js
//
// API controller for the Customer Support AI Agent.
// Requires authentication (verifyToken middleware).

const chatService = require("../services/chat.service");
const Product = require("../models/product.model");
const Store = require("../models/store.model");

// POST /api/chat
const CHAT_TIMEOUT_MS = 30000; // 30 seconds max wait

// UUID regex for validation
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Build a context string from the product the user is currently viewing.
 * This is injected into the AI's system prompt so it knows "Cái này" / "Sản phẩm này"
 * refers to the product on the current page.
 */
const buildProductContext = async (productId) => {
  if (!productId || !UUID_REGEX.test(productId)) return "";

  try {
    const product = await Product.findByPk(productId, {
      attributes: [
        "id",
        "name",
        "price",
        "description",
        "color",
        "size",
        "stock_quantity",
        "status",
        "images",
      ],
      include: [
        {
          model: Store,
          as: "store",
          attributes: ["id", "store_name"],
        },
      ],
    });

    if (!product) {
      console.log(
        `[ChatController] Product not found for context: ${productId}`,
      );
      return "";
    }

    const priceFormatted = Number(product.price).toLocaleString("vi-VN");
    const colors = product.color || "không có";
    const sizes = product.size || "không có";
    const stock = product.stock_quantity ?? 0;
    const storeName = product.store?.store_name || "ShopHub";

    const contextText = `[NGỮ CẢNH HỆ THỐNG]: Khách hàng hiện đang xem trang chi tiết sản phẩm sau:
- Tên sản phẩm: ${product.name}
- Giá: ${priceFormatted}đ
- Màu sắc: ${colors}
- Kích thước: ${sizes}
- Tồn kho: ${stock}
- Cửa hàng: ${storeName}
${product.description ? `- Mô tả: ${product.description.substring(0, 300)}` : ""}

Nếu khách dùng đại từ chỉ định như "cái này", "sản phẩm này", "nó", "món này" → HIỂU là họ đang hỏi về sản phẩm trên. Dùng thông tin trên để trả lời NGAY mà KHÔNG cần gọi tool searchProducts.`;

    console.log(
      `[ChatController] Built product context for: "${product.name}" (${productId})`,
    );
    return contextText;
  } catch (err) {
    console.error("[ChatController] buildProductContext error:", err.message);
    return "";
  }
};

const sendMessage = async (req, res) => {
  try {
    const userId = req.user.id; // From JWT token (verifyToken middleware)
    const { message, context } = req.body;

    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập nội dung tin nhắn.",
      });
    }

    // Limit message length to prevent abuse
    const trimmedMessage = message.trim().substring(0, 2000);

    // Build product context if user is on a product detail page
    let contextText = "";
    if (context?.productId) {
      contextText = await buildProductContext(context.productId);
    }

    // Race between AI response and 30s timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("REQUEST_TIMEOUT")), CHAT_TIMEOUT_MS),
    );

    const aiPromise = chatService.chat(userId, trimmedMessage, contextText);
    const result = await Promise.race([aiPromise, timeoutPromise]);

    const responseData = {
      success: true,
      data: {
        reply: result.reply,
        conversationId: result.conversationId,
      },
    };

    // Pass through action data if AI triggered addToCartAndCheckout
    if (result.action) {
      responseData.data.action = result.action;
      responseData.data.actionData = result.data;
    }

    return res.status(200).json(responseData);
  } catch (error) {
    console.error("[ChatController] Error:", error.message);

    // Timeout — frontend gets immediate 504
    if (error.message === "REQUEST_TIMEOUT") {
      return res.status(504).json({
        success: false,
        reply:
          "Hệ thống AI đang phản hồi hơi chậm, bạn vui lòng gửi lại câu hỏi nhé.",
        error: "TIMEOUT",
      });
    }

    // Rate limit (429) — frontend gets immediate 429
    const isRateLimit =
      error.message?.includes("429") ||
      error.message?.includes("Too Many Requests") ||
      error.message?.includes("quota");

    if (isRateLimit) {
      return res.status(429).json({
        success: false,
        reply:
          "Xin lỗi, hiện tại hệ thống đang hỗ trợ quá nhiều khách hàng. Bạn vui lòng thử lại sau 1-2 phút nhé!",
        error: "RATE_LIMIT",
      });
    }

    // Other errors — frontend gets 500
    return res.status(500).json({
      success: false,
      reply: "Đã xảy ra lỗi kết nối, vui lòng thử lại sau.",
      error: "SERVER_ERROR",
    });
  }
};

// POST /api/chat/reset
const resetConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = chatService.resetConversation(userId);

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("[ChatController] Reset error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Không thể xóa lịch sử trò chuyện.",
    });
  }
};

module.exports = {
  sendMessage,
  resetConversation,
};
