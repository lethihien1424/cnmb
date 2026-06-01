const userService = require("../services/user.service");

const createUser = async (req, res) => {
  try {
    const user = await userService.createUser(req.body);
    res.json(user);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json({ data: users });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);
    res.json(user);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body);
    res.json({ message: "Cập nhật thành công", data: user });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    await userService.deleteUser(req.params.id);
    res.json({ message: "Xóa thành công" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
const getProfile = async (req, res) => {
  try {
    // 1. Kiểm tra xem Middleware có truyền req.user sang không
    if (!req.user || !req.user.id) {
      console.log(
        "🔴 LỖI BACKEND: Không tìm thấy req.user. Chưa gắn Middleware xác thực!",
      );
      return res
        .status(401)
        .json({ message: "Không tìm thấy token xác thực hợp lệ" });
    }

    const user = await userService.getProfile(req.user.id);
    res.json({ data: user });
  } catch (err) {
    // 2. In lỗi thật ra Terminal của Backend để debug
    console.error("🔴 LỖI GET PROFILE:", err);
    res.status(400).json({ message: err.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.log(
        "🔴 LỖI BACKEND: Không tìm thấy req.user. Chưa gắn Middleware xác thực!",
      );
      return res
        .status(401)
        .json({ message: "Không tìm thấy token xác thực hợp lệ" });
    }

    // Nếu có file avatar được upload, thêm đường dẫn vào data
    const profileData = { ...req.body };
    if (req.file) {
      profileData.avatar = `/uploads/${req.file.filename}`;
    }

    const user = await userService.updateProfile(req.user.id, profileData);
    res.json({ message: "Cập nhật thành công", data: user });
  } catch (err) {
    console.error("🔴 LỖI UPDATE PROFILE:", err);
    res.status(400).json({ message: err.message });
  }
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
