const path = require("path");
const multer = require("multer");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `document-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Chỉ chấp nhận file ảnh!"), false);
  },
});

// Middleware xử lý sản phẩm
const uploadProductImages = [
  upload.array("images", 10),
  (req, res, next) => {
    // Đảm bảo req.imageUrls luôn là một mảng, kể cả khi không có file
    req.imageUrls = req.files
      ? req.files.map((f) => `/uploads/${f.filename}`)
      : [];
    next();
  },
];

// Middleware xử lý tài liệu shop
const uploadStoreDocuments = [
  upload.fields([
    { name: "business_license_image", maxCount: 1 },
    { name: "front_id_image", maxCount: 1 },
    { name: "back_id_image", maxCount: 1 },
  ]),
  (req, res, next) => {
    req.documentUrls = {};
    if (req.files) {
      Object.keys(req.files).forEach((fieldName) => {
        req.documentUrls[fieldName] =
          `/uploads/${req.files[fieldName][0].filename}`;
      });
    }
    next();
  },
];

// Middleware xử lý avatar người dùng (1 file duy nhất)
const uploadAvatar = upload.single("avatar_file");

module.exports = { uploadProductImages, uploadStoreDocuments, uploadAvatar };
