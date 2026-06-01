const geocodeService =
  require("../services/geocode.service");

const searchLocation = async (
  req,
  res
) => {

  try {

    const { query } = req.query;

    if (!query) {

      return res.status(400).json({
        success: false,
        message: "Thiếu query",
      });
    }

    const result =
      await geocodeService.geocodeAddress(
        query
      );

    if (!result) {

      return res.status(404).json({
        success: false,
        message: "Không tìm thấy vị trí",
      });
    }

    return res.json({
      success: true,
      data: result,
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

module.exports = {
  searchLocation,
};