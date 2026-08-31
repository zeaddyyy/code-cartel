# NetraX — Final Technical Documentation

## 1. Product overview

NetraX is a dark command-center platform for CCTV registry, GIS visibility, unified feed access, AI detections, ANPR readiness, vehicle intelligence, watchlist correlation, alerts, health monitoring, and operational search.

The implementation uses real records from the NetraX backend. It does not fabricate government feeds, plate numbers, owners, database matches, speed measurements, or live statewide connectivity.

## 2. Technology

- Frontend: React 19, Vite, JavaScript, CSS, Leaflet-ready GIS layer
- Backend: Node.js, Express, PostgreSQL, PostGIS
- AI: Python, FFmpeg, OpenCV, YOLO, ByteTrack, optional ANPR/OCR
- Evidence: server-side snapshot storage through the backend API
- Security: Helmet, rate limiting, admin session tokens, protected mutation routes, error center

## 3. Application sections

- Command Center — KPIs, live camera wall, events, health, map overview
- Cameras — registry and camera status
- Live Wall — HLS/WebRTC browser previews; RTSP remains server-side
- AI Events — detection metadata and evidence
- ANPR — verified plate reads only
- Vehicles — vehicle events and cross-camera journey search
- GIS Map — camera locations using stored coordinates
- Alerts — watchlist match review and resolution
- Watchlist — representative watchlist entries
- Search — search across real detection metadata
- Reports — report definitions and honest export boundary
- Regions — logical regional capacity and gateway posture
- System Health — service and camera health
- Administration — onboarding, Sentinel sync, registry CRUD, error center

## 4. Distributed architecture

The scalable target is region-wise rather than one central raw-video server:

```text
CCTV / VMS / RTSP / ONVIF
          |
Regional edge gateways
          |
Regional AI worker pools
          |
Event and metadata bus
          |
Central API + PostgreSQL/PostGIS
          |
GIS / Search / Alerts / Analytics / Command Center
```

Raw video remains close to the camera or regional gateway. The central platform primarily receives detections, ANPR metadata, alerts, health telemetry, and searchable event data.

The Regions page presents five configurable logical regions: North Gujarat, Central Gujarat, South Gujarat, Saurashtra, and Kutch. Capacity numbers are explicitly architectural targets, not claims of existing deployment.

## 5. Backend APIs

### Core

- `GET /api/health`
- `GET /api/cameras`
- `GET /api/cameras/:id`
- `GET /api/cameras/:id/health`
- `GET /api/cameras/:id/detections`
- `POST /api/cameras`
- `POST /api/cameras/bulk`
- `PUT /api/cameras/:id`
- `DELETE /api/cameras/:id`
- `GET /api/detections`
- `POST /api/detections`
- `GET /api/snapshots/:filename`

### Regional and integration

- `GET /api/regions`
- `GET /api/edge-gateways`
- `GET /api/sentinel/cameras`
- `POST /api/sentinel/sync`
- `POST /api/cameras/sentinel/upsert`
- `GET /api/vehicles/journey?plate=...`

### Alerts and watchlists

- `GET /api/alerts`
- `PATCH /api/alerts/:id`
- `GET /api/watchlists`
- `POST /api/watchlists`
- `POST /api/watchlists/:id/entries`

### Administration

- `POST /api/admin/login`
- `GET /api/admin/errors`
- `PATCH /api/admin/errors/:id`

## 6. Authentication

Default development credentials are configured through environment variables:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

Change these values before any non-development deployment. Frontend code does not contain the password. The browser stores only the short-lived session token in `sessionStorage`.

## 7. Error center

Backend 5xx responses are recorded in `system_errors`. The Administration page displays:

- source
- route
- HTTP status
- message
- timestamp
- acknowledgement state

Frontend request failures are shown to the operator and the latest client-side failure is retained locally for diagnostic context. Stack traces and database credentials are not exposed in the UI.

## 8. AI pipeline

```text
Camera stream
  → FFmpeg over RTSP/TCP
  → PTS-aware frame pacing
  → YOLO / ByteTrack
  → optional plate detector + OCR
  → snapshot and detection metadata
  → backend API
  → PostgreSQL / alerts / dashboard
```

The AI service creates independent camera workers. A failed camera or worker does not terminate other workers. RTSP URLs are validated, frame resolution is bounded, snapshots use restricted permissions, OCR has a timeout, and the Docker image runs as a non-root user.

Run all persisted cameras with:

```env
AI_SOURCE=auto
MAX_CAMERAS=0
```

Only cameras with a configured RTSP URL can be processed by the AI service.

## 9. Honest capability boundaries

- ANPR shows `Unavailable` when no verified OCR result exists.
- Speed analytics remains review-only and requires calibration.
- External VAHAN, SARTHI, eGujCop, AFIS, and NAFIS connections are not fabricated.
- Sentinel outages fall back to local or persisted data when available.
- Architecture capacity is not presented as live connected-camera count.
- Historical snapshots whose files no longer exist display `Evidence unavailable`.

## 10. Run commands

Backend:

```bash
cd backend
npm install
npm start
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

AI service:

```bash
cd ai-service
python3 -m pip install -r requirements.txt
python3 ai_live.py
```

URLs:

- Frontend: `http://127.0.0.1:5173/`
- Backend: `http://localhost:5001/`

## 11. Validation

```bash
cd frontend && npm run lint && npm run build
cd ../backend && npm run check
cd ../ai-service && python3 -m py_compile ai_live.py anpr.py sentinel.py speed.py test_speed.py
cd .. && git diff --check
```

## 12. Recommended two-minute demonstration

1. Open Command Center and show operational KPIs.
2. Open Administration and register or sync cameras.
3. Open Live Wall and show available browser-safe previews.
4. Open AI Events and inspect a detection record.
5. Open ANPR and explain verified-result behavior.
6. Trace a vehicle by plate in Vehicles.
7. Add a representative watchlist entry.
8. Open Alerts and acknowledge a confirmed match.
9. Open Regions to explain edge gateways and failure isolation.
10. Open GIS and Search to demonstrate operational investigation.

## 13. Production next steps

- Replace development admin credentials with a managed identity provider and RBAC.
- Add explicit `regions`, `districts`, and `edge_gateways` tables with foreign keys.
- Add authenticated AI-to-backend service credentials and mTLS.
- Add Kafka or another durable event bus for regional event delivery.
- Add Redis for ephemeral worker and gateway state.
- Add real report-generation endpoints for CSV/PDF.
- Add Leaflet clustering and server-side GIS queries for very large registries.
- Add centralized metrics, tracing, immutable audit storage, backups, and disaster recovery.
