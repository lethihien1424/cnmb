const express = require("express");
const reviewController = require("../controllers/review.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post(
  "/",
  verifyToken,
  reviewController.createReview
);

router.get(
  "/product/:productId",
  reviewController.getReviewsByProduct
);

router.get(
  "/me",
  verifyToken,
  reviewController.getMyReviews
);

module.exports = router;