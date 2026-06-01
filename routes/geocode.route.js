const express = require("express");

const router = express.Router();

const ctrl =
  require("../controllers/geocode.controller");

router.get(
  "/search",
  ctrl.searchLocation
);

module.exports = router;