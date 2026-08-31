const pool = require("../config/database");

// POST /api/detections
const createDetection = async (req, res) => {
  try {
    const {
      camera_id,
      object_class,
      confidence,
      x1,
      y1,
      x2,
      y2,
      track_id,
      plate_number,
      plate_confidence,
      vehicle_make,
      vehicle_model,
      vehicle_color,
      owner_name,
      owner_status,
      snapshot_path,
      detected_at,
      source,
    } = req.body;

    if (!camera_id || !object_class || confidence === undefined) {
      return res.status(400).json({
        success: false,
        message: "camera_id, object_class and confidence are required",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO detections (
        camera_id,
        object_class,
        confidence,
        x1,
        y1,
        x2,
        y2,
        track_id,
        plate_number,
        plate_confidence,
        vehicle_make,
        vehicle_model,
        vehicle_color,
        owner_name,
        owner_status,
        snapshot_path,
        detected_at,
        source
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *
      `,
      [
        camera_id,
        object_class,
        confidence,
        x1 ?? null,
        y1 ?? null,
        x2 ?? null,
        y2 ?? null,
        track_id ?? null,
        plate_number ?? null,
        plate_confidence ?? null,
        vehicle_make ?? null,
        vehicle_model ?? null,
        vehicle_color ?? null,
        owner_name ?? null,
        owner_status ?? null,
        snapshot_path ?? null,
        detected_at ?? new Date(),
        source ?? "SENTINEL_AI",
      ]
    );

    // Correlate every recognised plate immediately with active watchlists.
    // This keeps the detection path usable even when an external event bus is
    // not deployed for the proof of concept.
    if (plate_number) {
      await pool.query(`
        INSERT INTO alerts (camera_id, alert_type, priority, message, evidence_snapshot)
        SELECT $1, 'WATCHLIST_MATCH', 'HIGH',
          'Watchlist match: ' || w.name || ' (' || e.identifier || ')', $3
        FROM watchlist_entries e JOIN watchlists w ON w.id = e.watchlist_id
        WHERE w.status = 'ACTIVE' AND upper(regexp_replace(e.identifier, '[^A-Z0-9]', '', 'g')) = upper(regexp_replace($2, '[^A-Z0-9]', '', 'g'))
          AND NOT EXISTS (SELECT 1 FROM alerts a WHERE a.camera_id=$1 AND a.alert_type='WATCHLIST_MATCH' AND a.message LIKE '%' || e.identifier || '%' AND a.created_at > NOW() - INTERVAL '30 seconds')
      `, [camera_id, plate_number, snapshot_path ?? null]);
    }

    res.status(201).json({
      success: true,
      detection: result.rows[0],
    });

  } catch (error) {
    console.error("Detection create error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create detection",
      error: error.message,
    });
  }
};


// GET /api/detections
const getRecentDetections = async (req, res) => {
  try {
    const { camera_id, object_class, min_confidence, from, to, limit } = req.query;
    const values = [];
    const clauses = [];
    const add = (value, sql) => { values.push(value); clauses.push(sql.replace("?", `$${values.length}`)); };
    if (camera_id) add(camera_id, "d.camera_id = ?");
    if (object_class) add(object_class, "d.object_class = ?");
    if (min_confidence) add(Number(min_confidence), "d.confidence >= ?");
    if (from) add(from, "d.detected_at >= ?");
    if (to) add(to, "d.detected_at <= ?");
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
    values.push(safeLimit);
    const result = await pool.query(`
      SELECT
        d.*,
        c.camera_id AS sentinel_camera_id,
        c.name AS camera_name,
        c.location_name
      FROM detections d
      JOIN cameras c ON c.id = d.camera_id
      ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY d.detected_at DESC
      LIMIT $${values.length}
    `, values);

    res.json({
      success: true,
      count: result.rows.length,
      detections: result.rows,
    });

  } catch (error) {
    console.error("Detection fetch error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch detections",
      error: error.message,
    });
  }
};


module.exports = {
  createDetection,
  getRecentDetections,
};
