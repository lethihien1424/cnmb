const { Op } = require("sequelize");

const DEFAULT_QR_BASE_URL = "https://qr.sepay.vn/img";

const getSepayReceiver = () => ({
  accountName: process.env.SEPAY_ACCOUNT_NAME || "",
  bankCode: process.env.SEPAY_BANK_CODE || "VietinBank",
  accountNumber: process.env.SEPAY_ACCOUNT_NUMBER || "",
});

const buildSepayTransferContent = (orderId) => {
  const prefix =
    process.env.SEPAY_TRANSFER_PREFIX === undefined
      ? "SEVQR"
      : process.env.SEPAY_TRANSFER_PREFIX.trim();

  return [prefix, `ORDER_${orderId}`].filter(Boolean).join(" ");
};

const buildSepayQrUrl = ({ amount, transferContent }) => {
  const { bankCode, accountNumber } = getSepayReceiver();

  const params = new URLSearchParams({
    acc: accountNumber,
    bank: bankCode,
    amount: String(Math.round(Number(amount || 0))),
    des: transferContent,
    template: process.env.SEPAY_QR_TEMPLATE || "compact",
  });

  return `${process.env.SEPAY_QR_BASE_URL || DEFAULT_QR_BASE_URL}?${params.toString()}`;
};

const extractOrderIdFromSepayPayload = (payload = {}) => {
  const text = [payload.code, payload.content, payload.description]
    .filter(Boolean)
    .map(String)
    .join(" ");

  const match = text.match(
    /ORDER[_\s-]*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  );

  return match?.[1] || null;
};

const buildSepayPaymentLookup = (payload = {}) => {
  const orderId = extractOrderIdFromSepayPayload(payload);
  const searchableText = [payload.code, payload.content, payload.description]
    .filter(Boolean)
    .map(String);

  const clauses = [];

  if (orderId) {
    clauses.push({ order_id: orderId });
    clauses.push({ transfer_content: { [Op.iLike]: `%${orderId}%` } });
  }

  for (const text of searchableText) {
    clauses.push({ transfer_content: text });
    clauses.push({ transfer_content: { [Op.iLike]: `%${text}%` } });
  }

  return clauses.length ? { [Op.or]: clauses } : null;
};

module.exports = {
  buildSepayTransferContent,
  buildSepayQrUrl,
  buildSepayPaymentLookup,
  extractOrderIdFromSepayPayload,
  getSepayReceiver,
};
