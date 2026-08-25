-- ============================================
-- NETRAX SENTINEL STREAM METADATA
-- ============================================

ALTER TABLE streams
ADD COLUMN IF NOT EXISTS rtsp_url TEXT;

ALTER TABLE streams
ADD COLUMN IF NOT EXISTS webrtc_url TEXT;

ALTER TABLE streams
ADD COLUMN IF NOT EXISTS hls_url TEXT;

ALTER TABLE streams
ADD COLUMN IF NOT EXISTS codec VARCHAR(30);

ALTER TABLE streams
ADD COLUMN IF NOT EXISTS width INTEGER;

ALTER TABLE streams
ADD COLUMN IF NOT EXISTS height INTEGER;

ALTER TABLE streams
ADD COLUMN IF NOT EXISTS bitrate_kbps INTEGER;

ALTER TABLE streams
ADD COLUMN IF NOT EXISTS bits_per_pixel NUMERIC(10,4);

ALTER TABLE streams
ADD COLUMN IF NOT EXISTS source VARCHAR(50);

-- Prevent duplicate stream records
CREATE UNIQUE INDEX IF NOT EXISTS
idx_streams_camera_protocol
ON streams(camera_id, protocol);