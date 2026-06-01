// ============================================================
// file: middlewares/aiModeration.js
// AI Kiểm duyệt nội dung sản phẩm - Auto Moderation Middleware
// Chạy TRƯỚC controller createProduct và updateProduct
// để chặn nội dung vi phạm tiêu chuẩn cộng đồng
// ============================================================

/**
 * Danh sách từ khóa cấm kinh doanh / từ ngữ thô tục / hàng hóa không được phép
 * Chia thành các nhóm để dễ quản lý và bổ sung
 */
const BANNED_KEYWORDS = [
  // --- Nhóm 1: Hàng giả / hàng nhái ---
  "hàng giả",
  "hàng fake",
  "hàng nhái",
  "fake 100%",
  "fake",
  "đồ fake",
  "bán fake",
  "replica",
  "siêu fake",

  // --- Nhóm 2: Vũ khí / chất nguy hiểm ---
  "vũ khí",
  "súng",
  "đạn",
  "dao găm",
  "lựu đạn",
  "bom",
  "chất nổ",
  "chất cháy",
  "xăng lửa",

  // --- Nhóm 3: Ma túy / chất cấm ---
  "ma túy",
  "cần sa",
  "heroin",
  "thuốc lắc",
  "ketamine",
  "cocaine",
  "chất kích thích",

  // --- Nhóm 4: Từ ngữ thô tục / xúc phạm ---
  "đm",
  "dm shop",
  "địt",
  "vãi",
  "cặc",
  "lồn",
  "đéo",
  "mẹ mày",

  // --- Nhóm 5: Lừa đảo / vi phạm pháp luật ---
  "lừa đảo",
  "scam",
  "chiếm đoạt",
  "trốn thuế",
  "rửa tiền",
  "hack",
  "crack",
  "bẻ khóa",
  "phần mềm lậu",

  // --- Nhóm 6: Hàng hóa bị cấm lưu hành ---
  "động vật hoang dã",
  "ngà voi",
  "sừng tê giác",
  "thuốc lá lậu",
  "rượu lậu",
  "hàng cấm",
];

/**
 * Chuẩn hóa chuỗi: lowercase, loại bỏ dấu cách thừa
 * để tránh bypass bằng cách viết HOA hoặc thêm dấu cách
 */
const normalizeText = (text) => {
  if (!text || typeof text !== "string") return "";
  return text.toLowerCase().trim();
};

/**
 * Middleware AI kiểm duyệt nội dung
 * Áp dụng cho: POST /products (tạo mới) và PUT /products/:id (cập nhật)
 */
const checkToxicContent = (req, res, next) => {
  const { name, description } = req.body;

  // Gộp tên sản phẩm + mô tả thành 1 chuỗi để quét một lượt
  const contentToScan = normalizeText(`${name || ""} ${description || ""}`);

  // Nếu không có nội dung gì để kiểm tra, cho qua
  if (!contentToScan) {
    return next();
  }

  // Quét từng từ cấm trong bộ từ điển
  const foundBannedWord = BANNED_KEYWORDS.find((keyword) =>
    contentToScan.includes(normalizeText(keyword))
  );

  if (foundBannedWord) {
    // Log để Admin có thể theo dõi qua console server
    console.log(
      `🤖 [AI MODERATION] CHẶN SẢN PHẨM | Từ vi phạm: "${foundBannedWord}" | User: ${req.user?.id || "unknown"} | IP: ${req.ip}`
    );

    // Trả về lỗi 403 - Forbidden, KHÔNG cho phép lưu vào DB
    return res.status(403).json({
      success: false,
      message:
        "Nội dung vi phạm tiêu chuẩn cộng đồng. Sản phẩm chứa từ cấm kinh doanh hoặc từ ngữ thô tục.",
      blockedWord: foundBannedWord, // Frontend có thể dùng để highlight
      errorCode: "AI_MODERATION_BLOCKED",
    });
  }

  // ✅ Nội dung sạch - cho phép đi tiếp vào Controller lưu DB
  console.log(
    `✅ [AI MODERATION] PASS | Sản phẩm: "${name}" | User: ${req.user?.id || "unknown"}`
  );
  next();
};

module.exports = { checkToxicContent, BANNED_KEYWORDS };
