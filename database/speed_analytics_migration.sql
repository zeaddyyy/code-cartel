-- Optional, backward-compatible speed analytics storage.
-- Apply only after per-camera calibration has been reviewed and approved.
ALTER TABLE detections ADD COLUMN IF NOT EXISTS speed_kph NUMERIC(7,2);
ALTER TABLE detections ADD COLUMN IF NOT EXISTS speed_limit_kph NUMERIC(7,2);
ALTER TABLE detections ADD COLUMN IF NOT EXISTS speed_violation BOOLEAN;
ALTER TABLE detections ADD COLUMN IF NOT EXISTS speed_status VARCHAR(30);
CREATE INDEX IF NOT EXISTS idx_detections_speed_violation
  ON detections(speed_violation, detected_at);
