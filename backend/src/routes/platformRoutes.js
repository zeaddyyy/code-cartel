const express = require("express");
const pool = require("../config/database");
const router = express.Router();
const { requireAdmin } = require("../middleware/adminAuth");
const REGIONS = ["North Gujarat", "Central Gujarat", "South Gujarat", "Saurashtra", "Kutch"];

router.get("/regions", async (req, res) => {
  try { const r = await pool.query(`SELECT COALESCE(NULLIF(location_name,''),'Unassigned') AS district, count(*)::int AS cameras, count(*) FILTER (WHERE status IN ('ONLINE','CONNECTED'))::int AS online, count(*) FILTER (WHERE status IN ('AI_ACTIVE','CONNECTED'))::int AS ai_active FROM cameras GROUP BY 1 ORDER BY 1`); const data = REGIONS.map((name) => ({ id: name.toLowerCase().replaceAll(" ", "-"), name, capacity_target: name === "Central Gujarat" ? 18000 : name === "Saurashtra" ? 20000 : name === "Kutch" ? 11000 : name === "North Gujarat" ? 16000 : 15000, districts: r.rows.filter((row) => row.district.toLowerCase().includes(name.split(" ")[0].toLowerCase())), note: "Logical deployment region; capacity is an architectural target" })); res.json({ success: true, data }); }
  catch (e) { res.status(503).json({ success: false, message: "Regional view unavailable" }); }
});
router.get("/edge-gateways", async (req, res) => {
  try { const r = await pool.query("SELECT status, count(*)::int AS connected_cameras FROM cameras GROUP BY status"); const connected = r.rows.filter((x) => ["ONLINE", "CONNECTED"].includes(x.status)).reduce((n, x) => n + x.connected_cameras, 0); res.json({ success: true, data: REGIONS.map((region) => ({ edge_gateway_id: `EDGE-${region.replaceAll(" ", "-").toUpperCase()}-01`, region, status: "ARCHITECTURE_READY", connected_cameras: connected ? null : 0, capacity_target: region === "Central Gujarat" ? 18000 : region === "Saurashtra" ? 20000 : 15000, note: "Gateway telemetry requires regional deployment" })) }); }
  catch (e) { res.status(503).json({ success: false, message: "Gateway view unavailable" }); }
});

router.get("/alerts", async (req, res) => {
  try { const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500); const r = await pool.query("SELECT * FROM alerts ORDER BY created_at DESC LIMIT $1", [limit]); res.json({ success: true, data: r.rows, count: r.rowCount }); }
  catch (e) { res.status(503).json({ success: false, error: { code: "ALERTS_UNAVAILABLE", message: "Alert store unavailable" } }); }
});
router.patch("/alerts/:id", async (req, res) => {
  try { const r = await pool.query("UPDATE alerts SET status=$1, resolved_at=CASE WHEN $1='RESOLVED' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=$2 RETURNING *", [req.body.status === "RESOLVED" ? "RESOLVED" : "OPEN", req.params.id]); res.json({ success: true, data: r.rows[0] }); }
  catch (e) { res.status(503).json({ success: false, message: "Alert update failed" }); }
});
router.post("/watchlists", async (req, res) => {
  try { const r = await pool.query("INSERT INTO watchlists(name, category) VALUES($1,$2) RETURNING *", [req.body.name, req.body.category || "VEHICLE"]); res.status(201).json({ success: true, data: r.rows[0] }); }
  catch (e) { res.status(400).json({ success: false, message: "name is required" }); }
});
router.post("/watchlists/:id/entries", async (req, res) => {
  try { const r = await pool.query("INSERT INTO watchlist_entries(watchlist_id,identifier,notes) VALUES($1,$2,$3) RETURNING *", [req.params.id, String(req.body.identifier || "").toUpperCase(), req.body.notes || null]); res.status(201).json({ success: true, data: r.rows[0] }); }
  catch (e) { res.status(400).json({ success: false, message: "identifier is required" }); }
});
router.get("/vehicles/journey", async (req, res) => {
  try { if (!req.query.plate) return res.status(400).json({ success: false, message: "plate is required" }); const r = await pool.query(`SELECT d.id,d.plate_number,d.detected_at,d.track_id,d.snapshot_path,c.camera_id,c.name AS camera_name,c.location_name,c.latitude,c.longitude FROM detections d JOIN cameras c ON c.id=d.camera_id WHERE upper(regexp_replace(d.plate_number, '[^A-Z0-9]', '', 'g'))=upper(regexp_replace($1, '[^A-Z0-9]', '', 'g')) ORDER BY d.detected_at ASC`, [req.query.plate]); res.json({ success: true, data: r.rows, count: r.rowCount }); }
  catch (e) { res.status(503).json({ success: false, message: "Journey unavailable" }); }
});
router.get("/watchlists", async (req, res) => {
  try { const r = await pool.query("SELECT w.*, count(e.id)::int AS entry_count FROM watchlists w LEFT JOIN watchlist_entries e ON e.watchlist_id=w.id GROUP BY w.id ORDER BY w.created_at DESC"); res.json({ success: true, data: r.rows }); }
  catch (e) { res.status(503).json({ success: false, error: { code: "WATCHLISTS_UNAVAILABLE", message: "Watchlist store unavailable" } }); }
});
router.get("/admin/errors", requireAdmin, async (req, res) => {
  try { const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500); const r = await pool.query("SELECT * FROM system_errors ORDER BY created_at DESC LIMIT $1", [limit]); res.json({ success: true, data: r.rows, count: r.rowCount }); }
  catch (e) { res.status(503).json({ success: false, message: "Error center unavailable" }); }
});
router.patch("/admin/errors/:id", requireAdmin, async (req, res) => {
  try { const r = await pool.query("UPDATE system_errors SET acknowledged=true, acknowledged_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *", [req.params.id]); res.json({ success: true, data: r.rows[0] }); }
  catch (e) { res.status(503).json({ success: false, message: "Error update failed" }); }
});
module.exports = router;
