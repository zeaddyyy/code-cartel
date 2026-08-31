const express = require("express");
const { requireAdmin } = require("../middleware/adminAuth");

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
  bulkCreateCameras,
} = require("../controllers/cameraController");

const router = express.Router();

router.get("/", getCameras);
router.post("/bulk", requireAdmin, bulkCreateCameras);

router.post("/sentinel/upsert", upsertSentinelCamera);
router.get("/:id/detections", getCameraDetections);
router.get("/:id/health", getCameraHealth);
router.post("/:id/health", recordCameraHealth);

router.get("/:id", getCameraById);

router.post("/", requireAdmin, createCamera);

router.delete("/:id", requireAdmin, deleteCamera);
router.put("/:id", requireAdmin, updateCamera);

module.exports = router;
