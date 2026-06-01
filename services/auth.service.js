// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const userRepository = require("../repositories/user.repository");
// const storeRepository = require("../repositories/store.repository");

// const ROLE = {
//   ADMIN: "Admin",
//   CUSTOMER: "Customer",
//   BUSINESS: "Business",
// };

// const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
// const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

// const register = async (payload) => {
//   const {
//     username,
//     email,
//     password,
//     role,
//     business_license: businessLicense,
//     store_name: storeName,
//     store_type: storeType,
//     description,
//   } = payload;

//   if (!email || !password || !role) {
//     const error = new Error("email, password, role are required");
//     error.statusCode = 400;
//     throw error;
//   }

//   if (![ROLE.CUSTOMER, ROLE.BUSINESS].includes(role)) {
//     const error = new Error("role must be Customer or Business");
//     error.statusCode = 400;
//     throw error;
//   }

//   if (role === ROLE.BUSINESS && !businessLicense) {
//     const error = new Error("business_license is required for Business role");
//     error.statusCode = 400;
//     throw error;
//   }

//   const existingUser = await userRepository.findByEmail(email);
//   if (existingUser) {
//     const error = new Error("Email already in use");
//     error.statusCode = 409;
//     throw error;
//   }

//   const hashedPassword = await bcrypt.hash(password, 10);

//   const user = await userRepository.createUser({
//     username: username || null,
//     email,
//     password: hashedPassword,
//     role,
//     status: "ACTIVE",
//   });

//   let store = null;
//   if (role === ROLE.BUSINESS) {
//     store = await storeRepository.createStore({
//       owner_id: user.id,
//       store_type: storeType || "B2C",
//       store_name: storeName || `${username || email}'s Store`,
//       description: description || null,
//       business_license: businessLicense,
//       status: "PENDING",
//     });
//   }

//   return {
//     user: {
//       id: user.id,
//       username: user.username,
//       email: user.email,
//       role: user.role,
//       status: user.status,
//     },
//     store,
//   };
// };

// const login = async ({ email, password }) => {
//   if (!email || !password) {
//     const error = new Error("email and password are required");
//     error.statusCode = 400;
//     throw error;
//   }

//   const user = await userRepository.findByEmail(email);
//   if (!user) {
//     const error = new Error("Invalid email or password");
//     error.statusCode = 401;
//     throw error;
//   }

//   const isMatched = await bcrypt.compare(password, user.password);
//   if (!isMatched) {
//     const error = new Error("Invalid email or password");
//     error.statusCode = 401;
//     throw error;
//   }

//   const token = jwt.sign(
//     {
//       userId: user.id,
//       role: user.role,
//     },
//     JWT_SECRET,
//     { expiresIn: JWT_EXPIRES_IN },
//   );

//   return {
//     token,
//     user: {
//       id: user.id,
//       username: user.username,
//       email: user.email,
//       role: user.role,
//       status: user.status,
//     },
//   };
// };
// // Backend/services/auth.service.js
// const register = async (payload) => {
//   const {
//     username,
//     email,
//     password,
//     role,
//     store_name,
//     description,
//     store_type,
//     // Lấy thêm các trường mới từ request body
//     business_license,
//     tax_code,
//     representative_name,
//     identity_card,
//   } = payload;

//   // ... (giữ nguyên phần check email và hash password) ...

//   const user = await userRepository.createUser({
//     username: username || null,
//     email,
//     password: hashedPassword,
//     role,
//     status: "ACTIVE",
//   });

//   let store = null;
//   // Xử lý tạo Store khi đăng ký nếu role là Business (B2C)
//   if (role === ROLE.BUSINESS) {
//     store = await storeRepository.createStore({
//       owner_id: user.id,
//       store_type: "B2C", // Ép kiểu B2C
//       store_name: storeName,
//       description,
//       business_license, // Bắt buộc cho B2C
//       tax_code, // Bắt buộc cho B2C
//       representative_name,
//       identity_card,
//       status: "PENDING", // Chờ Admin duyệt
//     });
//   }
//   // Nếu là Customer muốn mở shop C2C ngay lúc đăng ký (tùy chọn)
//   else if (storeName) {
//     store = await storeRepository.createStore({
//       owner_id: user.id,
//       store_type: "C2C",
//       store_name: storeName,
//       identity_card, // C2C chỉ cần cái này
//       status: "APPROVED", // C2C có thể duyệt luôn
//     });
//   }

//   return { user, store };
// };
// module.exports = {
//   register,
//   login,
// };
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { User, Store, PasswordHistory } = require("../models");
const userRepository = require("../repositories/user.repository");
const storeRepository = require("../repositories/store.repository");
const aiService = require("./ai.service");

const ROLE = {
  ADMIN: "Admin",
  CUSTOMER: "Customer",
  BUSINESS: "Business",
};

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

// ── PASSWORD COMPLEXITY ──
// Ít nhất 8 ký tự, có 1 chữ hoa, 1 chữ thường, 1 số và 1 ký tự đặc biệt
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
const PASSWORD_HISTORY_LIMIT = 3;

/**
 * Kiểm tra độ mạnh mật khẩu
 */
const validatePasswordComplexity = (password) => {
  if (!PASSWORD_REGEX.test(password)) {
    throw {
      statusCode: 400,
      message:
        "Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt (@$!%*?&#).",
    };
  }
};

/**
 * Kiểm tra mật khẩu mới có trùng với N mật khẩu gần nhất không
 */
const checkPasswordHistory = async (userId, newPassword) => {
  const histories = await PasswordHistory.findAll({
    where: { user_id: userId },
    order: [["created_at", "DESC"]],
    limit: PASSWORD_HISTORY_LIMIT,
  });

  for (const history of histories) {
    const isMatch = await bcrypt.compare(newPassword, history.password_hash);
    if (isMatch) {
      throw {
        statusCode: 400,
        message: `Mật khẩu mới không được trùng với ${PASSWORD_HISTORY_LIMIT} mật khẩu gần nhất bạn đã sử dụng!`,
      };
    }
  }
};

/**
 * Lưu mật khẩu đã hash vào lịch sử
 */
const savePasswordHistory = async (userId, hashedPassword) => {
  await PasswordHistory.create({
    user_id: userId,
    password_hash: hashedPassword,
  });
};

/**
 * Đăng ký tài khoản mới
 */
// const register = async (payload, file = null) => {
//   const {
//     username,
//     email,
//     password,
//     role,
//     store_name,
//     store_type,
//     description,
//     tax_code,
//     representative_name,
//     identity_card,
//   } = payload;

//   // 1. Kiểm tra các trường bắt buộc cơ bản
//   if (!email || !password || !role) {
//     const error = new Error("Email, mật khẩu và vai trò là bắt buộc");
//     error.statusCode = 400;
//     throw error;
//   }

//   // 2. Logic riêng cho tài khoản Business (B2B)
//   if (role === ROLE.BUSINESS) {
//     // Kiểm tra các trường thông tin doanh nghiệp
//     if (!store_name || !tax_code || !identity_card) {
//       const error = new Error("Tài khoản Business yêu cầu tên cửa hàng, mã số thuế và CCCD");
//       error.statusCode = 400;
//       throw error;
//     }

//     // Xác thực Giấy phép kinh doanh qua AI
//     if (!file) {
//       const error = new Error("Vui lòng tải lên ảnh Giấy phép kinh doanh để xác thực");
//       error.statusCode = 400;
//       throw error;
//     }

//     try {
//       const base64Image = fs.readFileSync(file.path, { encoding: "base64" });
//       const aiResult = await aiService.verifyBusinessLicenseStamp(base64Image, file.mimetype);

//       if (!aiResult.has_red_stamp) {
//         const error = new Error(`Xác thực thất bại: ${aiResult.reason || "Không tìm thấy dấu mộc đỏ hợp lệ"}`);
//         error.statusCode = 400;
//         throw error;
//       }

//       // Ghi log kết quả AI để theo dõi
//       console.log(`[AI Verification] Store: ${store_name}, Match Owner: ${aiResult.is_correct_owner}`);
//     } catch (err) {
//       if (err.statusCode) throw err;
//       console.error("[Auth Service] AI Processing Error:", err);
//       // Có thể chọn fallback cho phép đăng ký nếu AI lỗi hoặc chặn lại tùy độ bảo mật
//     }
//   }

//   // 3. Kiểm tra email tồn tại
//   const existingUser = await userRepository.findByEmail(email);
//   if (existingUser) {
//     const error = new Error("Email này đã được sử dụng");
//     error.statusCode = 400;
//     throw error;
//   }

//   // 4. Mã hóa mật khẩu (Đảm bảo cột password trong DB là VARCHAR(255))
//   const hashedPassword = await bcrypt.hash(password, 10);

//   // 5. Tạo User
//   const user = await userRepository.create({
//     username: username || email.split("@")[0],
//     email,
//     password: hashedPassword,
//     role,
//     status: role === ROLE.BUSINESS ? "PENDING" : "ACTIVE",
//   });

//   // 6. Nếu là Business, tạo Store với thông tin pháp lý và phí 4%
//   if (role === ROLE.BUSINESS) {
//     await storeRepository.create({
//       owner_id: user.id,
//       store_name,
//       store_type: store_type || "C2C",
//       description,
//       tax_code,
//       representative_name: representative_name || "LÊ THỊ HIỀN",
//       identity_card,
//       business_license_image: `/uploads/${file.filename}`,
//       fixed_fee_rate: 0.0400, // Áp dụng phí cố định 4% như kế hoạch
//       status: "PENDING",
//     });
//   }

//   return user;
// };
const register = async (payload, file = null) => {
  console.log(
    "[AuthService] register() called with payload keys:",
    Object.keys(payload),
  );
  console.log("[AuthService] role:", payload.role, "| email:", payload.email);

  const {
    email,
    password,
    role,
    username,
    store_name,
    tax_code,
    representative_name,
    identity_card,
    contact_phone,
    address,
  } = payload;

  // 0. Kiểm tra trường bắt buộc cơ bản
  if (!email || !password || !role) {
    throw {
      statusCode: 400,
      message: "Email, mật khẩu và vai trò là bắt buộc.",
    };
  }

  // 1. Kiểm tra độ mạnh mật khẩu
  console.log("[AuthService] Validating password complexity...");
  validatePasswordComplexity(password);

  // 2. Kiểm tra SĐT 10 số
  const phoneRegex = /^[0-9]{10}$/;
  if (contact_phone && !phoneRegex.test(contact_phone)) {
    throw { statusCode: 400, message: "Số điện thoại phải đúng 10 chữ số." };
  }

  // 3. Kiểm tra Email tồn tại
  const existingUser = await User.findOne({ where: { email } });
  if (existingUser)
    throw { statusCode: 400, message: "Email này đã được sử dụng." };

  // 4. Hash mật khẩu
  const hashedPassword = await bcrypt.hash(password, 10);

  // 5. Tạo User
  const user = await User.create({
    username: username || email.split("@")[0],
    email,
    password: hashedPassword,
    role,
    status: role === "Business" ? "PENDING" : "ACTIVE",
  });

  // 6. Lưu mật khẩu vào lịch sử (để làm mốc so sánh cho lần đổi đầu tiên)
  await savePasswordHistory(user.id, hashedPassword);

  // 5. Nếu là Business, tạo Store với thông tin pháp lý
  // 5. Nếu là Business, tạo Store với thông tin pháp lý
  if (role === "Business") {
    const { business_license, bank_account, policy_accepted } = payload;
    await Store.create({
      owner_id: user.id,
      store_name,
      store_type: "B2C",
      address: address || null,
      business_license: business_license || null, // Mã số GPKD (text)
      business_license_image: file // Đường dẫn tương đối (để buildLicenseImageUrl ghép URL)
        ? `/uploads/${file.filename}`
        : null,
      tax_code,
      representative_name,
      identity_card,
      contact_phone,
      bank_account: bank_account || null,
      policy_accepted: policy_accepted === true || policy_accepted === "true",
      policy_accepted_at:
        policy_accepted === true || policy_accepted === "true"
          ? new Date()
          : null,
      fixed_fee_rate: 0.04,
      payment_fee_rate: 0.05,
      service_fee_rate: 0,
      return_fee_cap_standard: 40000,
      return_fee_cap_express: 20000,
      status: "PENDING",
    });
  }

  return user;
};

/**
 * Đăng nhập
 */
// const login = async (email, password) => {
//   const user = await userRepository.findByEmail(email);
//   if (!user) {
//     const error = new Error("Email hoặc mật khẩu không chính xác");
//     error.statusCode = 401;
//     throw error;
//   }

//   const isMatch = await bcrypt.compare(password, user.password);
//   if (!isMatch) {
//     const error = new Error("Email hoặc mật khẩu không chính xác");
//     error.statusCode = 401;
//     throw error;
//   }

//   const token = jwt.sign(
//     { id: user.id, role: user.role },
//     JWT_SECRET,
//     { expiresIn: JWT_EXPIRES_IN }
//   );

//   return { user, token };
// };
// const login = async ({ email, password }) => {
//   // Thêm dấu ngoặc nhọn {} để phân tách Object từ req.body
//   // 1. Kiểm tra đầu vào
//   if (!email || !password) {
//     throw {
//       statusCode: 400,
//       message: "Vui lòng nhập đầy đủ email và mật khẩu.",
//     };
//   }

//   // 2. Tìm User theo email
//   const user = await userRepository.findByEmail(email);
//   if (!user) {
//     throw { statusCode: 401, message: "Email hoặc mật khẩu không chính xác." };
//   }

//   // 3. So sánh mật khẩu
//   const isMatch = await bcrypt.compare(password, user.password);
//   if (!isMatch) {
//     throw { statusCode: 401, message: "Email hoặc mật khẩu không chính xác." };
//   }

//   // 4. Tạo Token (Bổ sung cả id và userId để tránh lỗi ở hàm claimDailyXu và updateProfile)
//   const token = jwt.sign(
//     {
//       id: user.id,
//       userId: user.id,
//       role: user.role,
//     },
//     JWT_SECRET,
//     { expiresIn: JWT_EXPIRES_IN },
//   );

//   return { user, token };
// };
const login = async ({ email, password }) => {
  console.log("=== BẮT ĐẦU ĐĂNG NHẬP ===");
  console.log("1. Payload nhận được:", { email, password });

  if (!email || !password) {
    throw {
      statusCode: 400,
      message: "Vui lòng nhập đầy đủ email và mật khẩu.",
    };
  }

  const user = await userRepository.findByEmail(email);
  console.log(
    "2. Kết quả tìm User:",
    user
      ? `Tìm thấy tài khoản: ${user.email}`
      : "NULL - Không tìm thấy email này trong DB",
  );

  if (!user) {
    throw { statusCode: 401, message: "Email hoặc mật khẩu không chính xác." };
  }

  const isMatch = await bcrypt.compare(password, user.password);
  console.log("3. Mật khẩu có khớp với Hash không?:", isMatch);

  if (!isMatch) {
    throw { statusCode: 401, message: "Email hoặc mật khẩu không chính xác." };
  }

  const token = jwt.sign(
    {
      id: user.id,
      userId: user.id,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );

  console.log("=== ĐĂNG NHẬP THÀNH CÔNG ===");
  return { user, token };
};
const getMe = async (userId) => {
  return await userRepository.findById(userId);
};

// --- Logic nhận Xu hàng ngày cho Customer ---
const DAILY_XU_AMOUNT = 1000;
const toDayKey = (date) =>
  date ? new Date(date).toISOString().split("T")[0] : null;

const getDailyXuStatus = async (userId) => {
  const user = await User.findByPk(userId, {
    attributes: ["id", "xu_balance", "last_xu_claim_at"],
  });
  if (!user) throw new Error("User not found");

  const canClaim = toDayKey(new Date()) !== toDayKey(user.last_xu_claim_at);
  return { xuBalance: Number(user.xu_balance || 0), canClaim };
};

const claimDailyXu = async (userId) => {
  const user = await User.findByPk(userId);
  if (user.role !== ROLE.CUSTOMER) {
    const error = new Error("Chỉ khách hàng mới được nhận Xu");
    error.statusCode = 403;
    throw error;
  }

  if (toDayKey(new Date()) === toDayKey(user.last_xu_claim_at)) {
    const error = new Error("Hôm nay bạn đã nhận rồi");
    error.statusCode = 400;
    throw error;
  }

  user.xu_balance = Number(user.xu_balance || 0) + DAILY_XU_AMOUNT;
  user.last_xu_claim_at = new Date();
  await user.save();

  return { message: "Nhận Xu thành công", newBalance: user.xu_balance };
};
// ... các hàm register, login, claimDailyXu ở phía trên ...

/**
 * Kích hoạt Shop C2C cho người dùng Customer hiện có
 */
const activateC2CStore = async (userId, payload) => {
  const {
    store_name,
    description,
    identity_card,
    address, // Đã có bóc tách
    contact_phone,
    contact_email,
    policy_accepted,
  } = payload;

  const fallbackPhone = contact_phone || null;

  return await Store.create({
    owner_id: userId,
    store_name,
    description,
    address, // <--- BẮT BUỘC THÊM DÒNG NÀY ĐỂ LƯU VÀO DB
    contact_email,
    contact_phone: fallbackPhone,
    identity_card,
    store_type: "C2C",
    status: "APPROVED",
    policy_accepted: policy_accepted === true,
    policy_accepted_at: new Date(),
    fixed_fee_rate: 0.04,
  });
};
// services/auth.service.js
const updateStoreInfo = async (userId, payload) => {
  const {
    store_name,
    description,
    contact_phone,
    contact_email,
    address,
    latitude,
    longitude,
  } = payload;

  const store = await Store.findOne({ where: { owner_id: userId } });
  if (!store)
    throw { statusCode: 404, message: "Không tìm thấy thông tin cửa hàng." };

  // Cập nhật các thông tin mới vào object store
  if (store_name) store.store_name = store_name.trim();
  if (description !== undefined) store.description = description;
  if (contact_phone) store.contact_phone = contact_phone.replace(/\D/g, "");
  if (contact_email) store.contact_email = contact_email.toLowerCase().trim();

  // QUAN TRỌNG: Thêm dòng này để cập nhật địa chỉ
  if (address) store.address = address;
  if (latitude !== undefined) store.latitude = latitude;

  if (longitude !== undefined) store.longitude = longitude;
  await store.save(); // Lưu xuống PostgreSQL
  return store;
};
/**
 * Gửi OTP đặt lại mật khẩu qua email
 */
const forgotPassword = async ({ email }) => {
  if (!email) {
    throw { statusCode: 400, message: "Vui lòng nhập email." };
  }

  const user = await User.findOne({ where: { email } });
  // Không tiết lộ email có tồn tại hay không (bảo mật)
  if (!user) {
    return { success: true, message: "Nếu email tồn tại, OTP đã được gửi." };
  }

  // Tạo OTP 6 chữ số
  const otp = crypto.randomInt(100000, 999999).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // Hết hạn sau 10 phút

  // Lưu OTP vào DB
  user.resetOtp = otp;
  user.resetOtpExpires = otpExpires;
  await user.save();

  // Gửi email qua nodemailer
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.MAIL_PORT) || 587,
    secure: process.env.MAIL_SECURE === "true",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"${process.env.MAIL_FROM || "ShopHub"}" <${process.env.MAIL_USER}>`,
    to: email,
    subject: "Mã OTP đặt lại mật khẩu - ShopHub",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #333;">🔐 Đặt lại mật khẩu</h2>
        <p>Bạn đã yêu cầu đặt lại mật khẩu. Dùng mã OTP bên dưới:</p>
        <div style="text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; color: #e74c3c; letter-spacing: 8px; padding: 10px 20px; background: #fdf2f2; border-radius: 8px;">${otp}</span>
        </div>
        <p style="color: #888; font-size: 13px;">Mã có hiệu lực trong <strong>10 phút</strong>. Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>
      </div>
    `,
  });

  console.log(`[Auth] OTP sent to ${email}`);
  return { success: true, message: "Nếu email tồn tại, OTP đã được gửi." };
};

/**
 * Đặt lại mật khẩu bằng OTP
 */
const resetPassword = async ({ email, otp, newPassword }) => {
  if (!email || !otp || !newPassword) {
    throw {
      statusCode: 400,
      message: "Vui lòng nhập đầy đủ email, OTP và mật khẩu mới.",
    };
  }

  // Kiểm tra độ mạnh mật khẩu mới (thay thế check length < 6 cũ)
  validatePasswordComplexity(newPassword);

  const user = await User.findOne({ where: { email } });
  if (!user || !user.resetOtp || !user.resetOtpExpires) {
    throw { statusCode: 400, message: "Mã OTP không hợp lệ hoặc đã hết hạn." };
  }

  // Kiểm tra OTP khớp
  if (user.resetOtp !== otp) {
    throw { statusCode: 400, message: "Mã OTP không chính xác." };
  }

  // Kiểm tra hết hạn
  if (new Date() > new Date(user.resetOtpExpires)) {
    throw {
      statusCode: 400,
      message: "Mã OTP đã hết hạn. Vui lòng yêu cầu lại.",
    };
  }

  // Kiểm tra mật khẩu mới không trùng với 3 mật khẩu gần nhất
  await checkPasswordHistory(user.id, newPassword);

  // Hash mật khẩu mới và lưu
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  user.resetOtp = null;
  user.resetOtpExpires = null;
  await user.save();

  // Lưu mật khẩu mới vào lịch sử
  await savePasswordHistory(user.id, hashedPassword);

  console.log(`[Auth] Password reset success for ${email}`);
  return { success: true, message: "Đổi mật khẩu thành công." };
};

// CẬP NHẬT PHẦN NÀY Ở CUỐI FILE:
module.exports = {
  register,
  login,
  getMe,
  getDailyXuStatus,
  claimDailyXu,
  activateC2CStore,
  updateStoreInfo,
  forgotPassword,
  resetPassword,
};
