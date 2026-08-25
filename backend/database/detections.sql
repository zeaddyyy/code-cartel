CREATE TABLE IF NOT EXISTS detections (
    id BIGSERIAL PRIMARY KEY,

    camera_id UUID NOT NULL
        REFERENCES cameras(id)
        ON DELETE CASCADE,

    object_class VARCHAR(100) NOT NULL,

    confidence NUMERIC(5,4) NOT NULL,

    x1 INTEGER,
    y1 INTEGER,
    x2 INTEGER,
    y2 INTEGER,

    -- ByteTrack IDs are scoped to camera_id and are intentionally nullable for
    -- older/manual detection producers.
    track_id VARCHAR(100),

    plate_number VARCHAR(32),
    plate_confidence NUMERIC(5,4),
    vehicle_make VARCHAR(100),
    vehicle_model VARCHAR(100),
    vehicle_color VARCHAR(50),
    owner_name VARCHAR(200),
    owner_status VARCHAR(50),
    snapshot_path TEXT,

    detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    source VARCHAR(50) DEFAULT 'SENTINEL_AI',

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_detections_camera
ON detections(camera_id);

CREATE INDEX IF NOT EXISTS idx_detections_detected_at
ON detections(detected_at);

CREATE INDEX IF NOT EXISTS idx_detections_object_class
ON detections(object_class);

CREATE INDEX IF NOT EXISTS idx_detections_camera_track
ON detections(camera_id, track_id);
