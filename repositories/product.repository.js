const { Op } = require("sequelize");
const { Product, Store, User, Category } = require("../models");

const createProduct = async (payload) => {
  return await Product.create({
    name: payload.name,
    price: payload.price,
    stock_quantity: payload.stock_quantity,
    condition: payload.condition,
    store_id: payload.store_id,
    category_id: payload.category_id,
    description: payload.description,
    images: payload.images,
    // ÁNH XẠ CÁC CỘT MỚI TỪ PAYLOAD
    color: payload.color, // Đảm bảo lấy từ payload
    size: payload.size, // Đảm bảo lấy từ payload
    type: payload.type, // Đảm bảo lấy từ payload
    is_bulky: payload.is_bulky, // Đảm bảo lấy từ payload
    variants: payload.variants, // Đảm bảo lấy từ payload (kiểu JSON)
  });
};

const findProductById = async (id) => {
  return Product.findByPk(id, { paranoid: false });
};

const findProductsByIdsForUpdate = async (ids, transaction) => {
  return Product.findAll({
    where: {
      id: {
        [Op.in]: ids,
      },
    },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
};

const deleteProduct = async (product) => {
  return product.destroy();
};

const searchProducts = async ({
  keyword,
  minPrice,
  maxPrice,
  categoryId,
  storeType,
  limit,
  offset,
  includeDiscontinued = false,
}) => {
  const where = {};

  // Chỉ hiển thị sản phẩm AVAILABLE cho khách hàng (mặc định)
  // Khi includeDiscontinued=true (seller dashboard), hiển thị tất cả
  if (!includeDiscontinued) {
    where.status = "AVAILABLE";
    where.deleted_at = null;
  }

  if (keyword) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${keyword}%` } },
      { "$store.store_name$": { [Op.iLike]: `%${keyword}%` } },
      { "$category.name$": { [Op.iLike]: `%${keyword}%` } },
    ];
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {};
    if (minPrice !== undefined) {
      where.price[Op.gte] = minPrice;
    }
    if (maxPrice !== undefined) {
      where.price[Op.lte] = maxPrice;
    }
  }

  if (categoryId) {
    where.category_id = categoryId;
  }

  const includeStore = {
    model: Store,
    as: "store",
    attributes: ["id", "store_name", "store_type", "status"],
    include: [
      {
        model: User,
        as: "owner",
        attributes: ["id", "username", "email", "role", "status"],
      },
    ],
  };

  if (storeType) {
    includeStore.where = { store_type: storeType };
    includeStore.required = true;
  }

  const includeCategory = {
    model: Category,
    as: "category",
    attributes: ["id", "name"],
  };

  return Product.findAndCountAll({
    where,
    include: [includeStore, includeCategory],
    limit,
    offset,
    order: [["created_at", "DESC"]],
    distinct: true,
    paranoid: false, // Vẫn dùng paranoid:false để query đúng, nhưng where clause đã lọc
  });
};

const findProductDetailById = async (id) => {
  return Product.findByPk(id, {
    paranoid: false, // Bao gồm cả sản phẩm đã soft-delete
    include: [
      {
        model: Store,
        as: "store",
        attributes: [
          "id",
          "store_name",
          "store_type",
          "description",
          "status",
          "owner_id",
        ],
        include: [
          {
            model: User,
            as: "owner",
            attributes: ["id", "username", "email", "role", "status"],
          },
        ],
      },
    ],
  });
};

const updateProductStatus = async (id, status) => {
  const product = await Product.findByPk(id, { paranoid: false });
  if (!product) return null;
  product.status = status;
  await product.save();
  return product;
};

module.exports = {
  createProduct,
  findProductById,
  findProductsByIdsForUpdate,
  deleteProduct,
  searchProducts,
  findProductDetailById,
  updateProductStatus,
};
