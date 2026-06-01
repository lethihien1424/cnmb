const STORE_POLICY_VERSION = "2026-04";

const STORE_FEE_POLICY = {
  fixedFeeRate: 0.04,
  paymentFeeRate: 0.05,
  minServiceFeeRate: 0.01,
  maxServiceFeeRate: 0.05,
  defaultServiceFeeRate: 0,
  returnFeeCapStandard: 40000,
  returnFeeCapExpress: 20000,
  taxThresholdPerYear: 100000000,
  vatTaxRate: 0.01,
  pitTaxRate: 0.005,
};

const normalizeToken = (value) => {
  return String(value || "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
};

const buildDossierKey = ({ identityCard, taxCode, bankAccount }) => {
  const identity = normalizeToken(identityCard);
  const tax = normalizeToken(taxCode);
  const bank = normalizeToken(bankAccount);

  const keyParts = [identity || "na", tax || "na", bank || "na"];
  if (keyParts.every((part) => part === "na")) {
    return null;
  }

  return keyParts.join("|");
};

module.exports = {
  STORE_POLICY_VERSION,
  STORE_FEE_POLICY,
  buildDossierKey,
};
