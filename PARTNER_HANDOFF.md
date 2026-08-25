# NetraX partner handoff

## Safety before sharing

Do not share `backend/.env`, database passwords, Sentinel credentials, recovery
tokens, `/tmp/netrax_snapshots`, `ai-service/venv`, or `node_modules`. The
repository `.gitignore` excludes these paths. Each partner should create local
environment files from the checked-in examples.

## Setup

Install Node.js, PostgreSQL with PostGIS, Python 3.10+, FFmpeg, and Tesseract
if ANPR testing is required. From the repository root:

```bash
cd backend && npm install
cd ../frontend && npm install
cd ../ai-service && python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt  # if present in the partner branch
```

Copy `backend/.env.example` to `backend/.env` and fill in local PostgreSQL
settings. Copy `ai-service/.env.example` to `ai-service/.env`. Never commit
either `.env` file.

## Run the demo

Terminal 1:

```bash
cd backend && npm start
```

Terminal 2:

```bash
cd frontend && npm run dev -- --host 127.0.0.1
```

Terminal 3, local fixture:

```bash
cd ai-service
AI_SOURCE=local venv/bin/python ai_live.py
```

For Sentinel read-only ingestion, when the catalogue and RTSP network are
authorized and reachable:

```bash
cd ai-service
AI_SOURCE=sentinel MAX_CAMERAS=0 ./run_all_cameras.sh
```

The local fixture is demo data. Sentinel connectivity must be verified from the
partner’s network and must not be represented as government-live when blocked.

## Verification

```bash
node --check backend/src/server.js
npm --prefix frontend run build
python3 -m py_compile ai-service/ai_live.py ai-service/sentinel.py
curl http://localhost:5001/api/health
curl http://localhost:5001/api/cameras
curl http://localhost:5001/api/detections
```

Admin camera CRUD is intentionally open in this demo configuration after the
local password gate was removed. Re-enable authenticated RBAC before any shared
or production deployment.
