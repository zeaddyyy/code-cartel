require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");

const pool = require("./config/database");
const cameraRoutes = require("./routes/cameraRoutes");
const sentinelRoutes = require("./routes/sentinelRoutes");
const detectionRoutes = require("./routes/detectionRoutes");
const app = express();
const snapshotRoot = path.resolve(process.env.SNAPSHOT_DIR || "/tmp/netrax_snapshots");

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
// Evidence files are served through a basename-only route to prevent path
// traversal and to make browser snapshot loading deterministic.
app.get("/api/snapshots/:filename", (req, res) => {
  const filename = path.basename(decodeURIComponent(req.params.filename));
  const filePath = path.join(snapshotRoot, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: "Snapshot not found" });
  // The dashboard is served from port 5173 while evidence is served from the
  // API on port 5001. Allow image embedding without weakening other routes.
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  return res.sendFile(filePath);
});
app.use("/api/snapshots", express.static(snapshotRoot, {
  index: false,
  fallthrough: false,
  setHeaders: (res) => res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"),
}));

app.use("/api/cameras", cameraRoutes);
app.use("/api/sentinel", sentinelRoutes);
app.use("/api/detections", detectionRoutes);
// ==========================================
// BASIC ROUTES
// ==========================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "NetraX API is running",
    version: "1.0.0",
  });
});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "NetraX Backend",
    status: "healthy",
  });
});

// ==========================================
// DATABASE TEST
// ==========================================

app.get("/api/db-test", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        NOW() AS server_time,
        PostGIS_Version() AS postgis_version
    `);

    res.json({
      success: true,
      database: "netrax_db",
      postgis: result.rows[0].postgis_version,
      serverTime: result.rows[0].server_time,
    });
  } catch (error) {
    console.error("Database test failed:", error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`🚨 NetraX API running on http://localhost:${PORT}`);
});
