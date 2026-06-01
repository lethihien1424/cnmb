//D:\CNM_cu\CongNgheMoi\Backend\controllers\product.controller.js
const productService = require("../services/product.service");
const vectorService = require("../services/vector.service");

// Trong controller.js
const createProduct = async (req, res) => {
  try {
    const payload = { ...req.body };

    console.log("Payload nhận được từ FE (createProduct):", {
      color: payload.color,
      size: payload.size,
    });

    // BẮT BUỘC: Nếu variants là chuỗi, phải biến nó thành Object trước khi đưa vào repository
    if (typeof payload.variants === "string") {
      payload.variants = JSON.parse(payload.variants);
    }

    // Tương tự với is_bulky nếu nó là chuỗi 'true'/'false'
    if (typeof payload.is_bulky === "string") {
      payload.is_bulky = payload.is_bulky === "true";
    }

    const result = await productService.createProduct(
      payload,
      req.user,
      req.imageUrls,
    );

    // Real-time sync: đẩy sản phẩm mới lên Qdrant (fire-and-forget)
    vectorService
      .upsertSingleProduct(result)
      .catch((err) =>
        console.error("[Vector DB] Lỗi upsert sau createProduct:", err.message),
      );

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
// Backend/controllers/product.controller.js

const updateProduct = async (req, res) => {
  try {
    const payload = { ...req.body };

    console.log("Payload nhận được từ FE (updateProduct):", {
      color: payload.color,
      size: payload.size,
    });

    // Sửa lỗi boolean: nếu là chuỗi rỗng hoặc undefined, ép về false
    if (
      payload.is_bulky === "" ||
      payload.is_bulky === undefined ||
      payload.is_bulky === null
    ) {
      payload.is_bulky = false;
    } else {
      payload.is_bulky =
        payload.is_bulky === "true" || payload.is_bulky === true;
    }

    // Parse variants
    if (typeof payload.variants === "string") {
      payload.variants = JSON.parse(payload.variants);
    }

    const result = await productService.updateProduct(
      req.params.id,
      payload,
      req.user,
      req.imageUrls || [],
    );

    // Real-time sync: cập nhật vector sản phẩm trên Qdrant (fire-and-forget)
    vectorService
      .upsertSingleProduct(result)
      .catch((err) =>
        console.error("[Vector DB] Lỗi upsert sau updateProduct:", err.message),
      );

    res.status(200).json(result);
  } catch (error) {
    console.error("LỖI:", error);
    res.status(400).json({ message: error.message });
  }
};
const deleteProduct = async (req, res) => {
  try {
    await productService.deleteProduct(req.params.id, req.user);

    // Real-time sync: xóa vector sản phẩm khỏi Qdrant (fire-and-forget)
    vectorService
      .deleteProductVector(req.params.id)
      .catch((err) =>
        console.error(
          "[Vector DB] Lỗi xóa vector sau deleteProduct:",
          err.message,
        ),
      );

    return res.status(200).json({
      message: "Delete product success",
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};

const searchProducts = async (req, res) => {
  try {
    const result = await productService.searchProducts(req.query);
    return res.status(200).json({
      message: "Get products success",
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};

const getProductDetail = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format to prevent database CastError (500 crash)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        message: `ID sản phẩm không hợp lệ: "${id}". Vui lòng kiểm tra lại.`,
      });
    }

    const result = await productService.getProductDetail(id);
    return res.status(200).json({
      message: "Get product detail success",
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};
const setFlashSale = async (req, res) => {
  try {
    console.log("setFlashSale payload:", req.body);
    const result = await productService.setFlashSale(
      req.params.id,
      req.body,
      req.user,
    );

    return res.status(200).json({
      message: "Update flash sale success",
      data: result,
    });
  } catch (error) {
    console.error("setFlashSale error:", error.message);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};

const scheduleFlashSale = async (req, res) => {
  try {
    const result = await productService.scheduleFlashSale(
      req.params.id,
      req.body,
      req.user,
    );

    return res.status(200).json({
      message: "Schedule flash sale success",
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};

const suggestFlashSale = async (req, res) => {
  try {
    const result = await productService.suggestFlashSale(
      req.params.id,
      req.user,
    );

    return res.status(200).json({
      message: "Suggest flash sale success",
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};
const toggleProductStatus = async (req, res) => {
  try {
    const result = await productService.toggleProductStatus(
      req.params.id,
      req.user,
    );

    // Real-time sync: cập nhật vector sản phẩm trên Qdrant (fire-and-forget)
    if (result.status === "DISCONTINUED") {
      vectorService
        .deleteProductVector(req.params.id)
        .catch((err) =>
          console.error(
            "[Vector DB] Lỗi xóa vector sau toggleProductStatus (DISCONTINUED):",
            err.message,
          ),
        );
    } else {
      vectorService
        .upsertSingleProduct(result)
        .catch((err) =>
          console.error(
            "[Vector DB] Lỗi upsert sau toggleProductStatus (AVAILABLE):",
            err.message,
          ),
        );
    }

    return res.status(200).json({
      message: "Toggle product status success",
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};

// Kiểm tra ở cuối file của bạn, phải chắc chắn có 'updateProduct' ở đây:
module.exports = {
  createProduct,
  updateProduct, // Dòng này PHẢI CÓ
  deleteProduct,
  searchProducts,
  getProductDetail,
  setFlashSale,
  scheduleFlashSale,
  suggestFlashSale,
  toggleProductStatus,
};
