const addressRepo =
  require("../repositories/address.repository");

// ───────────────────────────────────────────────────────
// CREATE ADDRESS
// ───────────────────────────────────────────────────────
const createAddress = async (
  userId,
  data
) => {

  // Nếu set default
  if (data.is_default) {
    await addressRepo.resetDefault(userId);
  }

  return await addressRepo.createAddress({
    ...data,
    user_id: userId,
  });
};

// ───────────────────────────────────────────────────────
// GET ALL ADDRESSES
// ───────────────────────────────────────────────────────
const getAddresses = async (userId) => {

  return await addressRepo.getByUser(userId);
};

// ───────────────────────────────────────────────────────
// GET ADDRESS DETAIL
// ───────────────────────────────────────────────────────
const getAddressById = async (
  userId,
  addressId
) => {

  const address =
    await addressRepo.getAddressById(
      addressId
    );

  if (!address) {
    throw new Error(
      "Địa chỉ không tồn tại"
    );
  }

  // Security check
  if (
    String(address.user_id) !==
    String(userId)
  ) {
    throw new Error(
      "Không có quyền truy cập địa chỉ này"
    );
  }

  return address;
};
const updateAddress = async (
  userId,
  addressId,
  updateData
) => {

  const address =
    await addressRepo.getAddressById(
      addressId
    );

  if (!address) {
    throw new Error(
      "Không tìm thấy địa chỉ"
    );
  }

  if (
    String(address.user_id) !==
    String(userId)
  ) {
    throw new Error(
      "Không có quyền"
    );
  }

  // Nếu set mặc định
  if (updateData.is_default) {

    await addressRepo.resetDefault(
      userId
    );
  }

  await address.update(updateData);

  return address;
};

module.exports = {

  createAddress,

  getAddresses,
updateAddress,
  getAddressById,
};