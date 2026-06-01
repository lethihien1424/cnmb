// Backend/seed.js
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { User, sequelize } = require("./models");

const seedAdmin = async () => {
  try {
    // 1. Kết nối DB
    await sequelize.authenticate();
    console.log("Kết nối DB thành công. Đang kiểm tra Admin...");

    const adminEmail = "admin_chuan_100@gmail.com";

    // 2. Kiểm tra xem đã có admin chưa
    const existingAdmin = await User.findOne({ where: { email: adminEmail } });

    if (existingAdmin) {
      console.log("⚠️ Tài khoản Admin đã tồn tại trong Database!");
      process.exit(0);
    }

    // 3. Mã hóa mật khẩu và tạo tài khoản
    const hashedPassword = await bcrypt.hash("123456", 10);

    await User.create({
      username: "Super Admin",
      email: adminEmail,
      password: hashedPassword,
      role: "Admin",
      status: "ACTIVE",
    });

    console.log("✅ Đã tạo tài khoản Admin thành công!");
    console.log("👉 Email: admin_chuan_100@gmail.com");
    console.log("👉 Password: 123456");
    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi khi tạo Admin:", error);
    process.exit(1);
  }
};

seedAdmin();
