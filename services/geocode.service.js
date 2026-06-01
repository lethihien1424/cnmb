const axios = require("axios");

const geocodeAddress = async (query) => {

  try {

    const url =
      `https://nominatim.openstreetmap.org/search`;

    const response = await axios.get(url, {
      params: {
        q: query,
        format: "json",
        limit: 1,
      },

      headers: {
        "User-Agent":
          "CongNgheMoi/1.0",
      },
    });

    const data = response.data;

    if (!data || !data.length) {
      return null;
    }

    return {
      lat: Number(data[0].lat),
      lng: Number(data[0].lon),
    };

  } catch (err) {

    console.error("geocode error:", err.message);

    return null;
  }
};

module.exports = {
  geocodeAddress,
};