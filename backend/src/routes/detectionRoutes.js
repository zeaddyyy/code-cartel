const express = require("express");

const {
  createDetection,
  getRecentDetections,
} = require("../controllers/detectionController");

const router = express.Router();

router.post("/", createDetection);

router.get("/", getRecentDetections);
router.get("/recent", getRecentDetections);

module.exports = router;
