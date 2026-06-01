const Tesseract = require("tesseract.js");

const FRONT_SIDE_KEYWORDS = [
  "CAN CUOC",
  "CONG DAN",
  "IDENTITY",
  "CMND",
  "CCCD",
];

const BACK_SIDE_KEYWORDS = [
  "DAU VAN TAY",
  "DAC DIEM NHAN DANG",
  "NOI THUONG TRU",
  "NGAY CAP",
  "CO GIA TRI",
];

const normalizeText = (value) => {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
};

const hasAnyKeyword = (text, keywords) => {
  return keywords.some((keyword) => text.includes(keyword));
};

const isLikelyBackSide = (normalizedText) => {
  if (hasAnyKeyword(normalizedText, BACK_SIDE_KEYWORDS)) {
    return true;
  }

  // Back side often contains MRZ-like tokens (IDVNM and <<<<<<).
  if (normalizedText.includes("IDVNM") || normalizedText.includes("<<")) {
    return true;
  }

  return false;
};

const extractIdentityNumber = (text) => {
  const matched = text.match(/\b\d{12}\b/g);
  if (!matched || matched.length === 0) {
    return null;
  }

  return matched[0];
};

const extractTextFromImage = async (imagePath) => {
  const { data } = await Tesseract.recognize(imagePath, "vie+eng", {
    logger: () => {},
  });

  return String(data?.text || "");
};

const validateNameMatch = ({ expectedFullName, extractedText }) => {
  if (!expectedFullName) {
    return;
  }

  const normalizedExpected = normalizeText(expectedFullName);
  const normalizedExtracted = normalizeText(extractedText);

  if (normalizedExpected.length < 2) {
    return;
  }

  const tokens = normalizedExpected
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1);

  if (tokens.length === 0) {
    return;
  }

  const matchedTokenCount = tokens.filter((token) =>
    normalizedExtracted.includes(token),
  ).length;

  const minimumRequired = Math.min(2, tokens.length);
  if (matchedTokenCount < minimumRequired) {
    const error = new Error(
      "Họ tên trên CCCD không khớp với thông tin bạn đã nhập",
    );
    error.statusCode = 400;
    throw error;
  }
};

const verifyCccdImages = async ({
  frontImagePath,
  backImagePath,
  expectedIdentityNumber,
  expectedFullName,
}) => {
  const [frontRawText, backRawText] = await Promise.all([
    extractTextFromImage(frontImagePath),
    extractTextFromImage(backImagePath),
  ]);

  const frontText = normalizeText(frontRawText);
  const backText = normalizeText(backRawText);
  const mergedText = `${frontText} ${backText}`.trim();

  if (!hasAnyKeyword(frontText, FRONT_SIDE_KEYWORDS)) {
    const error = new Error(
      "Ảnh mặt trước CCCD không hợp lệ. Vui lòng tải đúng mặt trước rõ nét",
    );
    error.statusCode = 400;
    throw error;
  }

  if (!isLikelyBackSide(backText)) {
    const error = new Error(
      "Ảnh mặt sau CCCD không hợp lệ. Vui lòng tải đúng mặt sau rõ nét",
    );
    error.statusCode = 400;
    throw error;
  }

  const extractedIdentity = extractIdentityNumber(mergedText);
  if (!extractedIdentity) {
    const error = new Error(
      "Không đọc được số CCCD từ ảnh. Vui lòng chụp rõ và thử lại",
    );
    error.statusCode = 400;
    throw error;
  }

  if (String(extractedIdentity) !== String(expectedIdentityNumber || "")) {
    const error = new Error(
      "Số CCCD bạn nhập không khớp với số đọc được từ ảnh CCCD",
    );
    error.statusCode = 400;
    throw error;
  }

  validateNameMatch({ expectedFullName, extractedText: mergedText });

  return {
    extractedIdentity,
  };
};

module.exports = {
  verifyCccdImages,
};
