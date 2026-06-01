const { Review, User, Product } = require("../models");

const createReview = async (data) => {
  return await Review.create(data);
};

const getReviewsByProduct = async (productId) => {
  return await Review.findAll({
    where: {
      product_id: productId,
    },
    include: [
      {
        model: User,
        as: "buyer",
        attributes: ["id", "username"],
      },
    ],
    order: [["created_at", "DESC"]],
  });
};

const getReviewsByBuyer = async (buyerId) => {
  return await Review.findAll({
    where: {
      buyer_id: buyerId,
    },
    include: [
      {
        model: Product,
        as: "product",
        attributes: ["id", "name", "images"],
        paranoid: false, // Bao gồm cả sản phẩm đã soft-delete (ngừng bán)
      },
    ],
    order: [["created_at", "DESC"]],
  });
};

module.exports = {
  createReview,
  getReviewsByProduct,
  getReviewsByBuyer,
};
