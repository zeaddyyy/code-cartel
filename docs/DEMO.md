# Demo runbook

Start Postgres, backend, and frontend. Confirm `/api/health`, `/api/db-test`, `/api/cameras`, and `/api/detections`. Run the existing `/tmp/sentinel_live.ts` fixture through the configured AI service, then confirm recent rows with `curl http://localhost:5001/api/detections`. Use `python3 tools/scale_test.py --cameras 100` or `--cameras 80000` for safe capacity messaging. Disconnected Sentinel, unavailable ANPR, and simulated capacity must remain visibly labelled.
