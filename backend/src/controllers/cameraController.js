const pool = require("../config/database");

// ==========================================
// GET ALL CAMERAS
// ==========================================

const getCameras = async (req, res) => {
  try {
    const { status } = req.query;
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const paginationValues = status ? [status, limit, offset] : [limit, offset];
    const result = await pool.query(`
      SELECT
        c.id,
        c.camera_id,
        c.name,
        c.camera_type,
        c.vendor,
        c.model,
        c.ownership,
        c.location_name,
        c.latitude,
        c.longitude,
        c.status,
        c.retention_days,
        d.name AS department_name,
        v.name AS vms_name,
        h.status AS health_status,
        h.last_seen AS health_last_seen,
        h.recorded_at AS health_recorded_at,
        s.webrtc_url,
        s.hls_url,
        s.rtsp_url,
        s.codec AS stream_codec,
        s.width AS stream_width,
        s.height AS stream_height
      FROM cameras c
      LEFT JOIN departments d
        ON c.department_id = d.id
      LEFT JOIN vms_systems v
        ON c.vms_id = v.id
      LEFT JOIN LATERAL (
        SELECT status, last_seen, recorded_at
        FROM camera_health
        WHERE camera_id = c.id
        ORDER BY recorded_at DESC
        LIMIT 1
      ) h ON true
      LEFT JOIN LATERAL (
        SELECT rtsp_url, webrtc_url, hls_url, codec, width, height
        FROM streams
        WHERE camera_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) s ON true
      ${status ? "WHERE c.status = $1" : ""}
      ORDER BY c.created_at DESC
      LIMIT $${status ? 2 : 1} OFFSET $${status ? 3 : 2}
    `, paginationValues);

    res.json({
      success: true,
      count: result.rows.length,
      limit,
      offset,
      cameras: result.rows,
    });
  } catch (error) {
    console.error("Get cameras error:", error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Internal AI-service mapping: creates/updates a Sentinel catalogue camera
// without requiring geographic coordinates that the catalogue does not supply.
const upsertSentinelCamera = async (req, res) => {
  try {
    const { sentinel_id, name, location, live, codec, width, height, fps, bitrate_kbps, rtsp_url, webrtc_url, hls_live_url, latitude, longitude } = req.body;
    if (sentinel_id === undefined || sentinel_id === null) {
      return res.status(400).json({ success: false, message: "sentinel_id is required" });
    }
    const cameraId = `SENTINEL-${sentinel_id}`;
    const result = await pool.query(
      `INSERT INTO cameras (camera_id, name, camera_type, vendor, ownership, location_name, connectivity, status)
       VALUES ($1, $2, 'IP', 'Sentinel', 'Government', $3, 'RTSP', $4)
       ON CONFLICT (camera_id) DO UPDATE SET
         name = EXCLUDED.name, location_name = EXCLUDED.location_name,
         status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
       RETURNING id, camera_id, name, location_name, status`,
      [cameraId, name || `Sentinel Camera ${sentinel_id}`, location || null, live ? "DISCOVERED" : "OFFLINE"]
    );
    const camera = result.rows[0];
    if (latitude !== undefined && longitude !== undefined && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))) {
      await pool.query(`UPDATE cameras SET latitude = $1, longitude = $2, location = ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, updated_at = CURRENT_TIMESTAMP WHERE id = $3`, [Number(latitude), Number(longitude), camera.id]);
    }
    await pool.query(
      `INSERT INTO streams (camera_id, protocol, stream_url, stream_type, resolution, fps, status,
        rtsp_url, webrtc_url, hls_url, codec, width, height, bitrate_kbps, source)
       VALUES ($1, 'RTSP', $2, 'LIVE', $3, $4, $5, $2, $6, $7, $8, $9, $10, $11, 'SENTINEL')
       ON CONFLICT (camera_id, protocol) DO UPDATE SET
         stream_url = EXCLUDED.stream_url, resolution = EXCLUDED.resolution, fps = EXCLUDED.fps,
         status = EXCLUDED.status, rtsp_url = EXCLUDED.rtsp_url, webrtc_url = EXCLUDED.webrtc_url,
         hls_url = EXCLUDED.hls_url, codec = EXCLUDED.codec, width = EXCLUDED.width,
         height = EXCLUDED.height, bitrate_kbps = EXCLUDED.bitrate_kbps`,
      // The streams table stores FPS as INTEGER; Sentinel may report decimal
      // values such as 12.5, so normalize at the API boundary.
      [camera.id, rtsp_url || null, width && height ? `${width}x${height}` : null, Number.isFinite(Number(fps)) ? Math.round(Number(fps)) : null,
       live ? "DISCOVERED" : "OFFLINE", webrtc_url || null, hls_live_url || null, codec || null,
       Number(width) || null, Number(height) || null, Number(bitrate_kbps) || null]
    );
    res.json({ success: true, camera });
  } catch (error) {
    console.error("Sentinel camera upsert error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getCameraDetections = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM detections WHERE camera_id = $1 ORDER BY detected_at DESC LIMIT 100`, [req.params.id]
    );
    res.json({ success: true, count: result.rows.length, detections: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getCameraHealth = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM camera_health WHERE camera_id = $1 ORDER BY recorded_at DESC LIMIT 100`, [req.params.id]
    );
    res.json({ success: true, count: result.rows.length, health: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const recordCameraHealth = async (req, res) => {
  try {
    const { status, last_seen, latency_ms } = req.body;
    if (!status) return res.status(400).json({ success: false, message: "status is required" });
    const result = await pool.query(
      `INSERT INTO camera_health (camera_id, status, last_seen, latency_ms)
       VALUES ($1, $2, COALESCE($3, CURRENT_TIMESTAMP), $4) RETURNING *`,
      [req.params.id, status, last_seen || null, latency_ms ?? null]
    );
    await pool.query("UPDATE cameras SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [status, req.params.id]);
    res.status(201).json({ success: true, health: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ==========================================
// GET CAMERA BY ID
// ==========================================

const getCameraById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        c.*,
        d.name AS department_name,
        v.name AS vms_name
      FROM cameras c
      LEFT JOIN departments d
        ON c.department_id = d.id
      LEFT JOIN vms_systems v
        ON c.vms_id = v.id
      WHERE c.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Camera not found",
      });
    }

    res.json({
      success: true,
      camera: result.rows[0],
    });
  } catch (error) {
    console.error("Get camera error:", error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ==========================================
// CREATE CAMERA
// ==========================================

const createCamera = async (req, res) => {
  try {
    const {
      camera_id,
      department_id,
      vms_id,
      name,
      camera_type,
      vendor,
      model,
      serial_number,
      ownership,
      location_name,
      latitude,
      longitude,
      connectivity,
      retention_days,
      status,
      installation_date,
      rtsp_url,
      webrtc_url,
      hls_url,
    } = req.body;

    if (!camera_id || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: "camera_id, latitude and longitude are required",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO cameras (
        camera_id,
        department_id,
        vms_id,
        name,
        camera_type,
        vendor,
        model,
        serial_number,
        ownership,
        location_name,
        latitude,
        longitude,
        location,
        connectivity,
        retention_days,
        status,
        installation_date
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12,
        ST_SetSRID(ST_MakePoint($12, $11), 4326)::geography,
        $13, $14, $15, $16
      )
      RETURNING *
      `,
      [
        camera_id,
        department_id || null,
        vms_id || null,
        name || null,
        camera_type || null,
        vendor || null,
        model || null,
        serial_number || null,
        ownership || null,
        location_name || null,
        latitude,
        longitude,
        connectivity || null,
        retention_days || null,
        status || "UNKNOWN",
        installation_date || null,
      ]
    );

    if (rtsp_url || webrtc_url || hls_url) {
      await pool.query(`INSERT INTO streams(camera_id, protocol, stream_url, stream_type, status, rtsp_url, webrtc_url, hls_url, source) VALUES($1,'RTSP',$2,'LIVE','CONFIGURED',$2,$3,$4,'MANUAL')`, [result.rows[0].id, rtsp_url || null, webrtc_url || null, hls_url || null]);
    }

    res.status(201).json({
      success: true,
      message: "Camera registered successfully",
      camera: result.rows[0],
    });
  } catch (error) {
    console.error("Create camera error:", error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ==========================================
// DELETE CAMERA
// ==========================================

const deleteCamera = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM cameras WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Camera not found",
      });
    }

    res.json({
      success: true,
      message: "Camera deleted successfully",
    });
  } catch (error) {
    console.error("Delete camera error:", error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const updateCamera = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location_name, status, connectivity, latitude, longitude } = req.body;
    const result = await pool.query(
      `UPDATE cameras SET name = COALESCE($1, name), location_name = COALESCE($2, location_name),
       status = COALESCE($3, status), connectivity = COALESCE($4, connectivity),
       latitude = COALESCE($5, latitude), longitude = COALESCE($6, longitude), updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`,
      [name ?? null, location_name ?? null, status ?? null, connectivity ?? null, latitude ?? null, longitude ?? null, id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: "Camera not found" });
    res.json({ success: true, camera: result.rows[0] });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
};

// Bulk onboarding accepts validated JSON rows from a CSV/import adapter. The
// transaction ensures a partial upload never leaves the registry inconsistent.
const bulkCreateCameras = async (req, res) => {
  const cameras = Array.isArray(req.body.cameras) ? req.body.cameras : [];
  if (!cameras.length || cameras.length > 1000) return res.status(400).json({ success: false, error: { code: "INVALID_BATCH", message: "cameras must contain 1 to 1000 rows" } });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const camera of cameras) {
      if (!camera.camera_id || !Number.isFinite(Number(camera.latitude)) || !Number.isFinite(Number(camera.longitude))) throw new Error("Each camera requires camera_id, latitude, and longitude");
      await client.query(`INSERT INTO cameras (camera_id,name,location_name,latitude,longitude,location,status,connectivity,camera_type,ownership) VALUES ($1,$2,$3,$4,$5,ST_SetSRID(ST_MakePoint($5,$4),4326)::geography,COALESCE($6,'UNKNOWN'),$7,$8,$9) ON CONFLICT (camera_id) DO UPDATE SET name=EXCLUDED.name,location_name=EXCLUDED.location_name,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,location=EXCLUDED.location,updated_at=CURRENT_TIMESTAMP`, [camera.camera_id, camera.name || null, camera.location_name || null, Number(camera.latitude), Number(camera.longitude), camera.status, camera.connectivity || null, camera.camera_type || "IP", camera.ownership || "Government"]);
    }
    await client.query("COMMIT");
    res.status(201).json({ success: true, data: { imported: cameras.length } });
  } catch (error) { await client.query("ROLLBACK"); res.status(400).json({ success: false, error: { code: "BULK_IMPORT_FAILED", message: error.message } }); }
  finally { client.release(); }
};

module.exports = {
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
};
