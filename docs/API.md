# Core API

The backend preserves the existing detection contract and exposes camera and
health routes. Main endpoints are `GET /api/health`, `GET /api/cameras`,
`GET|POST /api/cameras/:id/health`, `GET /api/cameras/:id/detections`,
`GET /api/detections`, `GET /api/detections/recent`, and
`POST /api/detections`. Sentinel synchronization uses
`POST /api/cameras/sentinel/upsert` and the catalogue proxy is under
`/api/sentinel`.

Platform endpoints include `GET /api/system/health`, `GET /api/system/stats`,
`GET /api/alerts`, and `GET /api/watchlists`. Responses use `success` and
`data` for new platform endpoints; legacy camera/detection responses retain
their established `cameras`/`detections` fields for compatibility. Database
errors do not expose SQL details to clients.

Detection `camera_id` is always the PostgreSQL camera UUID. Sentinel IDs are
stored as catalogue identifiers and are returned separately as
`sentinel_camera_id`.
