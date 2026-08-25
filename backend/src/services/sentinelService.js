const axios = require("axios");

const SENTINEL_HOST =
  process.env.SENTINEL_HOST || "https://live.corp8.cloud";

const getCameraCatalogue = async () => {
  const url = `${SENTINEL_HOST}/api/ingest`;

  const response = await axios.get(url, {
    timeout: 60000,
    headers: {
      Accept: "application/json",
      "User-Agent": "NetraX/1.0",
    },
  });

  return response.data;
};

module.exports = {
  getCameraCatalogue,
};