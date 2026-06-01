// /**
//  * controllers/ocr.controller.js
//  *
//  * Controller xử lý AI OCR — Quét ảnh Giấy Phép Kinh Doanh (GPKD)
//  * Route: POST /api/admin/scan-license/:storeId
//  *
//  * Cột DB lưu ảnh: business_license
//  *   - Nếu đăng ký qua FormData có file → lưu full URL: http://localhost:5000/uploads/document-xxx.jpg
//  *   - Nếu đăng ký JSON không file → lưu text số GPKD (AI sẽ báo lỗi, không phải file ảnh)
//  */
// //D:\CNM_cu\CongNgheMoi\Backend\controllers\ocr.controller.js
// const fs = require("fs");
// const path = require("path");
// const Tesseract = require("tesseract.js");
// const { Store } = require("../models");
// const { detectRedStamp } = require("../services/ai.service");

// // ─── Helpers ────────────────────────────────────────────────────────────────

// /**
//  * Chuẩn hóa chuỗi: bỏ dấu tiếng Việt, uppercase, gộp khoảng trắng.
//  */
// const normalizeText = (value) =>
//   String(value || "")
//     .normalize("NFD")
//     .replace(/[\u0300-\u036f]/g, "")
//     .toUpperCase()
//     .replace(/\s+/g, " ")
//     .trim();

// /**
//  * Trích xuất Mã Số Thuế từ văn bản OCR thô.
//  * Ưu tiên dạng 10 chữ số (doanh nghiệp) trước.
//  */
// const extractTaxCode = (text) => {
//   // Dạng 10-3: 1234567890-123
//   const longMatch = text.match(/\b\d{10}-\d{3}\b/);
//   if (longMatch) return longMatch[0];

//   // Dạng 10 chữ số
//   const shortMatches = text.match(/\b\d{10}\b/g);
//   if (shortMatches?.length) return shortMatches[0];

//   // Dạng 13 chữ số liền
//   const veryLong = text.match(/\b\d{13}\b/);
//   if (veryLong) return veryLong[0];

//   return null;
// };

// /**
//  * Tính điểm khớp tên doanh nghiệp theo token-overlap.
//  * Trả về 0.0 – 1.0.
//  */
// const calcNameMatchScore = (expectedName, extractedText) => {
//   if (!expectedName) return 0;

//   const tokens = normalizeText(expectedName)
//     .split(" ")
//     .filter((t) => t.length > 1);

//   if (!tokens.length) return 0;

//   const matched = tokens.filter((t) => normalizeText(extractedText).includes(t));
//   return matched.length / tokens.length;
// };

// /**
//  * Lấy tên file từ giá trị business_license trong DB.
//  *
//  * DB có thể lưu:
//  *   - "http://localhost:5000/uploads/document-123.jpg"  → trả "document-123.jpg"
//  *   - "uploads/document-123.jpg"                        → trả "document-123.jpg"
//  *   - "document-123.jpg"                                → trả "document-123.jpg"
//  */
// const extractFilename = (businessLicenseValue) => {
//   if (!businessLicenseValue) return null;

//   const raw = String(businessLicenseValue);

//   // Nếu là URL đầy đủ → parse để lấy pathname
//   if (raw.startsWith("http://") || raw.startsWith("https://")) {
//     try {
//       return path.basename(new URL(raw).pathname);
//     } catch {
//       // fallthrough
//     }
//   }

//   // Nếu là relative path hoặc chỉ tên file
//   return path.basename(raw);
// };

// // ─── Controller chính ────────────────────────────────────────────────────────

// const scanBusinessLicense = async (req, res) => {
//   try {
//     const storeId = req.params.storeId;

//     // Bước 1: Tìm cửa hàng trong Database
//     const store = await Store.findByPk(storeId, {
//       attributes: ["id", "store_name", "tax_code", "business_license", "business_license_image", "status"],
//     });

//     if (!store) {
//       return res.status(404).json({ message: "Không tìm thấy hồ sơ cửa hàng này!" });
//     }

//     // Bước 2: Lấy tên file ảnh từ cột business_license_image (đường dẫn ảnh)
//     // business_license (text) = mã số GPKD, business_license_image = đường dẫn file ảnh
//     const imageName = extractFilename(store.business_license_image);

//     if (!imageName) {
//       return res.status(400).json({
//         message:
//           "Cửa hàng này chưa có ảnh GPKD trong hệ thống. " +
//           "Hãy đăng ký lại và tải lên ảnh Giấy Phép Kinh Doanh.",
//         hint: store.business_license
//           ? `Mã số GPKD: ${store.business_license} — nhưng thiếu file ảnh.`
//           : undefined,
//       });
//     }

//     // Bước 3: Chỉ đường dẫn tuyệt đối tới thư mục uploads/
//     // __dirname = .../Backend/controllers → cần lên 1 cấp
//     const imagePath = path.join(__dirname, "../uploads", imageName);

//     // Bước 4: Kiểm tra xem file có thực sự nằm trên ổ cứng không
//     if (!fs.existsSync(imagePath)) {
//       return res.status(400).json({
//         message: "Không tìm thấy file ảnh vật lý trên server. File có thể đã bị xóa.",
//         debug: { imageName, imagePath },
//       });
//     }

//     // Bước 5: Chạy OCR và Kiểm tra Mộc Đỏ song song để tiết kiệm thời gian
//     console.log("🤖 AI đang phân tích ảnh:", imagePath);

//     const imageBase64 = fs.readFileSync(imagePath, { encoding: 'base64' });

//     const [ocrResult, stampResult] = await Promise.all([
//       Tesseract.recognize(imagePath, "vie+eng", {
//         logger: (m) => {
//           if (m.status === "recognizing text") {
//             process.stdout.write(`\r🔍 Tesseract: ${Math.round((m.progress || 0) * 100)}%`);
//           }
//         },
//       }),
//       detectRedStamp(imageBase64),
//     ]);

//     console.log("\n✅ AI phân tích xong!");

//     const rawText = ocrResult.data.text || "";

//     if (!rawText.trim() || rawText.trim().length < 5) {
//       return res.status(422).json({
//         message: "AI không đọc được nội dung từ ảnh. Vui lòng dùng ảnh rõ nét, chụp thẳng góc.",
//         rawText,
//       });
//     }

//     // Bước 6: Đối chiếu thông tin
//     const extractedTaxCode = extractTaxCode(rawText);
//     const normalizedText = normalizeText(rawText);

//     const taxCodeMatch =
//       !!extractedTaxCode &&
//       !!store.tax_code &&
//       extractedTaxCode.replace(/-/g, "") ===
//         String(store.tax_code).replace(/-/g, "");

//     const nameMatchScore = calcNameMatchScore(store.store_name, normalizedText);

//     // Điểm tổng: 60% MST + 40% tên (nếu có MST), hoặc 100% tên
//     let matchScore;
//     if (store.tax_code) {
//       matchScore = (taxCodeMatch ? 0.6 : 0) + nameMatchScore * 0.4;
//     } else {
//       matchScore = nameMatchScore;
//     }

//     const isMatch = matchScore >= 0.9;

//     // Bước 7: Trả kết quả về Frontend
//     return res.status(200).json({
//       success: true,
//       data: {
//         rawText,                                            // Văn bản thô AI đọc được
//         extractedTaxCode,                                   // MST trích xuất từ ảnh
//         extractedName: store.store_name,                    // Tên để đối chiếu
//         matchScore: Math.round(matchScore * 100) / 100,     // 0.0 – 1.0
//         isMatch,                                            // true nếu >= 90%
//         // ── Kết quả kiểm tra mộc đỏ ──
//         has_red_stamp: stampResult.hasRedStamp,
//         redStampDebug: stampResult.debugInfo,
//         details: {
//           taxCodeMatch,
//           nameMatchScore: Math.round(nameMatchScore * 100) / 100,
//           storeTaxCode: store.tax_code,
//           storeStoreName: store.store_name,
//         },
//       },
//     });
//   } catch (error) {
//     console.error("❌ Lỗi AI OCR:", error);
//     return res.status(500).json({
//       message: "Lỗi server trong quá trình xử lý AI. " + (error.message || ""),
//     });
//   }
// };

// module.exports = {
//   scanBusinessLicense,
// };

/**
 * controllers/ocr.controller.js
 *
 * Controller xử lý AI OCR — Quét ảnh Giấy Phép Kinh Doanh (GPKD)
 * Route: POST /api/admin/scan-license/:storeId
 */
const fs = require("fs");
const path = require("path");
const Tesseract = require("tesseract.js");
const { Store } = require("../models");
const { detectRedStamp } = require("../services/ai.service");

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Chuẩn hóa chuỗi: bỏ dấu tiếng Việt, uppercase, gộp khoảng trắng.
 */
const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Trích xuất Mã Số Thuế từ văn bản OCR thô.
 * Ưu tiên dạng 10 chữ số (doanh nghiệp) trước.
 */
const extractTaxCode = (text) => {
  // Dạng 10-3: 1234567890-123
  const longMatch = text.match(/\b\d{10}-\d{3}\b/);
  if (longMatch) return longMatch[0];

  // Dạng 10 chữ số
  const shortMatches = text.match(/\b\d{10}\b/g);
  if (shortMatches?.length) return shortMatches[0];

  // Dạng 13 chữ số liền
  const veryLong = text.match(/\b\d{13}\b/);
  if (veryLong) return veryLong[0];

  return null;
};

/**
 * Tính điểm khớp tên doanh nghiệp theo token-overlap.
 * Trả về 0.0 – 1.0.
 */
const calcNameMatchScore = (expectedName, extractedText) => {
  if (!expectedName) return 0;

  const tokens = normalizeText(expectedName)
    .split(" ")
    .filter((t) => t.length > 1);

  if (!tokens.length) return 0;

  const matched = tokens.filter((t) => normalizeText(extractedText).includes(t));
  return matched.length / tokens.length;
};

/**
 * Lấy tên file từ giá trị business_license trong DB.
 */
const extractFilename = (businessLicenseValue) => {
  if (!businessLicenseValue) return null;

  const raw = String(businessLicenseValue);

  // Nếu là URL đầy đủ → parse để lấy pathname
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      return path.basename(new URL(raw).pathname);
    } catch {
      // fallthrough
    }
  }

  // Nếu là relative path hoặc chỉ tên file
  return path.basename(raw);
};

// ─── Controller chính ────────────────────────────────────────────────────────

const scanBusinessLicense = async (req, res) => {
  try {
    const storeId = req.params.storeId;

    // Bước 1: Tìm cửa hàng trong Database
    const store = await Store.findByPk(storeId, {
      attributes: ["id", "store_name", "tax_code", "business_license", "business_license_image", "status"],
    });

    if (!store) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ cửa hàng này!" });
    }

    // Bước 2: Lấy tên file ảnh từ cột business_license_image (đường dẫn ảnh)
    const imageName = extractFilename(store.business_license_image);

    if (!imageName) {
      return res.status(400).json({
        message:
          "Cửa hàng này chưa có ảnh GPKD trong hệ thống. " +
          "Hãy đăng ký lại và tải lên ảnh Giấy Phép Kinh Doanh.",
        hint: store.business_license
          ? `Mã số GPKD: ${store.business_license} — nhưng thiếu file ảnh.`
          : undefined,
      });
    }

    // Bước 3: Chỉ đường dẫn tuyệt đối tới thư mục uploads/
    const imagePath = path.join(__dirname, "../uploads", imageName);

    // Bước 4: Kiểm tra xem file có thực sự nằm trên ổ cứng không
    if (!fs.existsSync(imagePath)) {
      return res.status(400).json({
        message: "Không tìm thấy file ảnh vật lý trên server. File có thể đã bị xóa.",
        debug: { imageName, imagePath },
      });
    }

    // Bước 5: Chạy OCR và Kiểm tra Mộc Đỏ song song để tiết kiệm thời gian
    console.log("🤖 AI đang phân tích ảnh:", imagePath);

    const imageBase64 = fs.readFileSync(imagePath, { encoding: 'base64' });

    const [ocrResult, stampResult] = await Promise.all([
      Tesseract.recognize(imagePath, "vie+eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            process.stdout.write(`\r🔍 Tesseract: ${Math.round((m.progress || 0) * 100)}%`);
          }
        },
      }),
      detectRedStamp(imageBase64),
    ]);

    console.log("\n✅ AI phân tích xong!");

    const rawText = ocrResult.data.text || "";

    if (!rawText.trim() || rawText.trim().length < 5) {
      return res.status(422).json({
        message: "AI không đọc được nội dung từ ảnh. Vui lòng dùng ảnh rõ nét, chụp thẳng góc.",
        rawText,
      });
    }

    // Bước 6: Đối chiếu thông tin
    const extractedTaxCode = extractTaxCode(rawText);
    const normalizedText = normalizeText(rawText);

    const taxCodeMatch =
      !!extractedTaxCode &&
      !!store.tax_code &&
      extractedTaxCode.replace(/-/g, "") ===
        String(store.tax_code).replace(/-/g, "");

    const nameMatchScore = calcNameMatchScore(store.store_name, normalizedText);

    // Điểm tổng: 60% MST + 40% tên (nếu có MST), hoặc 100% tên
    let matchScore;
    if (store.tax_code) {
      matchScore = (taxCodeMatch ? 0.6 : 0) + nameMatchScore * 0.4;
    } else {
      matchScore = nameMatchScore;
    }

    // ❌ LƯU Ý QUAN TRỌNG ĐÃ SỬA Ở ĐÂY: 
    // Bắt buộc phải khớp chữ (>= 90%) VÀ có mộc đỏ thì isMatch mới bằng TRUE
    const isMatch = (matchScore >= 0.9) && stampResult.hasRedStamp;

    // Bước 7: Trả kết quả về Frontend
    return res.status(200).json({
      success: true,
      data: {
        rawText,                                            // Văn bản thô AI đọc được
        extractedTaxCode,                                   // MST trích xuất từ ảnh
        extractedName: store.store_name,                    // Tên để đối chiếu
        matchScore: Math.round(matchScore * 100) / 100,     // 0.0 – 1.0
        isMatch,                                            // Đã fix: Trả về false nếu thiếu mộc đỏ
        // ── Kết quả kiểm tra mộc đỏ ──
        has_red_stamp: stampResult.hasRedStamp,
        redStampDebug: stampResult.debugInfo,
        details: {
          taxCodeMatch,
          nameMatchScore: Math.round(nameMatchScore * 100) / 100,
          storeTaxCode: store.tax_code,
          storeStoreName: store.store_name,
        },
      },
    });
  } catch (error) {
    console.error("❌ Lỗi AI OCR:", error);
    return res.status(500).json({
      message: "Lỗi server trong quá trình xử lý AI. " + (error.message || ""),
    });
  }
};

module.exports = {
  scanBusinessLicense,
};