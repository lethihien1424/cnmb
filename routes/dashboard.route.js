const express =
require("express");

const router =
  express.Router();

const dashboardController =
require(
  "../controllers/dashboard.controller"
);

const {
  verifyToken,
  checkRole,
} = require(
  "../middlewares/auth.middleware"
);

const {
  checkStoreOwner,
} = require(
  "../middlewares/checkStoreOwner"
);

router.get(
  "/store-overview/:storeId",

  verifyToken,

  checkRole(["Business", "Customer"]),

  checkStoreOwner,

  dashboardController.getStoreOverview,
);

module.exports = router;