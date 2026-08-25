# NetraX demo runbook

1. Start PostgreSQL/PostGIS and the backend on port 5001.
2. Start the React dashboard on port 5173.
3. Run `AI_SOURCE=local venv/bin/python ai_live.py` from `ai-service` to
   demonstrate FFmpeg, YOLO, ByteTrack, cooldown, snapshots, API writes, and
   PostgreSQL records using `/tmp/sentinel_live.ts`.
4. Show the camera grid, evidence snapshot, original-resolution bounding box,
   track ID, and health status.
5. For Sentinel, run `AI_SOURCE=sentinel MAX_CAMERAS=0 venv/bin/python
   ai_live.py`. This discovers all eligible catalogue cameras when the remote
   catalogue is reachable; if it returns 502/523, show the exact blocked status
   and do not label the fixture as a government feed.
6. Use `python tools/registry_simulator.py --count 80000` to demonstrate
   metadata-scale partitioning without opening 80,000 streams.

ANPR, owner lookup, watchlist matches, calibrated speed observations, and
legal enforcement remain disabled unless real models, calibration, and
authorized integrations are configured. No demo data should be presented as
government data.
