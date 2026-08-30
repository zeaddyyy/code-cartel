# NetraX setup and demo

## Requirements

Node.js 20+, Python 3.10+, PostgreSQL 16/17 with PostGIS, FFmpeg, and Tesseract. Docker is optional.

## Database

Start PostgreSQL and create the database:

```bash
createdb netrax_db
psql netrax_db -f database/schema.sql
psql netrax_db -f backend/database/detections.sql
psql netrax_db -f database/detections_tracking_migration.sql
psql netrax_db -f database/sentinel_migration.sql
psql netrax_db -f database/speed_analytics_migration.sql
psql netrax_db -f database/platform_migration.sql
```

Copy and edit the backend environment file:

```bash
cp backend/.env.example backend/.env
```

## Start services

Terminal 1:

```bash
cd backend
npm install
npm start
```

Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Verify the API with:

```bash
curl http://localhost:5001/api/health
curl http://localhost:5001/api/db-test
curl http://localhost:5001/api/cameras
curl http://localhost:5001/api/detections
```

## AI service

```bash
cd ai-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python ai_live.py --source /tmp/sentinel_live.ts --run-seconds 60
```

The fixture must exist at `/tmp/sentinel_live.ts`. AI uses server-side RTSP over TCP for remote cameras. Browsers require HLS/WebRTC and must never play RTSP directly. ANPR is disabled unless a real plate model and OCR engine are configured; missing readings remain `Unavailable`.

## Validation

```bash
(cd frontend && npm run lint && npm run build)
(cd backend && npm run check)
python3 -m py_compile ai-service/*.py tools/*.py
python3 tools/scale_test.py --cameras 80000
```

The scale command simulates metadata and event orchestration only. It does not open 80,000 streams and is not a production benchmark. Speed results require calibration and PTS timestamps and are review-only; no legal fine is issued.

## Docker

If Docker Desktop is installed:

```bash
docker compose up -d postgres redis kafka
```

Native startup remains the recommended path for the local AI fixture. Never commit `.env` files, credentials, private URLs, logs, snapshots, virtual environments, or generated build output.
