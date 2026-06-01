// services/user.service.js
const bcrypt = require("bcryptjs");
const userRepo = require("../repositories/user.repository");

// VALIDATE
const validateUser = (data, isUpdate = false) => {
  const { username, email, password } = data;

  if (username && !/^[A-Za-zÀ-ỹ\s]+$/.test(username)) {
    throw new Error("Tên chỉ được chứa chữ");
  }

  if (email && !/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email)) {
    throw new Error("Email phải có dạng @gmail.com");
  }

  if (!isUpdate && (!password || !/^\d{6,}$/.test(password))) {
    throw new Error("Mật khẩu phải ít nhất 6 chữ số");
  }
};

const createUser = async (data) => {
  validateUser(data);

  const existing = await userRepo.findByEmail(data.email);
  if (existing) {
    throw new Error("Email đã tồn tại");
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  return await userRepo.createUser({
    ...data,
    password: hashedPassword,
    role: data.role || "Customer",
    status: "ACTIVE",
  });
};

const getAllUsers = async () => {
  return await userRepo.findAllUsers();
};

const getUserById = async (id) => {
  const user = await userRepo.findUserById(id);
  if (!user) throw new Error("Không tìm thấy user");
  return user;
};

const updateUser = async (id, data) => {
  validateUser(data, true);

  if (data.email) {
    const existing = await userRepo.findByEmail(data.email);
    if (existing && existing.id !== id) {
      throw new Error("Email đã tồn tại");
    }
  }

  if (data.password) {
    if (data.password.length < 6) {
      throw new Error("Mật khẩu phải ít nhất 6 ký tự");
    }
    data.password = await bcrypt.hash(data.password, 10);
  }

  return await userRepo.updateUser(id, data);
};

const deleteUser = async (id) => {
  return await userRepo.deleteUser(id);
};
const getProfile = async (userId) => {
  const user = await userRepo.getProfile(userId);

  if (!user) {
    throw new Error("Không tìm thấy user");
  }

  return user;
};
const updateProfile = async (userId, data) => {
  // 1. Nếu có cập nhật email, kiểm tra định dạng
  if (
    data.email &&
    !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(data.email)
  ) {
    throw new Error("Định dạng email không hợp lệ");
  }

  // 2. Kiểm tra xem email mới này có bị trùng với tài khoản khác không
  if (data.email) {
    const existingUser = await userRepo.findByEmail(data.email);
    if (existingUser && String(existingUser.id) !== String(userId)) {
      throw new Error("Email này đã được sử dụng bởi một tài khoản khác!");
    }
  }

  // 3. Nếu dữ liệu an toàn, gọi xuống Repository để lưu
  return await userRepo.updateProfile(userId, data);
};
module.exports = {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getProfile,
  updateProfile,
};
