// const productRepository = require("../repositories/product.repository");
// const storeRepository = require("../repositories/store.repository");
// const aiService = require("./ai.service");
// const ROLE = {
//   CUSTOMER: "Customer",
//   BUSINESS: "Business",
// };

// const CONDITION = {
//   NEW: "NEW",
//   USED: "USED",
// };

// const validateConditionByRole = (role, condition) => {
//   if (!condition) {
//     const error = new Error("condition is required");
//     error.statusCode = 400;
//     throw error;
//   }

//   if (![CONDITION.NEW, CONDITION.USED].includes(condition)) {
//     const error = new Error("condition must be NEW or USED");
//     error.statusCode = 400;
//     throw error;
//   }
// };

// const parseBooleanField = (value, fieldName) => {
//   if (typeof value === "boolean") {
//     return value;
//   }

//   if (typeof value === "string") {
//     const normalized = value.trim().toLowerCase();
//     if (normalized === "true") {
//       return true;
//     }
//     if (normalized === "false") {
//       return false;
//     }
//   }

//   const error = new Error(`${fieldName} must be true or false`);
//   error.statusCode = 400;
//   throw error;
// };

// const parseIntegerField = (value, fieldName) => {
//   const parsedValue = Number(value);
//   if (!Number.isFinite(parsedValue) || !Number.isInteger(parsedValue)) {
//     const error = new Error(`${fieldName} must be an integer`);
//     error.statusCode = 400;
//     throw error;
//   }

//   return parsedValue;
// };

// const parsePriceField = (value, fieldName) => {
//   const parsedValue = Number(value);
//   if (!Number.isFinite(parsedValue) || parsedValue < 0) {
//     const error = new Error(`${fieldName} must be a valid non-negative number`);
//     error.statusCode = 400;
//     throw error;
//   }

//   return parsedValue;
// };

// const parseDateField = (value, fieldName) => {
//   if (!value) {
//     const error = new Error(`${fieldName} is required`);
//     error.statusCode = 400;
//     throw error;
//   }

//   const parsedDate = new Date(value);
//   if (Number.isNaN(parsedDate.getTime())) {
//     const error = new Error(`${fieldName} must be a valid datetime`);
//     error.statusCode = 400;
//     throw error;
//   }

//   return parsedDate;
// };

// const roundPriceByStep = (value, step = 1000) => {
//   return Math.max(step, Math.round(value / step) * step);
// };

// const getNextPreferredWindow = (stockQuantity) => {
//   const start = new Date();
//   start.setSeconds(0, 0);

//   const daysUntilFriday = (5 - start.getDay() + 7) % 7;
//   start.setDate(start.getDate() + daysUntilFriday);

//   if (stockQuantity >= 30) {
//     start.setHours(20, 0, 0, 0);
//   } else {
//     start.setHours(12, 0, 0, 0);
//   }

//   if (start <= new Date()) {
//     start.setDate(start.getDate() + 7);
//   }

//   const end = new Date(start);
//   end.setHours(end.getHours() + (stockQuantity >= 30 ? 4 : 2));

//   return { start, end };
// };

// const normalizeFlashSaleFields = (payload, currentState = {}) => {
//   const hasIsFlashSale = payload.is_flash_sale !== undefined;
//   const hasFlashSalePrice = payload.flash_sale_price !== undefined;
//   const hasFlashSaleStock = payload.flash_sale_stock !== undefined;
//   const hasFlashSaleSold = payload.flash_sale_sold !== undefined;

//   const hasFlashSalePayload =
//     hasIsFlashSale ||
//     hasFlashSalePrice ||
//     hasFlashSaleStock ||
//     hasFlashSaleSold;

//   if (!hasFlashSalePayload) {
//     return {};
//   }

//   const nextPrice =
//     payload.price !== undefined
//       ? parsePriceField(payload.price, "price")
//       : Number(currentState.price);

//   const nextIsFlashSale = hasIsFlashSale
//     ? parseBooleanField(payload.is_flash_sale, "is_flash_sale")
//     : Boolean(currentState.is_flash_sale);

//   if (!nextIsFlashSale) {
//     return {
//       is_flash_sale: false,
//       flash_sale_price: null,
//       flash_sale_stock: 0,
//       flash_sale_sold: 0,
//     };
//   }

//   const nextFlashSalePrice = hasFlashSalePrice
//     ? parsePriceField(payload.flash_sale_price, "flash_sale_price")
//     : currentState.flash_sale_price;

//   if (nextFlashSalePrice === undefined || nextFlashSalePrice === null) {
//     const error = new Error(
//       "flash_sale_price is required when is_flash_sale is true",
//     );
//     error.statusCode = 400;
//     throw error;
//   }

//   if (Number.isFinite(nextPrice) && Number(nextFlashSalePrice) > nextPrice) {
//     const error = new Error(
//       "flash_sale_price must be less than or equal to price",
//     );
//     error.statusCode = 400;
//     throw error;
//   }

//   const nextFlashSaleStock = hasFlashSaleStock
//     ? parseIntegerField(payload.flash_sale_stock, "flash_sale_stock")
//     : currentState.flash_sale_stock;

//   if (nextFlashSaleStock === undefined || nextFlashSaleStock === null) {
//     const error = new Error(
//       "flash_sale_stock is required when is_flash_sale is true",
//     );
//     error.statusCode = 400;
//     throw error;
//   }

//   if (nextFlashSaleStock < 0) {
//     const error = new Error(
//       "flash_sale_stock must be greater than or equal to 0",
//     );
//     error.statusCode = 400;
//     throw error;
//   }

//   const nextFlashSaleSold = hasFlashSaleSold
//     ? parseIntegerField(payload.flash_sale_sold, "flash_sale_sold")
//     : Number(currentState.flash_sale_sold || 0);

//   if (nextFlashSaleSold < 0) {
//     const error = new Error(
//       "flash_sale_sold must be greater than or equal to 0",
//     );
//     error.statusCode = 400;
//     throw error;
//   }

//   if (nextFlashSaleSold > nextFlashSaleStock) {
//     const error = new Error(
//       "flash_sale_sold cannot be greater than flash_sale_stock",
//     );
//     error.statusCode = 400;
//     throw error;
//   }

//   return {
//     is_flash_sale: true,
//     flash_sale_price: nextFlashSalePrice,
//     flash_sale_stock: nextFlashSaleStock,
//     flash_sale_sold: nextFlashSaleSold,
//   };
// };

// const validateManagedStore = async (storeId, user) => {
//   if (!storeId) {
//     const error = new Error("store_id is required");
//     error.statusCode = 400;
//     throw error;
//   }

//   const store = await storeRepository.findStoreById(storeId);
//   if (!store) {
//     const error = new Error("Store not found");
//     error.statusCode = 404;
//     throw error;
//   }

//   if (store.owner_id !== user.userId) {
//     const error = new Error("You do not have permission for this store");
//     error.statusCode = 403;
//     throw error;
//   }

//   if (store.status !== "APPROVED") {
//     const error = new Error("Store must be APPROVED to manage products");
//     error.statusCode = 403;
//     throw error;
//   }

//   if (user.role === ROLE.CUSTOMER && store.store_type !== "C2C") {
//     const error = new Error("Customer can only manage products in C2C store");
//     error.statusCode = 403;
//     throw error;
//   }

//   if (user.role === ROLE.BUSINESS && store.store_type !== "B2C") {
//     const error = new Error("Business can only manage products in B2C store");
//     error.statusCode = 403;
//     throw error;
//   }

//   return store;
// };

// const createProduct = async (payload, user, imageUrls) => {
//   // payload ở đây đã được lấy từ req.body (đảm bảo từ FormData gửi lên)
//   const {
//     name,
//     price,
//     stock_quantity,
//     condition,
//     store_id,
//     size,
//     color,
//     type,
//     is_bulky,
//   } = payload;

//   if (!name) throw new Error("name is required");

//   await validateManagedStore(store_id, user);
//   // Validate and normalize basic numeric/boolean fields
//   const normalizedPrice = price !== undefined ? Number(price) : undefined;
//   if (normalizedPrice === undefined || Number.isNaN(normalizedPrice)) {
//     const error = new Error("price is required and must be a number");
//     error.statusCode = 400;
//     throw error;
//   }

//   const normalizedStock =
//     stock_quantity !== undefined ? Number(stock_quantity) : 0;
//   if (Number.isNaN(normalizedStock) || !Number.isInteger(normalizedStock)) {
//     const error = new Error("stock_quantity must be an integer");
//     error.statusCode = 400;
//     throw error;
//   }

//   if (!condition) {
//     const error = new Error("condition is required");
//     error.statusCode = 400;
//     throw error;
//   }

//   // Ensure images are taken from middleware (req.imageUrls passed in as imageUrls)
//   const imagesToSave = Array.isArray(imageUrls) ? imageUrls : [];

//   // Parse variants safely
//   let formattedVariants = [];
//   try {
//     formattedVariants = validateAndFormatVariants(payload.variants || []);
//   } catch (err) {
//     const error = new Error(`invalid variants: ${err.message}`);
//     error.statusCode = 400;
//     throw error;
//   }

//   // Extract and de-duplicate color and size from variants
//   const finalColor =
//     formattedVariants.length > 0
//       ? [
//           ...new Set(formattedVariants.map((v) => v.color).filter(Boolean)),
//         ].join(", ")
//       : color || "";
//   const finalSize =
//     formattedVariants.length > 0
//       ? [...new Set(formattedVariants.map((v) => v.size).filter(Boolean))].join(
//           ", ",
//         )
//       : size || "";

//   const { finalPrice, finalStock } = computeFinalPriceAndStock({
//     normalizedPrice,
//     normalizedStock,
//     formattedVariants,
//   });

//   // Build repository payload
//   const repoPayload = {
//     name,
//     price: finalPrice,
//     stock_quantity: finalStock,
//     condition,
//     store_id,
//     size: finalSize,
//     color: finalColor,
//     type,
//     is_bulky: is_bulky === true || is_bulky === "true",
//     images: imagesToSave,
//     variants: formattedVariants,
//   };

//   return productRepository.createProduct(repoPayload);
// };

// // Backend/services/product.service.js
// const validateAndFormatVariants = (variants) => {
//   if (!variants) return [];
//   let parsed = typeof variants === "string" ? JSON.parse(variants) : variants;
//   if (!Array.isArray(parsed)) throw new Error("variants must be an array");
//   return parsed.map((v) => ({
//     color: v.color || "",
//     size: v.size || "",
//     price: Number(v.price || 0),
//     stock_quantity: Number(v.stock_quantity || 0),
//   }));
// };

// const computeFinalPriceAndStock = ({
//   normalizedPrice,
//   normalizedStock,
//   formattedVariants,
// }) => {
//   let finalPrice = normalizedPrice;
//   let finalStock = normalizedStock;

//   if (formattedVariants.length > 0) {
//     const validPrices = formattedVariants
//       .map((variant) => Number(variant.price))
//       .filter((price) => Number.isFinite(price) && price > 0);

//     if (validPrices.length > 0) {
//       finalPrice = Math.min(...validPrices);
//     }

//     finalStock = formattedVariants.reduce(
//       (sum, variant) => sum + (Number(variant.stock_quantity) || 0),
//       0,
//     );
//   }

//   return { finalPrice, finalStock };
// };

// const updateProduct = async (id, payload, user, imageUrls) => {
//   const product = await productRepository.findProductById(id);
//   // ... (kiểm tra product)

//   // Parse và chuẩn hóa variants qua validateAndFormatVariants
//   // để đảm bảo các trường price, stock_quantity đều là số hợp lệ
//   let formattedVariants = [];
//   try {
//     formattedVariants = validateAndFormatVariants(payload.variants || []);
//   } catch (err) {
//     const error = new Error(`invalid variants: ${err.message}`);
//     error.statusCode = 400;
//     throw error;
//   }

//   const uniqueColors = [
//     ...new Set(formattedVariants.map((v) => v.color).filter(Boolean)),
//   ].join(", ");
//   const uniqueSizes = [
//     ...new Set(formattedVariants.map((v) => v.size).filter(Boolean)),
//   ].join(", ");

//   const normalizedPrice =
//     payload.price !== undefined ? Number(payload.price) : Number(product.price);
//   const normalizedStock =
//     payload.stock_quantity !== undefined
//       ? Number(payload.stock_quantity)
//       : Number(product.stock_quantity);

//   const { finalPrice, finalStock } = computeFinalPriceAndStock({
//     normalizedPrice,
//     normalizedStock,
//     formattedVariants,
//   });

//   // CẬP NHẬT DỮ LIỆU
//   const updatedData = {
//     ...payload,
//     price: finalPrice,
//     stock_quantity: finalStock,
//     variants: formattedVariants, // Lưu toàn bộ mảng JSON đã chuẩn hóa vào cột variants
//     color: uniqueColors || payload.color || "",
//     size: uniqueSizes || payload.size || "",
//     // images: imageUrls.length > 0 ? imageUrls : product.images,
//     images:
//       imageUrls.length > 0 ? [...product.images, ...imageUrls] : product.images,
//   };

//   await product.update(updatedData);
//   return product;
// };
// const deleteProduct = async (id, user) => {
//   const product = await productRepository.findProductById(id);
//   if (!product) {
//     const error = new Error("Product not found");
//     error.statusCode = 404;
//     throw error;
//   }

//   await validateManagedStore(product.store_id, user);

//   await productRepository.deleteProduct(product);
// };

// const searchProducts = async (query) => {
//   let {
//     keyword,
//     minPrice,
//     maxPrice,
//     category_id: categoryId,
//     store_type: storeType,
//     limit,
//     offset,
//     use_ai,
//   } = query;

//   if (use_ai === "true" && keyword && keyword.length > 3) {
//     const aiParams = await aiService.parseSearchQuery(keyword);
//     if (aiParams) {
//       keyword = aiParams.keyword || keyword;
//       if (aiParams.minPrice !== null && aiParams.minPrice !== undefined)
//         minPrice = aiParams.minPrice;
//       if (aiParams.maxPrice !== null && aiParams.maxPrice !== undefined)
//         maxPrice = aiParams.maxPrice;
//       if (aiParams.category_id) categoryId = aiParams.category_id;
//     }
//   }

//   const parsedMinPrice =
//     minPrice !== undefined && minPrice !== "" ? Number(minPrice) : undefined;
//   const parsedMaxPrice =
//     maxPrice !== undefined && maxPrice !== "" ? Number(maxPrice) : undefined;

//   if (parsedMinPrice !== undefined && Number.isNaN(parsedMinPrice)) {
//     const error = new Error("minPrice must be a number");
//     error.statusCode = 400;
//     throw error;
//   }

//   if (parsedMaxPrice !== undefined && Number.isNaN(parsedMaxPrice)) {
//     const error = new Error("maxPrice must be a number");
//     error.statusCode = 400;
//     throw error;
//   }

//   if (
//     parsedMinPrice !== undefined &&
//     parsedMaxPrice !== undefined &&
//     parsedMinPrice > parsedMaxPrice
//   ) {
//     const error = new Error("minPrice cannot be greater than maxPrice");
//     error.statusCode = 400;
//     throw error;
//   }

//   if (storeType && !["C2C", "B2C"].includes(storeType)) {
//     const error = new Error("store_type must be C2C or B2C");
//     error.statusCode = 400;
//     throw error;
//   }

//   const parsedLimit = Number(limit);
//   const parsedOffset = Number(offset);

//   const safeLimit =
//     Number.isFinite(parsedLimit) && parsedLimit > 0
//       ? Math.min(parsedLimit, 100)
//       : 10;
//   const safeOffset =
//     Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

//   const { count, rows } = await productRepository.searchProducts({
//     keyword,
//     minPrice: parsedMinPrice,
//     maxPrice: parsedMaxPrice,
//     categoryId,
//     storeType,
//     limit: safeLimit,
//     offset: safeOffset,
//   });

//   return {
//     items: rows,
//     pagination: {
//       limit: safeLimit,
//       offset: safeOffset,
//       totalItems: count,
//       totalPages: Math.ceil(count / safeLimit),
//     },
//   };
// };

// const getProductDetail = async (id) => {
//   const product = await productRepository.findProductDetailById(id);

//   if (!product) {
//     const error = new Error("Product not found");
//     error.statusCode = 404;
//     throw error;
//   }

//   return product;
// };

// const setFlashSale = async (id, payload, user) => {
//   const product = await productRepository.findProductById(id);
//   if (!product) {
//     const error = new Error("Product not found");
//     error.statusCode = 404;
//     throw error;
//   }

//   await validateManagedStore(product.store_id, user);

//   const normalizedFlashData = normalizeFlashSaleFields(payload, {
//     price: product.price,
//     is_flash_sale: product.is_flash_sale,
//     flash_sale_price: product.flash_sale_price,
//     flash_sale_stock: product.flash_sale_stock,
//     flash_sale_sold: product.flash_sale_sold,
//   });

//   await product.update(normalizedFlashData);
//   return product;
// };

// const scheduleFlashSale = async (id, payload, user) => {
//   const product = await productRepository.findProductById(id);
//   if (!product) {
//     const error = new Error("Product not found");
//     error.statusCode = 404;
//     throw error;
//   }

//   await validateManagedStore(product.store_id, user);

//   const flashSalePrice = parsePriceField(
//     payload.flash_sale_price,
//     "flash_sale_price",
//   );
//   const startTime = parseDateField(
//     payload.flash_sale_start_time,
//     "flash_sale_start_time",
//   );
//   const endTime = parseDateField(
//     payload.flash_sale_end_time,
//     "flash_sale_end_time",
//   );

//   if (endTime <= startTime) {
//     const error = new Error(
//       "flash_sale_end_time must be after flash_sale_start_time",
//     );
//     error.statusCode = 400;
//     throw error;
//   }

//   if (flashSalePrice >= Number(product.price)) {
//     const error = new Error("flash_sale_price must be less than price");
//     error.statusCode = 400;
//     throw error;
//   }

//   const requestedStock =
//     payload.flash_sale_stock !== undefined
//       ? parseIntegerField(payload.flash_sale_stock, "flash_sale_stock")
//       : Math.min(Number(product.stock_quantity || 0), 20);

//   if (requestedStock <= 0) {
//     const error = new Error("flash_sale_stock must be greater than 0");
//     error.statusCode = 400;
//     throw error;
//   }

//   if (requestedStock > Number(product.stock_quantity || 0)) {
//     const error = new Error("flash_sale_stock cannot exceed stock_quantity");
//     error.statusCode = 400;
//     throw error;
//   }

//   const now = new Date();
//   const isActiveNow = startTime <= now && endTime >= now;

//   await product.update({
//     is_flash_sale: isActiveNow,
//     flash_sale_price: flashSalePrice,
//     flash_sale_stock: requestedStock,
//     flash_sale_sold: 0,
//     flash_sale_start_time: startTime,
//     flash_sale_end_time: endTime,
//   });

//   return product;
// };

// const suggestFlashSale = async (id, user) => {
//   const product = await productRepository.findProductById(id);
//   if (!product) {
//     const error = new Error("Product not found");
//     error.statusCode = 404;
//     throw error;
//   }

//   await validateManagedStore(product.store_id, user);

//   const basePrice = Number(product.price);
//   const stockQuantity = Number(product.stock_quantity || 0);

//   if (!Number.isFinite(basePrice) || basePrice <= 1) {
//     const error = new Error(
//       "Product price is too low to generate a valid flash sale suggestion",
//     );
//     error.statusCode = 400;
//     throw error;
//   }

//   if (stockQuantity <= 0) {
//     const error = new Error(
//       "Product is out of stock, cannot generate flash sale suggestion",
//     );
//     error.statusCode = 400;
//     throw error;
//   }

//   let discountRate = 0.12;
//   if (stockQuantity >= 100) {
//     discountRate = 0.35;
//   } else if (stockQuantity >= 50) {
//     discountRate = 0.3;
//   } else if (stockQuantity >= 20) {
//     discountRate = 0.22;
//   } else if (stockQuantity >= 10) {
//     discountRate = 0.18;
//   }

//   const suggestedPrice = roundPriceByStep(basePrice * (1 - discountRate));
//   const { start, end } = getNextPreferredWindow(stockQuantity);
//   const suggestedStock = Math.max(
//     1,
//     Math.min(stockQuantity, stockQuantity >= 30 ? 30 : 10),
//   );
//   const maxDiscountedPrice = Math.max(1, Math.floor(basePrice - 1));
//   const safeSuggestedPrice = Math.max(
//     1,
//     Math.min(suggestedPrice, maxDiscountedPrice),
//   );

//   return {
//     product_id: product.id,
//     product_name: product.name,
//     original_price: basePrice,
//     stock_quantity: stockQuantity,
//     suggested_flash_sale_price: safeSuggestedPrice,
//     suggested_flash_sale_stock: suggestedStock,
//     suggested_flash_sale_start_time: start.toISOString(),
//     suggested_flash_sale_end_time: end.toISOString(),
//     rationale:
//       stockQuantity >= 30
//         ? "Ton kho cao, de xuat giam sau hon va chay khung toi thu 6 de tang toc do chot don."
//         : "Ton kho vua/it, de xuat muc giam vua phai va khung trua thu 6 de toi uu ti le chuyen doi.",
//   };
// };

// module.exports = {
//   createProduct,
//   updateProduct, // Chỉ cần xuất 1 lần duy nhất
//   deleteProduct,
//   searchProducts,
//   getProductDetail,
//   setFlashSale,
//   scheduleFlashSale,
//   suggestFlashSale,
//   validateAndFormatVariants,
// };
const productRepository = require("../repositories/product.repository");
const storeRepository = require("../repositories/store.repository");
const aiService = require("./ai.service");

const ROLE = {
  CUSTOMER: "Customer",
  BUSINESS: "Business",
};

const CONDITION = {
  NEW: "NEW",
  USED: "USED",
};

const validateConditionByRole = (role, condition) => {
  if (!condition) {
    const error = new Error("condition is required");
    error.statusCode = 400;
    throw error;
  }

  if (![CONDITION.NEW, CONDITION.USED].includes(condition)) {
    const error = new Error("condition must be NEW or USED");
    error.statusCode = 400;
    throw error;
  }
};

const parseBooleanField = (value, fieldName) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  const error = new Error(`${fieldName} must be true or false`);
  error.statusCode = 400;
  throw error;
};

const parseIntegerField = (value, fieldName) => {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue) || !Number.isInteger(parsedValue)) {
    const error = new Error(`${fieldName} must be an integer`);
    error.statusCode = 400;
    throw error;
  }

  return parsedValue;
};

const parsePriceField = (value, fieldName) => {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    const error = new Error(`${fieldName} must be a valid non-negative number`);
    error.statusCode = 400;
    throw error;
  }

  return parsedValue;
};

const parseDateField = (value, fieldName) => {
  if (!value) {
    const error = new Error(`${fieldName} is required`);
    error.statusCode = 400;
    throw error;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    const error = new Error(`${fieldName} must be a valid datetime`);
    error.statusCode = 400;
    throw error;
  }

  return parsedDate;
};

const roundPriceByStep = (value, step = 1000) => {
  return Math.max(step, Math.round(value / step) * step);
};

const getNextPreferredWindow = (stockQuantity) => {
  const start = new Date();
  start.setSeconds(0, 0);

  const daysUntilFriday = (5 - start.getDay() + 7) % 7;
  start.setDate(start.getDate() + daysUntilFriday);

  if (stockQuantity >= 30) {
    start.setHours(20, 0, 0, 0);
  } else {
    start.setHours(12, 0, 0, 0);
  }

  if (start <= new Date()) {
    start.setDate(start.getDate() + 7);
  }

  const end = new Date(start);
  end.setHours(end.getHours() + (stockQuantity >= 30 ? 4 : 2));

  return { start, end };
};

const normalizeFlashSaleFields = (payload, currentState = {}) => {
  const hasIsFlashSale = payload.is_flash_sale !== undefined;
  const hasFlashSalePrice = payload.flash_sale_price !== undefined;
  const hasFlashSaleStock = payload.flash_sale_stock !== undefined;
  const hasFlashSaleSold = payload.flash_sale_sold !== undefined;

  const hasFlashSalePayload =
    hasIsFlashSale ||
    hasFlashSalePrice ||
    hasFlashSaleStock ||
    hasFlashSaleSold;

  if (!hasFlashSalePayload) {
    return {};
  }

  const nextPrice =
    payload.price !== undefined
      ? parsePriceField(payload.price, "price")
      : Number(currentState.price);

  const nextIsFlashSale = hasIsFlashSale
    ? parseBooleanField(payload.is_flash_sale, "is_flash_sale")
    : Boolean(currentState.is_flash_sale);

  if (!nextIsFlashSale) {
    return {
      is_flash_sale: false,
      flash_sale_price: null,
      flash_sale_stock: 0,
      flash_sale_sold: 0,
    };
  }

  const nextFlashSalePrice = hasFlashSalePrice
    ? parsePriceField(payload.flash_sale_price, "flash_sale_price")
    : currentState.flash_sale_price;

  if (nextFlashSalePrice === undefined || nextFlashSalePrice === null) {
    const error = new Error(
      "flash_sale_price is required when is_flash_sale is true",
    );
    error.statusCode = 400;
    throw error;
  }

  if (Number.isFinite(nextPrice) && Number(nextFlashSalePrice) > nextPrice) {
    const error = new Error(
      "flash_sale_price must be less than or equal to price",
    );
    error.statusCode = 400;
    throw error;
  }

  const nextFlashSaleStock = hasFlashSaleStock
    ? parseIntegerField(payload.flash_sale_stock, "flash_sale_stock")
    : currentState.flash_sale_stock;

  if (nextFlashSaleStock === undefined || nextFlashSaleStock === null) {
    const error = new Error(
      "flash_sale_stock is required when is_flash_sale is true",
    );
    error.statusCode = 400;
    throw error;
  }

  if (nextFlashSaleStock < 0) {
    const error = new Error(
      "flash_sale_stock must be greater than or equal to 0",
    );
    error.statusCode = 400;
    throw error;
  }

  const nextFlashSaleSold = hasFlashSaleSold
    ? parseIntegerField(payload.flash_sale_sold, "flash_sale_sold")
    : Number(currentState.flash_sale_sold || 0);

  if (nextFlashSaleSold < 0) {
    const error = new Error(
      "flash_sale_sold must be greater than or equal to 0",
    );
    error.statusCode = 400;
    throw error;
  }

  if (nextFlashSaleSold > nextFlashSaleStock) {
    const error = new Error(
      "flash_sale_sold cannot be greater than flash_sale_stock",
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    is_flash_sale: true,
    flash_sale_price: nextFlashSalePrice,
    flash_sale_stock: nextFlashSaleStock,
    flash_sale_sold: nextFlashSaleSold,
  };
};

const validateManagedStore = async (storeId, user) => {
  if (!storeId) {
    const error = new Error("store_id is required");
    error.statusCode = 400;
    throw error;
  }

  const store = await storeRepository.findStoreById(storeId);
  if (!store) {
    const error = new Error("Store not found");
    error.statusCode = 404;
    throw error;
  }

  if (store.owner_id !== user.userId) {
    const error = new Error("You do not have permission for this store");
    error.statusCode = 403;
    throw error;
  }

  if (store.status !== "APPROVED") {
    const error = new Error("Store must be APPROVED to manage products");
    error.statusCode = 403;
    throw error;
  }

  if (user.role === ROLE.CUSTOMER && store.store_type !== "C2C") {
    const error = new Error("Customer can only manage products in C2C store");
    error.statusCode = 403;
    throw error;
  }

  if (user.role === ROLE.BUSINESS && store.store_type !== "B2C") {
    const error = new Error("Business can only manage products in B2C store");
    error.statusCode = 403;
    throw error;
  }

  return store;
};

// --- CÁC HÀM TIỆN ÍCH BẮT BUỘC PHẢI KHÔI PHỤC ---
const validateAndFormatVariants = (variants) => {
  if (!variants) return [];
  let parsed = typeof variants === "string" ? JSON.parse(variants) : variants;
  if (!Array.isArray(parsed)) throw new Error("variants must be an array");
  return parsed.map((v) => ({
    color: v.color || "",
    size: v.size || "",
    price: Number(v.price || 0),
    stock_quantity: Number(v.stock_quantity || 0),
  }));
};

const computeFinalPriceAndStock = ({
  normalizedPrice,
  normalizedStock,
  formattedVariants,
}) => {
  let finalPrice = normalizedPrice;
  let finalStock = normalizedStock;

  if (formattedVariants.length > 0) {
    const validPrices = formattedVariants
      .map((variant) => Number(variant.price))
      .filter((price) => Number.isFinite(price) && price > 0);

    if (validPrices.length > 0) {
      finalPrice = Math.min(...validPrices);
    }

    finalStock = formattedVariants.reduce(
      (sum, variant) => sum + (Number(variant.stock_quantity) || 0),
      0,
    );
  }

  return { finalPrice, finalStock };
};

// --- HÀM TẠO SẢN PHẨM HOÀN CHỈNH - FIX MÔ TẢ & DANH MỤC ---
const createProduct = async (payload, user, imageUrls) => {
  const {
    name,
    price,
    stock_quantity,
    condition,
    store_id,
    category_id,
    categoryId,
    size,
    color,
    type,
    is_bulky,
    description,
  } = payload;

  if (!name) throw new Error("name is required");

  // Đảm bảo chạy async validate cửa hàng hợp lệ
  await validateManagedStore(store_id, user);

  // Chuẩn hóa dữ liệu số học
  const normalizedPrice = price !== undefined ? Number(price) : undefined;
  if (normalizedPrice === undefined || Number.isNaN(normalizedPrice)) {
    const error = new Error("price is required and must be a number");
    error.statusCode = 400;
    throw error;
  }

  const normalizedStock =
    stock_quantity !== undefined ? Number(stock_quantity) : 0;
  if (Number.isNaN(normalizedStock) || !Number.isInteger(normalizedStock)) {
    const error = new Error("stock_quantity must be an integer");
    error.statusCode = 400;
    throw error;
  }

  if (!condition) {
    const error = new Error("condition is required");
    error.statusCode = 400;
    throw error;
  }

  // Thu thập danh sách ảnh upload
  const imagesToSave = Array.isArray(imageUrls) ? imageUrls : [];

  // Parse và định dạng lại mảng biến thể nhận được từ FE
  let formattedVariants = [];
  try {
    formattedVariants = validateAndFormatVariants(payload.variants || []);
  } catch (err) {
    const error = new Error(`invalid variants: ${err.message}`);
    error.statusCode = 400;
    throw error;
  }

  // Tự động gộp màu sắc và size từ variants nếu FE gửi mảng
  const finalColor =
    formattedVariants.length > 0
      ? [
          ...new Set(formattedVariants.map((v) => v.color).filter(Boolean)),
        ].join(", ")
      : color || "";
  const finalSize =
    formattedVariants.length > 0
      ? [...new Set(formattedVariants.map((v) => v.size).filter(Boolean))].join(
          ", ",
        )
      : size || "";

  // Tính toán lại tổng kho và giá nhỏ nhất dựa trên biến thể
  const { finalPrice, finalStock } = computeFinalPriceAndStock({
    normalizedPrice,
    normalizedStock,
    formattedVariants,
  });

  // Xác định chuẩn xác mã danh mục không để thất thoát
  const finalCategoryId = category_id || categoryId || null;

  // Đóng gói payload sạch sẽ đẩy sang Repository để lưu DB
  const repoPayload = {
    name: name.trim(),
    price: finalPrice,
    stock_quantity: finalStock,
    condition,
    store_id,
    category_id: finalCategoryId, // <--- ĐÃ FIX: Lưu danh mục chuẩn xác
    description: description || "", // <--- ĐÃ FIX: Lưu mô tả đầy đủ
    size: finalSize,
    color: finalColor,
    type: type || "",
    is_bulky: is_bulky === true || is_bulky === "true",
    images: imagesToSave,
    variants: formattedVariants,
  };

  return productRepository.createProduct(repoPayload);
};

const updateProduct = async (id, payload, user, imageUrls) => {
  const product = await productRepository.findProductById(id);
  if (!product) {
    const error = new Error("Product not found");
    error.statusCode = 404;
    throw error;
  }

  await validateManagedStore(product.store_id, user);

  let formattedVariants = [];
  try {
    formattedVariants = validateAndFormatVariants(payload.variants || []);
  } catch (err) {
    const error = new Error(`invalid variants: ${err.message}`);
    error.statusCode = 400;
    throw error;
  }

  const uniqueColors = [
    ...new Set(formattedVariants.map((v) => v.color).filter(Boolean)),
  ].join(", ");
  const uniqueSizes = [
    ...new Set(formattedVariants.map((v) => v.size).filter(Boolean)),
  ].join(", ");

  const normalizedPrice =
    payload.price !== undefined ? Number(payload.price) : Number(product.price);
  const normalizedStock =
    payload.stock_quantity !== undefined
      ? Number(payload.stock_quantity)
      : Number(product.stock_quantity);

  const { finalPrice, finalStock } = computeFinalPriceAndStock({
    normalizedPrice,
    normalizedStock,
    formattedVariants,
  });

  const finalCategoryId =
    payload.category_id || payload.categoryId || product.category_id;

  const updatedData = {
    ...payload,
    price: finalPrice,
    stock_quantity: finalStock,
    category_id: finalCategoryId,
    variants: formattedVariants,
    color: uniqueColors || payload.color || "",
    size: uniqueSizes || payload.size || "",
    images:
      imageUrls && imageUrls.length > 0
        ? [...product.images, ...imageUrls]
        : product.images,
  };

  await product.update(updatedData);
  return product;
};

const deleteProduct = async (id, user) => {
  const product = await productRepository.findProductById(id);
  if (!product) {
    const error = new Error("Product not found");
    error.statusCode = 404;
    throw error;
  }

  await validateManagedStore(product.store_id, user);
  // Đặt trạng thái DISCONTINUED trước khi soft-delete
  await product.update({ status: "DISCONTINUED" });
  await productRepository.deleteProduct(product);
};

const searchProducts = async (query) => {
  let {
    keyword,
    minPrice,
    maxPrice,
    category_id: categoryId,
    store_type: storeType,
    limit,
    offset,
    use_ai,
    include_discontinued,
  } = query;

  if (use_ai === "true" && keyword && keyword.length > 3) {
    const aiParams = await aiService.parseSearchQuery(keyword);
    if (aiParams) {
      keyword = aiParams.keyword || keyword;
      if (aiParams.minPrice !== null && aiParams.minPrice !== undefined)
        minPrice = aiParams.minPrice;
      if (aiParams.maxPrice !== null && aiParams.maxPrice !== undefined)
        maxPrice = aiParams.maxPrice;
      if (aiParams.category_id) categoryId = aiParams.category_id;
    }
  }

  const parsedMinPrice =
    minPrice !== undefined && minPrice !== "" ? Number(minPrice) : undefined;
  const parsedMaxPrice =
    maxPrice !== undefined && maxPrice !== "" ? Number(maxPrice) : undefined;

  if (parsedMinPrice !== undefined && Number.isNaN(parsedMinPrice)) {
    const error = new Error("minPrice must be a number");
    error.statusCode = 400;
    throw error;
  }

  if (parsedMaxPrice !== undefined && Number.isNaN(parsedMaxPrice)) {
    const error = new Error("maxPrice must be a number");
    error.statusCode = 400;
    throw error;
  }

  if (
    parsedMinPrice !== undefined &&
    parsedMaxPrice !== undefined &&
    parsedMinPrice > parsedMaxPrice
  ) {
    const error = new Error("minPrice cannot be greater than maxPrice");
    error.statusCode = 400;
    throw error;
  }

  if (storeType && !["C2C", "B2C"].includes(storeType)) {
    const error = new Error("store_type must be C2C or B2C");
    error.statusCode = 400;
    throw error;
  }

  const parsedLimit = Number(limit);
  const parsedOffset = Number(offset);

  const safeLimit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 100)
      : 10;
  const safeOffset =
    Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

  const { count, rows } = await productRepository.searchProducts({
    keyword,
    minPrice: parsedMinPrice,
    maxPrice: parsedMaxPrice,
    categoryId,
    storeType,
    limit: safeLimit,
    offset: safeOffset,
    includeDiscontinued: include_discontinued === "true",
  });

  return {
    items: rows,
    pagination: {
      limit: safeLimit,
      offset: safeOffset,
      totalItems: count,
      totalPages: Math.ceil(count / safeLimit),
    },
  };
};

const getProductDetail = async (id) => {
  const product = await productRepository.findProductDetailById(id);

  if (!product) {
    const error = new Error("Product not found");
    error.statusCode = 404;
    throw error;
  }

  return product;
};

const setFlashSale = async (id, payload, user) => {
  const product = await productRepository.findProductById(id);
  if (!product) {
    const error = new Error("Product not found");
    error.statusCode = 404;
    throw error;
  }

  await validateManagedStore(product.store_id, user);

  const normalizedFlashData = normalizeFlashSaleFields(payload, {
    price: product.price,
    is_flash_sale: product.is_flash_sale,
    flash_sale_price: product.flash_sale_price,
    flash_sale_stock: product.flash_sale_stock,
    flash_sale_sold: product.flash_sale_sold,
  });

  await product.update(normalizedFlashData);
  return product;
};

const scheduleFlashSale = async (id, payload, user) => {
  const product = await productRepository.findProductById(id);
  if (!product) {
    const error = new Error("Product not found");
    error.statusCode = 404;
    throw error;
  }

  await validateManagedStore(product.store_id, user);

  const flashSalePrice = parsePriceField(
    payload.flash_sale_price,
    "flash_sale_price",
  );
  const startTime = parseDateField(
    payload.flash_sale_start_time,
    "flash_sale_start_time",
  );
  const endTime = parseDateField(
    payload.flash_sale_end_time,
    "flash_sale_end_time",
  );

  if (endTime <= startTime) {
    const error = new Error(
      "flash_sale_end_time must be after flash_sale_start_time",
    );
    error.statusCode = 400;
    throw error;
  }

  if (flashSalePrice >= Number(product.price)) {
    const error = new Error("flash_sale_price must be less than price");
    error.statusCode = 400;
    throw error;
  }

  const requestedStock =
    payload.flash_sale_stock !== undefined
      ? parseIntegerField(payload.flash_sale_stock, "flash_sale_stock")
      : Math.min(Number(product.stock_quantity || 0), 20);

  if (requestedStock <= 0) {
    const error = new Error("flash_sale_stock must be greater than 0");
    error.statusCode = 400;
    throw error;
  }

  if (requestedStock > Number(product.stock_quantity || 0)) {
    const error = new Error("flash_sale_stock cannot exceed stock_quantity");
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();
  const isActiveNow = startTime <= now && endTime >= now;

  await product.update({
    is_flash_sale: isActiveNow,
    flash_sale_price: flashSalePrice,
    flash_sale_stock: requestedStock,
    flash_sale_sold: 0,
    flash_sale_start_time: startTime,
    flash_sale_end_time: endTime,
  });

  return product;
};

const borderPriceByStep = roundPriceByStep; // Fallback mapping nếu cần

const suggestFlashSale = async (id, user) => {
  const product = await productRepository.findProductById(id);
  if (!product) {
    const error = new Error("Product not found");
    error.statusCode = 404;
    throw error;
  }

  await validateManagedStore(product.store_id, user);

  const basePrice = Number(product.price);
  const stockQuantity = Number(product.stock_quantity || 0);

  if (!Number.isFinite(basePrice) || basePrice <= 1) {
    const error = new Error(
      "Product price is too low to generate a valid flash sale suggestion",
    );
    error.statusCode = 400;
    throw error;
  }

  if (stockQuantity <= 0) {
    const error = new Error(
      "Product is out of stock, cannot generate flash sale suggestion",
    );
    error.statusCode = 400;
    throw error;
  }

  let discountRate = 0.12;
  if (stockQuantity >= 100) {
    discountRate = 0.35;
  } else if (stockQuantity >= 50) {
    discountRate = 0.3;
  } else if (stockQuantity >= 20) {
    discountRate = 0.22;
  } else if (stockQuantity >= 10) {
    discountRate = 0.18;
  }

  const suggestedPrice = roundPriceByStep(basePrice * (1 - discountRate));
  const { start, end } = getNextPreferredWindow(stockQuantity);
  const suggestedStock = Math.max(
    1,
    Math.min(stockQuantity, stockQuantity >= 30 ? 30 : 10),
  );
  const maxDiscountedPrice = Math.max(1, Math.floor(basePrice - 1));
  const safeSuggestedPrice = Math.max(
    1,
    Math.min(suggestedPrice, maxDiscountedPrice),
  );

  return {
    product_id: product.id,
    product_name: product.name,
    original_price: basePrice,
    stock_quantity: stockQuantity,
    suggested_flash_sale_price: safeSuggestedPrice,
    suggested_flash_sale_stock: suggestedStock,
    suggested_flash_sale_start_time: start.toISOString(),
    suggested_flash_sale_end_time: end.toISOString(),
    rationale:
      stockQuantity >= 30
        ? "Ton kho cao, de xuat giam sau hon va chay khung toi thu 6 de tang toc do chot don."
        : "Ton kho vua/it, de xuat muc giam vua phai va khung trua thu 6 de toi uu ti le chuyen doi.",
  };
};

const toggleProductStatus = async (id, user) => {
  const product = await productRepository.findProductById(id);
  if (!product) {
    const error = new Error("Product not found");
    error.statusCode = 404;
    throw error;
  }

  await validateManagedStore(product.store_id, user);

  const newStatus =
    product.status === "AVAILABLE" ? "DISCONTINUED" : "AVAILABLE";
  const updated = await productRepository.updateProductStatus(id, newStatus);
  return updated;
};

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
  getProductDetail,
  setFlashSale,
  scheduleFlashSale,
  suggestFlashSale,
  validateAndFormatVariants,
  toggleProductStatus,
};
