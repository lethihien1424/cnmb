// repositories/user.repository.js
const { User, Address } = require("../models");

const isMissingOtpColumnError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("reset_otp") || message.includes("resetotpexpires");
};

const createUser = async (payload) => User.create(payload);

const findByEmail = async (email) => {
  try {
    return await User.findOne({ where: { email } });
  } catch (error) {
    if (!isMissingOtpColumnError(error)) throw error;
    return User.findOne({
      where: { email },
      attributes: ["id", "username", "email", "password", "role", "status"],
    });
  }
};

const setResetOtp = async (userId, otp, expiresAt) =>
  User.update(
    { resetOtp: otp, resetOtpExpires: expiresAt },
    { where: { id: userId } },
  );

const updatePasswordAndClearOtp = async (userId, hashedPassword) =>
  User.update(
    { password: hashedPassword, resetOtp: null, resetOtpExpires: null },
    { where: { id: userId } },
  );

const updatePasswordOnly = async (userId, hashedPassword) =>
  User.update({ password: hashedPassword }, { where: { id: userId } });

const findAllUsers = async () =>
  User.findAll({
    attributes: { exclude: ["password"] },
    order: [["created_at", "DESC"]],
  });

const findUserById = async (id) => User.findByPk(id);

const updateUser = async (id, data) => {
  const user = await User.findByPk(id);
  if (!user) throw new Error("Không tìm thấy user");
  return user.update(data);
};

const deleteUser = async (id) => {
  const user = await User.findByPk(id);
  if (!user) throw new Error("Không tìm thấy user");
  return user.destroy();
};

const getProfile = async (userId) =>
  User.findByPk(userId, {
    attributes: [
      "id",
      "username",
      "email",
      "role",
      "status",
      "gender",
      "date_of_birth",
      "avatar",
      "phone",
    ],
    include: [{ model: Address, as: "addresses", required: false }],
  });

const updateProfile = async (userId, data) => {
  const user = await User.findByPk(userId);
  if (!user) throw new Error("Không tìm thấy user");

  // 1. Cập nhật bảng users (Bao gồm cả Email, Giới tính, Ngày sinh, Phone)
  await user.update({
    username: data.username ?? user.username,
    email: data.email ?? user.email,
    gender: data.gender ?? user.gender,
    date_of_birth: data.date_of_birth ?? user.date_of_birth,
    phone: data.phone ?? user.phone,
  });

  // 2. Xử lý lưu Số điện thoại vào bảng Address
  if (
    data.phone !== undefined &&
    data.phone !== null &&
    String(data.phone).trim() !== ""
  ) {
    let address = null;

    // Ưu tiên tìm địa chỉ đang được chọn trên giao diện
    if (data.address_id) {
      address = await Address.findOne({
        where: { id: data.address_id, user_id: userId },
      });
    }

    // Nếu không có, tìm địa chỉ mặc định
    if (!address) {
      address = await Address.findOne({
        where: { user_id: userId, is_default: true },
      });
    }

    // Nếu đã có địa chỉ -> Cập nhật số điện thoại
    if (address) {
      await address.update({ phone: data.phone });
    }
    // NẾU CHƯA CÓ ĐỊA CHỈ -> Tạo một địa chỉ mặc định để lưu số điện thoại
    else {
      await Address.create({
        user_id: userId,
        phone: data.phone,
        is_default: true,
        recipient_name: data.username || user.username,
      });
    }
  }

  // Trả về dữ liệu mới nhất
  return getProfile(userId);
};

module.exports = {
  createUser,
  findByEmail,
  setResetOtp,
  updatePasswordAndClearOtp,
  updatePasswordOnly,
  findAllUsers,
  findUserById,
  updateUser,
  deleteUser,
  getProfile,
  updateProfile,
};
