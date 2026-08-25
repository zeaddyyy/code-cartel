const express = require("express");

const {
  getCameras,
  getCameraById,
  createCamera,
  deleteCamera,
  upsertSentinelCamera,
  getCameraDetections,
  getCameraHealth,
  recordCameraHealth,
  updateCamera,
} = require("../controllers/cameraController");

const router = express.Router();

router.get("/", getCameras);

router.post("/sentinel/upsert", upsertSentinelCamera);
router.get("/:id/detections", getCameraDetections);
router.get("/:id/health", getCameraHealth);
router.post("/:id/health", recordCameraHealth);

router.get("/:id", getCameraById);

router.post("/", createCamera);

router.delete("/:id", deleteCamera);
router.put("/:id", updateCamera);

module.exports = router;
