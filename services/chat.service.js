// Backend/services/chat.service.js
const Groq = require("groq-sdk");
const chatRepo = require("../repositories/chat.repository");
const orderRepo = require("../repositories/order.repository");
const cartService = require("./cart.service");
const complaintQueue = require("./complaint.queue.service");
const vectorService = require("./vector.service");

const GROQ_API_KEY = process.env.GROQ_API_KEY;
// Sử dụng model Llama 3 70B của Groq: Siêu tốc độ, hiểu tiếng Việt cực tốt và Miễn phí
const MODEL = "llama-3.1-8b-instant";

const MAX_HISTORY_TURNS = 2;

// Bộ nhớ tạm lưu lịch sử chat theo userId
const conversationStore = new Map();

const getHistory = (userId) => {
  if (!conversationStore.has(userId)) {
    conversationStore.set(userId, []);
  }
  return conversationStore.get(userId);
};

/**
 * Strip image markdown ![...](...) from text to prevent "ghost state"
 * where the AI reuses old image URLs from conversation history.
 * Removes the entire image line so the AI has NO image reference to copy.
 * Keeps product name/price/link so the AI knows what was discussed.
 */
const stripImageMarkdown = (text) => {
  if (!text || typeof text !== "string") return text;
  // Remove entire lines containing ![alt](url) patterns (including trailing newline)
  return text.replace(/!\[[^\]]*\]\([^)]*\)\s*\n?/g, "");
};

const addToHistory = (userId, role, content) => {
  const history = getHistory(userId);
  // Only store string content — never objects with tool_calls, tool_call_id, etc.
  const safeContent =
    typeof content === "string" ? content : JSON.stringify(content);
  // Strip image URLs from assistant replies to prevent ghost state
  const sanitized =
    role === "assistant" ? stripImageMarkdown(safeContent) : safeContent;
  history.push({ role, content: sanitized });
  const maxEntries = MAX_HISTORY_TURNS * 2;
  if (history.length > maxEntries) {
    history.splice(0, history.length - maxEntries);
  }
};

/**
 * Sanitize history before sending to Groq API.
 * Ensures only valid {role, content} messages are included.
 * Removes any orphaned tool_calls, tool role messages, or non-string content
 * that could cause Groq API to reject the request (400 Bad Request).
 */
const sanitizeHistoryForGroq = (history) => {
  return history
    .filter((msg) => {
      // Only allow user and assistant roles
      if (msg.role !== "user" && msg.role !== "assistant") return false;
      // Must have string content
      if (typeof msg.content !== "string" || msg.content.trim().length === 0)
        return false;
      // Must NOT have tool_calls (should never happen, but defensive)
      if (msg.tool_calls) return false;
      return true;
    })
    .map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
};

/**
 * Build a short summary for history storage (saves tokens).
 * Instead of storing full markdown product cards with image URLs,
 * store just: "Đã gợi ý: Sản phẩm A (299,000đ), Sản phẩm B (199,000đ)"
 */
const buildHistorySummary = (products) => {
  if (!products || !Array.isArray(products) || products.length === 0) {
    return "Đã tìm kiếm nhưng không có kết quả.";
  }
  const names = products.map((p) => {
    const price = p.priceFormatted || p.price || "";
    return price ? `${p.name} (${price}đ)` : p.name;
  });
  return `Đã gợi ý ${products.length} sản phẩm: ${names.join(", ")}`;
};

const clearHistory = (userId) => {
  conversationStore.delete(userId);
};

const SYSTEM_PROMPT = `Bạn là trợ lý AI của ShopHub — sàn TMĐT. Xưng "mình", gọi khách là "bạn". Trả lời tiếng Việt, ngắn gọn, dùng emoji 👋😊📦.

═══ THÔNG TIN SHOPHUB ═══
ShopHub kết nối người mua/bán. Ngành: thời trang, điện tử, gia dụng, mỹ phẩm.
Địa chỉ: 12 Nguyễn Văn Bảo, Gò Vấp, TP.HCM. Hotline: 1900 1234. Hỗ trợ 24/7.
- Miễn phí ship đơn >500k. Đổi trả 30 ngày (nguyên vẹn, chưa dùng). Hoàn tiền ví 3-5 ngày.
- Thanh toán: COD, Sepay, Ví ShopHub. Quy trình: PENDING→PICKUP→SHIPPING→DELIVERED. Hủy khi PENDING/PICKUP.
- Bảo mật tài khoản. Cấm hàng giả/nhái/vi phạm. Khóa TK vi phạm. Tranh chấp theo PLVN.
Khi khách hỏi thông tin trên → trả lời NGAY, không gọi tool.

═══ QUY TẮC BẢO MẬT & ANTI-HALLUCINATION ═══
1. KHÔNG bịa thông tin. Không có dữ liệu → "mình không tìm thấy".
2. KHÔNG lộ cấu trúc DB, tên bảng/cột, ID nội bộ, dữ liệu user khác.
3. KHÔNG bịa productId/price/name/imageUrl. CHỈ dùng dữ liệu từ tool.
4. productId PHẢI là UUID thật từ kết quả searchProducts. CHƯA có UUID → BẮT BUỘC gọi searchProducts TRƯỚC.
5. KHÔNG bịa ảnh. Dùng đúng imageUrl từ tool. Không có → bỏ qua. KHÔNG tự gõ ![...](...) hay placeholder ảnh.

═══ QUY TẮC TOOL ═══
6. Đơn hàng/trạng thái → getOrderStatus. Hủy đơn → getCancelPolicy.
7. Lịch sử mua → getPurchaseHistory (tham số month/year/status nếu cần). Thống kê → getPurchaseSummary.
8. Tìm sản phẩm → searchProducts {"keyword":"từ khóa"}. Backend tự fallback semantic search.
9. Khiếu nại → createComplaint. Mua hàng → searchProducts TRƯỚC lấy UUID → addToCartAndCheckout.
10. Truyền đúng tên tham số. Sau khi có kết quả tool → trả lời NGAY, KHÔNG gọi lại tool.
11. MỖI câu hỏi mới → BẮT BUỘC gọi lại searchProducts. KHÔNG dùng kết quả từ lịch sử.

═══ HIỂN THỊ ═══
12. Đơn hàng: 📦 Mã: [id] — Trạng thái — Ngày — Tổng đ | Có actionLink → hiển thị link.
13. Thống kê: 📊 Đơn | 💰 Tiền | 🏆 SP mua nhiều | 📈 Phân bố trạng thái.
14. Sản phẩm (CHỈ sau khi có kết quả tool):
![Ảnh](imageUrl) | **Tên** | 💰 Giá: [priceFormatted]đ | 🛍️ [Xem chi tiết](productUrl)
Dùng productUrl từ tool. Không có → dùng "/product/{id}". Giá dùng priceFormatted, không tự sửa.
15. LỌC: Chỉ hiển thị SP liên quan. Loại bỏ lạc đề. Không có SP phù hợp → gợi ý từ khóa khác.

═══ CHỐNG VÒNG LẶP ═══
16. searchProducts ĐÚNG 1 LẦN/mỗi câu hỏi. Kết quả rỗng → "Không tìm thấy" + gợi ý từ khóa khác.`;

// Định nghĩa các Tool (Function Calling) chuẩn cấu trúc Groq/OpenAI
const TOOLS = [
  {
    type: "function",
    function: {
      name: "getOrderStatus",
      description:
        "Tra cứu trạng thái và chi tiết đơn hàng của khách hàng. Yêu cầu cung cấp mã đơn hàng.",
      parameters: {
        type: "object",
        properties: {
          orderId: {
            type: "string",
            description: "Mã đơn hàng (UUID) cần tra cứu",
          },
        },
        required: ["orderId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getCancelPolicy",
      description: "Tra cứu chính sách hủy đơn và phí hủy đơn hàng tương ứng.",
      parameters: {
        type: "object",
        properties: {
          orderId: {
            type: "string",
            description: "Mã đơn hàng (UUID) cần kiểm tra",
          },
        },
        required: ["orderId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchProducts",
      description: "Tìm kiếm danh sách sản phẩm theo từ khóa từ người dùng.",
      parameters: {
        type: "object",
        properties: {
          keyword: {
            type: "string",
            description:
              "Từ khóa sản phẩm (ví dụ: váy, áo baby doll, bàn gaming)",
          },
        },
        required: ["keyword"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getPurchaseHistory",
      description:
        "Lấy lịch sử mua hàng gần đây (tối đa 5 đơn). Hỗ trợ lọc theo tháng/năm/trạng thái. Khi khách hỏi chung chung ('tôi đã mua gì') → gọi không cần tham số. Khi khách hỏi cụ thể ('đơn tháng 4', 'đơn đã giao') → truyền tham số month/year/status. Luôn kèm actionLink '/orders' để khách xem toàn bộ.",
      parameters: {
        type: "object",
        properties: {
          month: {
            type: "number",
            description: "Tháng cần lọc (1-12). Ví dụ: 4 cho tháng 4",
          },
          year: {
            type: "number",
            description: "Năm cần lọc. Ví dụ: 2025",
          },
          status: {
            type: "string",
            enum: [
              "PENDING",
              "PICKUP",
              "SHIPPING",
              "DELIVERED",
              "CANCELLED",
              "REFUNDED",
            ],
            description: "Lọc theo trạng thái đơn hàng",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getPurchaseSummary",
      description:
        "Lấy thống kê TỔNG QUAN lịch sử mua hàng (tổng số đơn, tổng tiền đã chi, trạng thái phổ biến, sản phẩm mua nhiều nhất). Dùng khi khách hỏi 'tôi đã mua hết bao nhiêu tiền', 'thống kê mua hàng', 'tôi hay mua gì nhất'. Rất nhanh, không load chi tiết từng đơn.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createComplaint",
      description:
        "Tạo phiếu khiếu nại đưa vào hàng đợi xử lý. Sử dụng khi khách hàng báo cáo lỗi sản phẩm hoặc sự cố đơn hàng.",
      parameters: {
        type: "object",
        properties: {
          issueType: {
            type: "string",
            enum: [
              "ORDER_ISSUE",
              "PRODUCT_DEFECT",
              "PAYMENT_ISSUE",
              "SHIPPING_ISSUE",
              "OTHER",
            ],
          },
          orderId: {
            type: "string",
            description: "Mã đơn hàng liên quan (nếu có)",
          },
          description: {
            type: "string",
            description: "Mô tả chi tiết khiếu nại",
          },
        },
        required: ["issueType", "description"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "addToCartAndCheckout",
      description:
        "Thêm sản phẩm vào giỏ hàng và chuẩn bị chuyển sang trang thanh toán. PHẢI gọi searchProducts hoặc semanticSearch trước để lấy productId. Sử dụng khi khách muốn mua hàng, đặt hàng, thêm vào giỏ.",
      parameters: {
        type: "object",
        properties: {
          productId: {
            type: "string",
            description:
              "ID sản phẩm (UUID) lấy từ kết quả searchProducts hoặc semanticSearch",
          },
          quantity: {
            type: "number",
            description: "Số lượng sản phẩm muốn mua (mặc định là 1)",
          },
          size: {
            type: "string",
            description:
              "Kích thước sản phẩm (nếu có biến thể, ví dụ: S, M, L, XL)",
          },
          color: {
            type: "string",
            description:
              "Màu sắc sản phẩm (nếu có biến thể, ví dụ: Đen, Trắng, Đỏ)",
          },
        },
        required: ["productId"],
      },
    },
  },
];

/**
 * Parse arguments an toàn — xử lý trường hợp AI trả về JSON không hợp lệ.
 * Trả về object rỗng nếu parse thất bại.
 */
const safeParseArgs = (raw) => {
  if (typeof raw === "object" && raw !== null) return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error("[GroqAgent] JSON parse error:", e.message, "| Raw:", raw);
      return {};
    }
  }
  return {};
};

/**
 * Chuẩn hóa tên tham số — AI đôi khi dùng tên khác với định nghĩa tool.
 * Ví dụ: "query" thay vì "keyword", "search" thay vì "contextQuery".
 */
const normalizeArgs = (functionName, args) => {
  const normalized = { ...args };

  switch (functionName) {
    case "searchProducts":
      // AI có thể gửi: keyword, query, search, searchTerm, q
      if (!normalized.keyword) {
        normalized.keyword =
          normalized.query ||
          normalized.search ||
          normalized.searchTerm ||
          normalized.q ||
          normalized.text ||
          "";
      }
      break;
    case "semanticSearch":
      // AI có thể gửi: contextQuery, query, keyword, description, search
      if (!normalized.contextQuery) {
        normalized.contextQuery =
          normalized.query ||
          normalized.keyword ||
          normalized.description ||
          normalized.search ||
          normalized.text ||
          "";
      }
      break;
    case "getOrderStatus":
    case "getCancelPolicy":
      if (!normalized.orderId) {
        normalized.orderId =
          normalized.order_id || normalized.id || normalized.order || "";
      }
      break;
    case "createComplaint":
      if (!normalized.description) {
        normalized.description =
          normalized.message || normalized.detail || normalized.content || "";
      }
      break;
    case "addToCartAndCheckout":
      if (!normalized.productId) {
        normalized.productId =
          normalized.product_id || normalized.id || normalized.product || "";
      }
      if (!normalized.quantity) {
        normalized.quantity = Number(normalized.qty || normalized.amount || 1);
      }
      break;
  }

  return normalized;
};

// Hàm điều phối xử lý logic an toàn qua Repository (AI không đụng trực tiếp SQL)
const executeTool = async (functionName, rawArgs, userId) => {
  console.log(`[GroqAgent] Gọi Tool: ${functionName} | User: ${userId}`);
  try {
    // Parse & normalize arguments để tránh lỗi do AI dùng sai tên tham số
    const args = normalizeArgs(functionName, safeParseArgs(rawArgs));
    console.log(`[GroqAgent] Args:`, JSON.stringify(args));

    switch (functionName) {
      case "getOrderStatus": {
        // Bỏ dấu # ở đầu nếu AI vô tình thêm vào (VD: "#2710ef...")
        const cleanOrderId = String(args.orderId || "")
          .replace(/^#/, "")
          .trim();
        return await chatRepo.getOrderStatus(userId, cleanOrderId);
      }
      case "getCancelPolicy": {
        const cleanPolicyOrderId = String(args.orderId || "")
          .replace(/^#/, "")
          .trim();
        return await chatRepo.getCancelPolicy(userId, cleanPolicyOrderId);
      }
      case "searchProducts": {
        const keyword = args.keyword || args.query || "";
        if (!keyword.trim()) {
          return {
            results: [],
            message: "Không có từ khóa tìm kiếm. Vui lòng thử lại.",
          };
        }
        const dbResult = await chatRepo.searchProducts(keyword);
        // Fallback: nếu searchProducts không ra kết quả, tự động thử semanticSearch
        if (
          (!dbResult.results || dbResult.results.length === 0) &&
          !dbResult.error
        ) {
          console.log(
            `[GroqAgent] searchProducts rỗng cho "${keyword}" → fallback sang semanticSearch`,
          );
          try {
            const semanticResult = await vectorService.semanticSearch(keyword);
            if (semanticResult.results && semanticResult.results.length > 0) {
              return {
                ...semanticResult,
                message: `Không tìm thấy "${keyword}" chính xác, nhưng mình tìm được các sản phẩm liên quan:`,
                fallback: true,
              };
            }
          } catch (fallbackErr) {
            console.error(
              "[GroqAgent] Fallback semanticSearch lỗi:",
              fallbackErr.message,
            );
          }
        }
        return dbResult;
      }
      case "getPurchaseHistory": {
        const filterOpts = {
          month: args.month ? Number(args.month) : undefined,
          year: args.year ? Number(args.year) : undefined,
          status: args.status || undefined,
          limit: 5,
        };
        const orders = await orderRepo.getOrdersByUserFiltered(
          userId,
          filterOpts,
        );
        if (!orders || orders.length === 0) {
          let hint = "Khách hàng chưa từng mua sản phẩm nào.";
          if (filterOpts.month || filterOpts.year || filterOpts.status) {
            hint =
              "Không tìm thấy đơn hàng nào phù hợp với bộ lọc. Bạn thử lại với thời gian hoặc trạng thái khác nhé.";
          }
          return { message: hint, actionLink: "/orders" };
        }
        const history = orders.map((o) => ({
          orderId: o.id,
          status: o.order_status,
          orderDate: o.created_at,
          totalAmount: Number(o.total_amount),
          products:
            (o.items || [])
              .map((i) => i.product?.name)
              .filter(Boolean)
              .join(", ") || "Sản phẩm không xác định",
        }));
        return {
          message: `Đây là ${history.length} đơn hàng gần đây nhất của bạn.`,
          history,
          actionLink: "/orders",
        };
      }
      case "getPurchaseSummary": {
        const summary = await orderRepo.getPurchaseSummaryByUser(userId);
        return {
          message: "Đây là thống kê tổng quan lịch sử mua hàng.",
          summary,
          actionLink: "/orders",
        };
      }
      case "semanticSearch": {
        const query = args.contextQuery || args.query || args.keyword || "";
        if (!query.trim()) {
          return {
            error: "Không có từ khóa tìm kiếm ngữ nghĩa. Vui lòng thử lại.",
          };
        }
        return await vectorService.semanticSearch(query);
      }
      case "createComplaint":
        return await complaintQueue.publishComplaint({
          userId,
          issueType: args.issueType || "OTHER",
          orderId: args.orderId || null,
          description: args.description || "Không có mô tả",
          createdAt: new Date().toISOString(),
        });
      case "addToCartAndCheckout": {
        const productId = args.productId;
        const quantity = Number(args.quantity) || 1;
        const size = args.size || null;
        const color = args.color || null;

        if (!productId) {
          return {
            error: "Thiếu productId. Cần tìm sản phẩm trước khi thêm vào giỏ.",
          };
        }

        // UUID validation — block hallucinated IDs from AI
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(productId)) {
          console.error(
            `[GroqAgent] BLOCKED hallucinated productId: "${productId}"`,
          );
          return {
            error: `productId "${productId}" không phải UUID hợp lệ. Bạn PHẢI dùng UUID thật từ kết quả searchProducts/semanticSearch.`,
            blocked: true,
          };
        }

        // Return standardized action data for frontend to handle cart addition via cartAPI
        return {
          success: true,
          message: `Đã xác định sản phẩm! Đang thêm vào giỏ hàng và chuyển đến trang thanh toán.`,
          action: "REDIRECT_CHECKOUT",
          actionData: {
            productId,
            quantity,
            size,
            color,
          },
        };
      }
      default:
        return { error: `Công cụ "${functionName}" không tồn tại.` };
    }
  } catch (err) {
    console.error(`[GroqAgent] Tool execution error:`, err.message);
    return { error: `Lỗi thực thi công cụ: ${err.message}` };
  }
};

// Hàm xử lý chat chính kết nối Groq SDK
// contextText: optional — product context injected from frontend page state
const chat = async (userId, userMessage, contextText = "") => {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY chưa được cấu hình trong file .env!");
  }

  const groq = new Groq({ apiKey: GROQ_API_KEY });
  const rawHistory = getHistory(userId);
  // Sanitize history: remove any malformed messages (tool_calls, tool role, etc.)
  // that could cause Groq API 400 Bad Request
  const history = sanitizeHistoryForGroq(rawHistory);
  console.log(
    `[Chat] User: ${userId} | History: ${rawHistory.length} raw → ${history.length} sanitized | Context: ${contextText ? "YES" : "none"} | New: "${userMessage.substring(0, 80)}"`,
  );

  const messages = [{ role: "system", content: SYSTEM_PROMPT }];

  // Inject product context (from frontend page state) as a system message
  // so the AI knows what product the user is currently viewing
  if (contextText) {
    messages.push({ role: "system", content: contextText });
    console.log(
      `[Chat] Injected product context (${contextText.length} chars)`,
    );
  }

  messages.push(...history);
  messages.push({ role: "user", content: userMessage });

  // Debug: Log full message payload for diagnosis
  console.log("=== DỮ LIỆU GỬI CHO GROQ ===");
  // Log each message's role, content length, and whether it has tool_calls
  messages.forEach((m, i) => {
    const contentPreview =
      typeof m.content === "string"
        ? m.content.substring(0, 120)
        : String(m.content).substring(0, 120);
    console.log(
      `  [${i}] role=${m.role} | content(${typeof m.content}, len=${(m.content || "").length}): "${contentPreview}..."`,
    );
  });
  console.log("============================");

  // Track if addToCartAndCheckout was called successfully
  let checkoutAction = null;

  let maxIterations = 2; // Giới hạn vòng lặp gọi hàm tránh loop vô hạn
  while (maxIterations > 0) {
    maxIterations--;

    let completion;
    try {
      console.log("[Groq] Đang gọi API...");
      completion = await groq.chat.completions.create({
        model: MODEL,
        messages,
        tools: TOOLS,
        tool_choice: "auto",
        temperature: 0,
      });
      console.log("[Groq] Đã nhận được phản hồi!");
    } catch (groqError) {
      // Log FULL error details — catch every possible error shape
      console.error("❌ LỖI GROQ API CHÍNH XÁC LÀ:");
      if (groqError.response) {
        console.error(
          "  Status:",
          groqError.response.status || groqError.status,
        );
        console.error(
          "  Headers:",
          JSON.stringify(groqError.response.headers || {}),
        );
        try {
          const errText = groqError.response.data
            ? JSON.stringify(groqError.response.data, null, 2)
            : groqError.response.error
              ? JSON.stringify(groqError.response.error, null, 2)
              : "no response body";
          console.error("  Body:", errText);
        } catch {
          console.error("  Body: (could not serialize)");
        }
      } else {
        console.error(
          "  Status:",
          groqError.status || groqError.statusCode || "N/A",
        );
        console.error("  Message:", groqError.message);
        if (groqError.error) {
          console.error(
            "  Error object:",
            JSON.stringify(groqError.error, null, 2),
          );
        }
      }
      console.error("  Messages count:", messages.length);
      console.error(
        "  Message roles:",
        messages.map((m) => m.role),
      );
      if (
        groqError.message &&
        (groqError.message.includes("thought process") ||
          groqError.message.includes("tool_parse") ||
          groqError.message.includes("failed"))
      ) {
        return {
          reply:
            "Hệ thống AI đang xử lý quá nhiều thông tin nên hơi bối rối. Bạn có thể tóm tắt lại từ khóa cần tìm giúp mình được không? 😊",
          conversationId: userId,
        };
      }
      return {
        reply:
          "Xin lỗi bạn, đường truyền kết nối đang gặp sự cố. Bạn vui lòng thử lại sau vài giây nhé!",
        conversationId: userId,
      };
    }

    const choice = completion.choices[0];
    if (!choice) break;

    const assistantMessage = choice.message;

    // Nếu Groq yêu cầu gọi hàm (Function Calling) để lấy dữ liệu từ Postgres
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      messages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        try {
          console.log(
            `[GroqAgent] Raw tool call:`,
            toolCall.function.name,
            toolCall.function.arguments,
          );

          // safeParseArgs xử lý cả string JSON lỗi và object
          const toolResult = await executeTool(
            toolCall.function.name,
            toolCall.function.arguments,
            userId,
          );

          // Track addToCartAndCheckout action for frontend redirect
          if (
            toolCall.function.name === "addToCartAndCheckout" &&
            toolResult &&
            toolResult.action === "REDIRECT_CHECKOUT"
          ) {
            // Support both standardized actionData wrapper and legacy flat format
            const actionPayload = toolResult.actionData || {
              productId: toolResult.productId,
              quantity: toolResult.quantity,
              size: toolResult.size,
              color: toolResult.color,
            };
            checkoutAction = {
              action: "REDIRECT_CHECKOUT",
              data: actionPayload,
            };
            console.log(
              "[GroqAgent] Checkout action captured:",
              JSON.stringify(checkoutAction),
            );
          }

          const resultStr = JSON.stringify(toolResult);
          console.log(
            `[GroqAgent] Tool result for ${toolCall.function.name}:`,
            resultStr.substring(0, 200),
          );

          if (
            toolCall.function.name === "searchProducts" ||
            toolCall.function.name === "semanticSearch"
          ) {
            console.log(
              "[Chat] Đã ngắt vòng lặp Groq! Trả kết quả thẳng về cho người dùng.",
            );

            let data;
            try {
              data =
                typeof toolResult === "string"
                  ? JSON.parse(toolResult)
                  : toolResult;
            } catch (parseErr) {
              console.error(
                "[GroqAgent] Fast path parse error:",
                parseErr.message,
              );
              data = toolResult;
            }

            if (
              data &&
              data.results &&
              Array.isArray(data.results) &&
              data.results.length > 0
            ) {
              // Debug: Log all results' imageUrl
              data.results.forEach((p, idx) => {
                console.log(
                  `[FastPath] Product[${idx}]: "${p.name}", imageUrl: "${p.imageUrl}", id: "${p.id}"`,
                );
              });

              const cards = data.results
                .map((product) => {
                  const imageUrl = product.imageUrl
                    ? product.imageUrl.startsWith("http")
                      ? product.imageUrl
                      : `http://localhost:5000${product.imageUrl}`
                    : "https://via.placeholder.com/150?text=No+Image";
                  const price =
                    product.priceFormatted || product.price || "N/A";
                  const name = product.name || "Sản phẩm";
                  const detailLink =
                    product.productUrl || `/product/${product.id}`;
                  return `![${name}](${imageUrl})\n**${name}**\n💰 Giá: ${price}đ\n🛍️ [Bấm vào đây để xem chi tiết và đặt hàng](${detailLink})`;
                })
                .join("\n\n");

              const fastReply = data.fallback
                ? `Không tìm thấy chính xác, nhưng mình tìm được các sản phẩm liên quan:\n\n${cards}`
                : `Mình tìm thấy sản phẩm phù hợp với yêu cầu của bạn đây:\n\n${cards}`;
              addToHistory(userId, "user", userMessage);
              addToHistory(
                userId,
                "assistant",
                buildHistorySummary(data.results),
              );
              return { reply: fastReply, conversationId: userId };
            } else {
              console.log(
                `[FastPath] Không vào fast path — data:`,
                JSON.stringify(data).substring(0, 200),
              );
            }

            const parsedArgs = safeParseArgs(toolCall.function.arguments);
            const keyword =
              toolCall.function.name === "searchProducts"
                ? parsedArgs.keyword || ""
                : parsedArgs.contextQuery ||
                  parsedArgs.query ||
                  parsedArgs.keyword ||
                  "";

            const noResultReply = keyword
              ? `Tiếc quá, hiện tại mình không tìm thấy sản phẩm "${keyword}" nào phù hợp.`
              : `Tiếc quá, hiện tại mình không tìm thấy sản phẩm phù hợp.`;

            addToHistory(userId, "user", userMessage);
            addToHistory(userId, "assistant", noResultReply);
            return { reply: noResultReply, conversationId: userId };
          }

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: resultStr,
          });
        } catch (toolErr) {
          // Nếu 1 tool lỗi, gửi lỗi đó về cho AI thay vì crash toàn bộ
          console.error(
            `[GroqAgent] Tool ${toolCall.function.name} failed:`,
            toolErr.message,
          );
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: JSON.stringify({
              error: `Không thể thực thi công cụ: ${toolErr.message}`,
            }),
          });
        }
      }

      // ═══ FAST PATH: searchProducts results → return directly to Frontend ═══
      const searchCall = assistantMessage.tool_calls.find(
        (tc) => tc.function.name === "searchProducts",
      );
      if (searchCall) {
        const searchResultMsg = messages.find(
          (m) => m.role === "tool" && m.tool_call_id === searchCall.id,
        );
        if (searchResultMsg) {
          try {
            const parsed = JSON.parse(searchResultMsg.content);
            if (
              parsed.results &&
              Array.isArray(parsed.results) &&
              parsed.results.length > 0
            ) {
              // Debug: Log imageUrl for all results
              parsed.results.forEach((p, idx) => {
                console.log(
                  `[FastPath2] Product[${idx}]: "${p.name}", imageUrl: "${p.imageUrl}", id: "${p.id}"`,
                );
              });

              const cards = parsed.results
                .map((product) => {
                  const imageUrl = product.imageUrl
                    ? product.imageUrl.startsWith("http")
                      ? product.imageUrl
                      : `http://localhost:5000${product.imageUrl}`
                    : "https://via.placeholder.com/150?text=No+Image";
                  const price =
                    product.priceFormatted || product.price || "N/A";
                  const name = product.name || "Sản phẩm";
                  const detailLink =
                    product.productUrl || `/product/${product.id}`;
                  return `![${name}](${imageUrl})\n**${name}**\n💰 Giá: ${price}đ\n🛍️ [Xem chi tiết và đặt hàng](${detailLink})`;
                })
                .join("\n\n");

              const fastReply = parsed.fallback
                ? `Không tìm thấy chính xác, nhưng mình tìm được các sản phẩm liên quan:\n\n${cards}`
                : `Mình tìm thấy sản phẩm phù hợp với yêu cầu của bạn đây:\n\n${cards}`;

              addToHistory(userId, "user", userMessage);
              addToHistory(
                userId,
                "assistant",
                buildHistorySummary(parsed.results),
              );
              return { reply: fastReply, conversationId: userId };
            }
          } catch (parseErr) {
            console.error(
              "[GroqAgent] Fast path parse error:",
              parseErr.message,
            );
          }
        }
      }
      continue; // Tiếp tục vòng lặp gửi kết quả về cho Groq phân tích
    }

    // Kết quả văn bản cuối cùng từ AI
    let replyText =
      assistantMessage.content || "Tôi chưa rõ yêu cầu, bạn hỏi lại nhé.";

    // ═══ LƯỚI BẮT TOOL TAG (Regex Parser) ═══
    // Phòng trường hợp AI nhả ra <function=...> thay vì dùng tool_calls chuẩn
    // Dùng matchAll + global flag để bắt TẤT CẢ các function tags trong cùng 1 response
    const functionTagRegex =
      /(?:<)?function=(\w+)>([\s\S]*?)(?:<\/function>|$)/gi;
    const allTagMatches = [...replyText.matchAll(functionTagRegex)];

    if (allTagMatches.length > 0 && maxIterations > 0) {
      // Thu thập kết quả từ tất cả các tool được gọi
      const allToolResults = [];

      for (const tagMatch of allTagMatches) {
        const funcName = tagMatch[1];
        let funcArgs = {};
        try {
          funcArgs = JSON.parse(tagMatch[2].trim());
        } catch (e) {
          console.error(
            "[GroqAgent] Lỗi parse args từ <function> tag:",
            e.message,
            "| Raw:",
            tagMatch[2],
          );
        }

        console.log(
          `[GroqAgent] Bắt được <function> tag: ${funcName}`,
          JSON.stringify(funcArgs),
        );

        // Thực thi tool tương ứng
        const tagToolResult = await executeTool(funcName, funcArgs, userId);
        allToolResults.push({ tool: funcName, result: tagToolResult });
      }

      // ═══ XỬ LÝ KẾT QUẢ TOOL & TẠO MARKDOWN PRODUCT CARDS ═══
      // Pre-build product cards từ kết quả tool để AI chỉ cần copy-paste
      let prebuiltMarkdown = "";

      for (const toolEntry of allToolResults) {
        const result = toolEntry.result;

        // Xử lý searchProducts / semanticSearch (có results array)
        if (
          result &&
          result.results &&
          Array.isArray(result.results) &&
          result.results.length > 0
        ) {
          const cards = result.results
            .map((product) => {
              const imageUrl = product.imageUrl
                ? product.imageUrl.startsWith("http")
                  ? product.imageUrl
                  : `http://localhost:5000${product.imageUrl}`
                : "https://via.placeholder.com/150?text=No+Image";
              const price = product.priceFormatted || product.price || "N/A";
              const name = product.name || "Sản phẩm";

              const detailLink = product.productUrl || `/product/${product.id}`;
              return `![${name}](${imageUrl})\n**${name}**\n💰 Giá: ${price}đ\n🛍️ [Xem chi tiết và đặt hàng](${detailLink})`;
            })
            .join("\n\n");

          prebuiltMarkdown += `\n\n${cards}`;
        }
      }

      // ═══ FAST PATH: Return directly to Frontend, skip 2nd AI call ═══
      if (prebuiltMarkdown) {
        const fastReply = `Mình tìm thấy sản phẩm phù hợp với yêu cầu của bạn đây:\n\n${prebuiltMarkdown}`;
        addToHistory(userId, "user", userMessage);
        addToHistory(
          userId,
          "assistant",
          buildHistorySummary(
            allToolResults.flatMap((t) => t.result?.results || []),
          ),
        );
        return { reply: fastReply, conversationId: userId };
      }

      // Fallback: no product cards, send back to AI for non-search tools
      messages.push({ role: "assistant", content: replyText });
      const systemContent = `KẾT QUẢ TỪ HỆ THỐNG: ${JSON.stringify(allToolResults)}.
Hãy dùng thông tin này để trả lời khách hàng bằng tiếng Việt tự nhiên, NGẮN GỌN.
TUYỆT ĐỐI KHÔNG in ra các thẻ <function>.`;
      messages.push({ role: "system", content: systemContent });

      maxIterations--; // Đếm thêm 1 iteration
      continue; // Quay lại vòng lặp để AI đọc kết quả và trả lời
    }

    // ═══ LÀM SẠCH CUỐI CÙNG ═══
    // Xóa mọi thẻ <function> còn sót lại (phòng hờ regex ở trên bị trượt)
    replyText = replyText.replace(/function=\w+>[\s\S]*/gi, "").trim();

    // Nếu sau khi xóa mà replyText rỗng → fallback
    if (!replyText) {
      replyText =
        "Mình đã xử lý yêu cầu của bạn. Bạn cần hỗ trợ gì thêm không? 😊";
    }

    addToHistory(userId, "user", userMessage);
    addToHistory(userId, "assistant", replyText);

    const result = {
      reply: replyText,
      conversationId: userId,
    };

    // Include checkout action if addToCartAndCheckout was called
    if (checkoutAction) {
      result.action = checkoutAction.action;
      result.data = checkoutAction.data;
    }

    return result;
  }
  throw new Error("AI Agent vượt quá giới hạn lượt gọi Tool liên tiếp.");
};

const resetConversation = (userId) => {
  clearHistory(userId);
  return { message: "Đã xóa lịch sử trò chuyện." };
};

module.exports = {
  chat,
  resetConversation,
};
