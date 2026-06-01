const authService = require("../services/auth.service");
const aiService = require("../services/ai.service");
const { User } = require("../models");
const voucherService = require("../services/voucher.service");
const fs = require("fs");

// const register = async (req, res) => {
//   try {
//     const role = req.body?.role;

//     // ── STEP 0: AI Vision — Kiểm tra dấu mộc đỏ nếu đăng ký Business ──
//     if (role === "Business") {
//       const licenseFile = req.files?.["business_license_image"]?.[0];
//       if (licenseFile) {
//         try {
//           const imageBuffer = fs.readFileSync(licenseFile.path);
//           const base64Image = imageBuffer.toString("base64");
//           const mimeType = licenseFile.mimetype || "image/jpeg";

//           console.log(`[AI Stamp] Đang kiểm tra dấu mộc đỏ: ${licenseFile.originalname}`);
//           const hasStamp = await aiService.verifyBusinessLicenseStamp(base64Image, mimeType);

//           if (!hasStamp) {
//             // Xóa file đã upload trước khi từ chối
//             fs.unlink(licenseFile.path, () => {});
//             return res.status(400).json({
//               message:
//                 "Giấy phép không hợp lệ (Thiếu dấu mộc đỏ). Vui lòng tải lên ảnh GPKD gốc có dấu mộc tròn đỏ của cơ quan nhà nước.",
//             });
//           }
//           console.log("[AI Stamp] Xác thực thành công: Có dấu mộc đỏ.");
//         } catch (aiErr) {
//           // Không block đăng ký nếu AI bị lỗi kết nối
//           console.error("[AI Stamp] Lỗi kết nối AI:", aiErr.message);
//         }
//       }
//     }

//     // ── STEP 1: Gộp dữ liệu từ body và link ảnh (từ middleware) ──
//     const payload = {
//       ...req.body,
//       // business_license giữ nguyên từ req.body (mã số text)
//       // business_license_image: URL ảnh từ middleware multer
//       business_license_image: req.documentUrls?.business_license_image || null,
//       ...(req.documentUrls?.front_id_image && {
//         front_id_image: req.documentUrls.front_id_image,
//       }),
//       ...(req.documentUrls?.back_id_image && {
//         back_id_image: req.documentUrls.back_id_image,
//       }),
//     };

//     const result = await authService.register(payload);

//     return res.status(201).json({
//       message: "Register success",
//       data: result,
//     });
//   } catch (error) {
//     return res.status(error.statusCode || 500).json({
//       message: error.message || "Internal server error",
//     });
//   }
// };

// ==========================================
// 1. DÁN HÀM REGISTER "X-RAY" VÀO ĐÂY
// Backend/controllers/auth.controller.js

const register = async (req, res) => {
  try {
    console.log("[Auth] ===== REGISTER REQUEST =====");
    console.log("[Auth] Content-Type:", req.headers["content-type"]);
    console.log("[Auth] Body:", JSON.stringify(req.body, null, 2));
    console.log("[Auth] Files:", req.files ? Object.keys(req.files) : "none");
    const { role, representative_name, tax_code } = req.body;

    // ── AI OCR: Chỉ kiểm tra nếu là Business ──
    if (role === "Business") {
      const file = req.files?.["business_license_image"]?.[0];
      if (!file) {
        return res.status(400).json({
          message: "Vui lòng tải lên ảnh Giấy Phép Kinh Doanh để đăng ký B2C.",
        });
      }

      try {
        const base64Image = fs.readFileSync(file.path, { encoding: "base64" });
        const aiResult = await aiService.verifyBusinessLicenseStamp(
          base64Image,
          file.mimetype,
          representative_name,
          tax_code,
        );

        if (!aiResult.is_correct_owner) {
          fs.unlink(file.path, () => {});
          return res.status(400).json({
            message: `Xác thực GPKD thất bại: ${aiResult.reason}`,
          });
        }
        console.log("[AI OCR] Xác thực thành công:", aiResult.reason);
      } catch (aiErr) {
        console.error("[AI OCR] Lỗi, cho qua:", aiErr.message);
      }
    }

    // ── Đăng ký user ──
    const file = req.files?.["business_license_image"]?.[0] || null;
    const result = await authService.register(req.body, file);

    // ======================
    // TỰ ĐỘNG CẤP VOUCHER CHO NGƯỜI MỚI
    // ======================
    if (result && result.id) {
      try {
        await voucherService.grantDefaultVouchers(result.id, true);
        console.log(
          `[Auto Voucher] Đã cấp voucher mặc định cho user ${result.id}`,
        );
      } catch (voucherErr) {
        console.error("[Auto Voucher] Lỗi cấp voucher:", voucherErr.message);
        // Không throw lỗi để không ảnh hưởng việc đăng ký
      }
    }

    return res.status(201).json({
      message: "Đăng ký thành công! Bạn đã nhận được một số voucher ưu đãi.",
      data: result,
    });
  } catch (error) {
    console.error(
      "[Auth] ❌ REGISTER FAILED:",
      error.statusCode,
      error.message,
    );
    console.error("[Auth] Full error:", JSON.stringify(error, null, 2));
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};
const login = async (req, res) => {
  try {
    const result = await authService.login(req.body);
    return res.status(200).json({
      message: "Login success",
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const result = await authService.forgotPassword(req.body);
    return res.status(200).json({
      message: "If the email exists, OTP has been sent",
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const result = await authService.resetPassword(req.body);
    return res.status(200).json({
      message: "Password reset success",
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};

const getDailyXuStatus = async (req, res) => {
  try {
    const result = await authService.getDailyXuStatus(req.user.userId);
    return res.status(200).json({
      message: "Lấy trạng thái Xu thành công",
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};

const claimDailyXu = async (req, res) => {
  try {
    const result = await authService.claimDailyXu(req.user.userId);
    return res.status(200).json({
      message: "Nhận 100 Xu thành công",
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};

// HÀM CẬP NHẬT HỒ SƠ ĐÃ ĐƯỢC CHỈNH LẠI
const updateProfile = async (req, res) => {
  try {
    // req.user.id lấy từ middleware xác thực token (bạn đang dùng JWT)
    const userId = req.user.id;
    const { username, address } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    // Cập nhật thông tin (nếu người dùng có gửi lên)
    if (username) user.username = username;
    if (address) user.address = address;

    await user.save();

    // Trả về dữ liệu user mới (không trả về password)
    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      address: user.address,
    };

    res
      .status(200)
      .json({ message: "Cập nhật hồ sơ thành công", data: userData });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// GỘP CHUNG XUẤT RA MỘT LẦN DUY NHẤT Ở ĐÂY
module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  updateProfile,
  getDailyXuStatus,
  claimDailyXu,
};
