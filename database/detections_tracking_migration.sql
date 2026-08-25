-- Backward-compatible tracking support for existing NetraX installations.
ALTER TABLE detections
ADD COLUMN IF NOT EXISTS track_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_detections_camera_track
ON detections(camera_id, track_id);

ALTER TABLE detections ADD COLUMN IF NOT EXISTS plate_number VARCHAR(32);
ALTER TABLE detections ADD COLUMN IF NOT EXISTS plate_confidence NUMERIC(5,4);
ALTER TABLE detections ADD COLUMN IF NOT EXISTS vehicle_make VARCHAR(100);
ALTER TABLE detections ADD COLUMN IF NOT EXISTS vehicle_model VARCHAR(100);
ALTER TABLE detections ADD COLUMN IF NOT EXISTS vehicle_color VARCHAR(50);
ALTER TABLE detections ADD COLUMN IF NOT EXISTS owner_name VARCHAR(200);
ALTER TABLE detections ADD COLUMN IF NOT EXISTS owner_status VARCHAR(50);
ALTER TABLE detections ADD COLUMN IF NOT EXISTS snapshot_path TEXT;
