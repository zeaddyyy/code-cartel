const express = require("express");

const {
  getSentinelCameras,
  syncSentinelCameras,
} = require("../controllers/sentinelController");

const router = express.Router();

router.get("/cameras", getSentinelCameras);

router.post("/sync", syncSentinelCameras);

module.exports = router;