const express = require("express");
const pool = require("../config/database");
const router = express.Router();

// These read-only endpoints keep alert/watchlist storage separate from raw
// detections. Matching and alert creation belongs in a future event processor.
router.get("/alerts", async (req, res) => {
  try { const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500); const r = await pool.query("SELECT * FROM alerts ORDER BY created_at DESC LIMIT $1", [limit]); res.json({ success: true, data: r.rows, count: r.rowCount }); }
  catch (e) { res.status(503).json({ success: false, error: { code: "ALERTS_UNAVAILABLE", message: "Alert store unavailable" } }); }
});
router.get("/watchlists", async (req, res) => {
  try { const r = await pool.query("SELECT w.*, count(e.id)::int AS entry_count FROM watchlists w LEFT JOIN watchlist_entries e ON e.watchlist_id=w.id GROUP BY w.id ORDER BY w.created_at DESC"); res.json({ success: true, data: r.rows }); }
  catch (e) { res.status(503).json({ success: false, error: { code: "WATCHLISTS_UNAVAILABLE", message: "Watchlist store unavailable" } }); }
});
module.exports = router;
