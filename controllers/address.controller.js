const addressService =
  require("../services/address.service");

// ───────────────────────────────────────────────────────
// CREATE ADDRESS
// ───────────────────────────────────────────────────────
const createAddress = async (
  req,
  res
) => {
  try {

    const userId =
      req.user.userId || req.user.id;

    const data =
      await addressService.createAddress(
        userId,
        req.body
      );

    return res.json({
      success: true,
      data,
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ───────────────────────────────────────────────────────
// GET ALL ADDRESSES
// ───────────────────────────────────────────────────────
const getAddresses = async (
  req,
  res
) => {
  try {

    const userId =
      req.user.userId || req.user.id;

    const data =
      await addressService.getAddresses(
        userId
      );

    return res.json({
      success: true,
      data,
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ───────────────────────────────────────────────────────
// GET ADDRESS DETAIL
// ───────────────────────────────────────────────────────
const getAddressById = async (
  req,
  res
) => {
  try {

    const userId =
      req.user.userId || req.user.id;

    const addressId =
      req.params.id;

    const data =
      await addressService.getAddressById(
        userId,
        addressId
      );

    return res.json({
      success: true,
      data,
    });

  } catch (err) {

    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};
const updateAddress = async (
  req,
  res
) => {

  try {

    const userId =
      req.user.userId || req.user.id;

    const addressId =
      req.params.id;

    const data =
      await addressService.updateAddress(
        userId,
        addressId,
        req.body
      );

    return res.json({
      success: true,
      data,
    });

  } catch (err) {

    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};
module.exports = {

  createAddress,

  getAddresses,

  getAddressById,
  updateAddress,
};