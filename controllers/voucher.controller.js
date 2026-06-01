const { Store } = require("../models");
const voucherService = require("../services/voucher.service");

exports.createPlatformVoucher = async (req, res, next) => {
  try {
    const result = await voucherService.createPlatformVoucher(
      req.body,
      req.user.id
    );
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

exports.getPlatformVouchers = async (req, res, next) => {
  try {
    const data = await voucherService.getPlatformVouchers();
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.createShopVoucher = async (req, res, next) => {
  try {
    const store = await Store.findOne({
      where: { owner_id: req.user.id },
    });

    const storeId = store.id;

    const result = await voucherService.createShopVoucher(storeId, req.body);

    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

exports.getShopVouchers = async (req, res, next) => {
  try {
    const data = await voucherService.getShopVouchers(req.params.storeId);
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.getMyVouchers = async (req, res, next) => {
  try {
    const data = await voucherService.getUserVouchers(req.user.id);
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// FIX: trước đây hardcode trả về []
exports.getMyShopVouchers = async (req, res, next) => {
  try {
    const store = await Store.findOne({
      where: { owner_id: req.user.id },
    });

    if (!store) {
      return res.json({ success: true, data: [] });
    }

    const data = await voucherService.getShopVouchers(store.id);
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.validateVoucher = async (req, res, next) => {
  try {
    const data = await voucherService.validateVoucher(req.user.id, req.body);
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.updateShopVoucher = async (req, res, next) => {
  try {
    const data = await voucherService.updateShopVoucher(
      req.params.id,
      req.body
    );
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.updatePlatformVoucher = async (req, res, next) => {
  try {
    const data = await voucherService.updatePlatformVoucher(
      req.params.id,
      req.body
    );
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.disableShopVoucher = async (req, res, next) => {
  try {
    await voucherService.disableShopVoucher(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.disablePlatformVoucher = async (req, res, next) => {
  try {
    await voucherService.disablePlatformVoucher(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.enableShopVoucher = async (req, res, next) => {
  try {
    await voucherService.enableShopVoucher(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.enablePlatformVoucher = async (req, res, next) => {
  try {
    await voucherService.enablePlatformVoucher(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.getPublicPlatformVouchers = async (req, res, next) => {
  try {
    const data = await voucherService.getPublicPlatformVouchers();
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.saveVoucher = async (req, res, next) => {
  try {
    const { voucher_id } = req.body;
    if (!voucher_id) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu voucher_id" });
    }
    const data = await voucherService.saveVoucherForUser(
      req.user.id,
      voucher_id
    );
    return res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};