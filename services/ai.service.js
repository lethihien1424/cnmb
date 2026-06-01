// Backend/services/ai.service.js
//
// Xác thực ảnh GPKD theo 2 lớp:
//   Layer 1 — OCR (Tesseract.js): Đọc tên đại diện + mã số thuế từ ảnh
//   Layer 2 — Color Analysis (Jimp): Phát hiện dấu mộc đỏ qua mật độ pixel đỏ

const Tesseract = require('tesseract.js');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Bỏ dấu tiếng Việt, uppercase, trim để so sánh chuẩn hóa.
 */
const removeAccents = (str) => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Đ/g, 'D')
    .replace(/đ/g, 'd')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
};

// ─── Layer 2: Phát hiện dấu mộc đỏ bằng Jimp ───────────────────────────────

/**
 * Phân tích ảnh (base64) để kiểm tra mật độ pixel màu đỏ.
 *
 * Pixel được tính là "đỏ" nếu:
 *   - R >= 150  (đỏ cao)
 *   - G <= 80   (xanh lá thấp)
 *   - B <= 80   (xanh dương thấp)
 *
 * @returns {{ hasRedStamp: boolean, redRatio: number, debugInfo: string }}
 */
const detectRedStamp = async (base64Image) => {
  try {
    const { Jimp } = require('jimp');
    const imageBuffer = Buffer.from(base64Image, 'base64');

    let image;
    if (typeof Jimp.fromBuffer === 'function') {
      image = await Jimp.fromBuffer(imageBuffer);
    } else if (typeof Jimp.read === 'function') {
      image = await Jimp.read(imageBuffer);
    } else {
      throw new Error('Không tìm thấy API Jimp hợp lệ');
    }

    const { data, width, height } = image.bitmap;
    let redPixelCount = 0;

    // 🚀 CHÌA KHÓA: Chỉ quét 50% diện tích phía dưới của bức ảnh
    // Dấu mộc pháp lý luôn nằm ở phần dưới cùng, việc cắt bỏ nửa trên giúp loại bỏ 100% logo/chữ đỏ rác
    const startY = Math.floor(height * 0.5); 
    const scannedPixels = width * (height - startY);

    for (let y = startY; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2; // Tương đương: (y * width + x) * 4
        
        const r = data[idx];       // Red (Đỏ)
        const g = data[idx + 1];   // Green (Xanh lá)
        const b = data[idx + 2];   // Blue (Xanh dương)
        const a = data[idx + 3];   // Alpha (Độ mờ)

        if (a < 50) continue; // Bỏ qua điểm ảnh trong suốt

        // CÔNG THỨC CHỐNG NHIỄU MỚI:
        // Yêu cầu: Đỏ phải >= 130, và sắc Đỏ phải trội hơn sắc Xanh lá/Xanh dương ít nhất 40 đơn vị
        // Tránh việc ảnh chụp bị vàng/tối làm sai lệch màu
        if (r >= 130 && g <= 110 && b <= 110 && r > (g + 40) && r > (b + 40)) {
          redPixelCount++;
        }
      }
    }

    // Tính tỷ lệ pixel đỏ dựa trên tổng số pixel của NỬA DƯỚI bức ảnh
    const redRatio = redPixelCount / scannedPixels;
    
    // Ngưỡng 0.8% là mức chuẩn nhất để bắt được mộc tròn (sau khi đã cắt nửa trên)
    const RED_RATIO_THRESHOLD = 0.008; 
    const hasRedStamp = redRatio >= RED_RATIO_THRESHOLD;

    const debugInfo = `${(redRatio * 100).toFixed(2)}% pixel đỏ nửa dưới (${redPixelCount}/${scannedPixels})`;
    console.log(`[Red Stamp] ${debugInfo}`);

    return { hasRedStamp, redRatio, debugInfo };
  } catch (err) {
    // Nếu Jimp sập, tuyệt đối không duyệt
    console.error('[Red Stamp] Lỗi phân tích ảnh:', err.message);
    return { hasRedStamp: false, redRatio: -1, debugInfo: `Lỗi: ${err.message}` };
  }
};
// ─── Layer 1 + 2 kết hợp: Xác thực đầy đủ ──────────────────────────────────

/**
 * Xác thực ảnh GPKD theo 2 lớp:
 *   1. Kiểm tra dấu mộc đỏ (Jimp color analysis)
 *   2. OCR đối soát tên + MST (Tesseract.js)
 *
 * Dùng trong auth.controller.js khi đăng ký B2C.
 *
 * @param {string}  base64Image    - Ảnh GPKD dạng base64
 * @param {string}  mimeType       - VD: 'image/jpeg'
 * @param {string}  targetName     - Họ tên người đại diện người dùng nhập
 * @param {string}  targetTaxCode  - Mã số thuế người dùng nhập
 * @returns {{ has_red_stamp, is_correct_owner, reason, debug }}
 */
const verifyBusinessLicenseStamp = async (base64Image, mimeType, targetName, targetTaxCode) => {
  try {
    // ── Bước 1: Phát hiện dấu mộc đỏ ──────────────────────────────────────
    const stampResult = await detectRedStamp(base64Image);

    if (!stampResult.hasRedStamp) {
      return {
        has_red_stamp: false,
        is_correct_owner: false,
        reason: `Không phát hiện dấu mộc đỏ trên ảnh (${stampResult.debugInfo}). Vui lòng tải ảnh GPKD gốc có dấu mộc tròn đỏ của cơ quan nhà nước.`,
        debug: stampResult.debugInfo,
      };
    }

    // ── Bước 2: OCR đối soát tên + MST ────────────────────────────────────
    // Nếu không có thông tin để đối soát, chỉ cần mộc đỏ là đủ
    if (!targetName && !targetTaxCode) {
      return {
        has_red_stamp: true,
        is_correct_owner: true,
        reason: `Xác thực thành công: Phát hiện dấu mộc đỏ (${stampResult.debugInfo}).`,
        debug: stampResult.debugInfo,
      };
    }

    const imageBuffer = Buffer.from(base64Image, 'base64');
    const { data: { text } } = await Tesseract.recognize(imageBuffer, 'vie+eng');
    const ocrTextNorm = removeAccents(text);

    const cleanTargetName    = removeAccents(targetName);
    const cleanTargetTaxCode = targetTaxCode ? targetTaxCode.trim() : '';

    console.log(`[AI OCR] Đối soát: Tên="${cleanTargetName}", MST="${cleanTargetTaxCode}"`);

    const isNameMatch    = cleanTargetName    ? ocrTextNorm.includes(cleanTargetName)    : true;
    const isTaxCodeMatch = cleanTargetTaxCode ? ocrTextNorm.includes(cleanTargetTaxCode) : true;

    const isCorrectOwner = isNameMatch && isTaxCodeMatch;

    if (isCorrectOwner) {
      return {
        has_red_stamp: true,
        is_correct_owner: true,
        reason: `Xác thực thành công: Phát hiện dấu mộc đỏ và thông tin khớp với dữ liệu đăng ký.`,
        debug: stampResult.debugInfo,
      };
    }

    const failParts = [];
    if (!isNameMatch)    failParts.push(`Tên "${targetName}" không tìm thấy trên ảnh`);
    if (!isTaxCodeMatch) failParts.push(`Mã số thuế "${targetTaxCode}" không tìm thấy trên ảnh`);

    return {
      has_red_stamp: true,          // Mộc đỏ có, nhưng thông tin không khớp
      is_correct_owner: false,
      reason: failParts.join('; ') + '. Vui lòng kiểm tra lại ảnh GPKD.',
      debug: stampResult.debugInfo,
    };

  } catch (error) {
    console.error('[AI Service] Lỗi không mong đợi:', error.message);
    // Fallback: cho phép đăng ký để không block người dùng khi AI lỗi
    return {
      has_red_stamp: true,
      is_correct_owner: true,
      reason: `[Fallback] AI gặp lỗi kỹ thuật (${error.message}) — đã bỏ qua xác thực tự động.`,
      debug: error.message,
    };
  }
};

module.exports = {
  verifyBusinessLicenseStamp,
  detectRedStamp,           // Export để admin.ocr.controller có thể gọi riêng nếu cần
  parseSearchQuery: async () => null,
};