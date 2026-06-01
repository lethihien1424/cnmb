const reviewService = require("../services/review.service");

const createReview = async (req, res) => {
  try {
    const userId = req.user.userId;

    const review = await reviewService.createReview(
      userId,
      req.body
    );

    res.json(review);
  } catch (err) {
    res.status(400).json({
      message: err.message,
    });
  }
};

const getReviewsByProduct = async (req, res) => {
  try {
    const reviews =
      await reviewService.getReviewsByProduct(
        req.params.productId
      );

    res.json(reviews);
  } catch (err) {
    res.status(400).json({
      message: err.message,
    });
  }
};

const getMyReviews = async (req, res) => {
  try {
    const reviews =
      await reviewService.getReviewsByBuyer(
        req.user.userId
      );

    res.json(reviews);
  } catch (err) {
    res.status(400).json({
      message: err.message,
    });
  }
};

module.exports = {
  createReview,
  getReviewsByProduct,
  getMyReviews,
};