-- ============================================
-- NETRAX DATABASE SCHEMA
-- Gujarat Police Innovation Hackathon 2026
-- ============================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================
-- DEPARTMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL UNIQUE,
    code VARCHAR(50) UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- VMS SYSTEMS
-- ============================================

CREATE TABLE IF NOT EXISTS vms_systems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    vendor VARCHAR(150),
    version VARCHAR(100),
    protocol VARCHAR(50),
    api_endpoint TEXT,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CAMERAS
-- ============================================

CREATE TABLE IF NOT EXISTS cameras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    camera_id VARCHAR(100) NOT NULL UNIQUE,

    department_id UUID REFERENCES departments(id),

    vms_id UUID REFERENCES vms_systems(id),

    name VARCHAR(150),

    camera_type VARCHAR(50),

    vendor VARCHAR(150),

    model VARCHAR(150),

    serial_number VARCHAR(150),

    ownership VARCHAR(100),

    location_name VARCHAR(255),

    latitude DOUBLE PRECISION NOT NULL,

    longitude DOUBLE PRECISION NOT NULL,

    location GEOGRAPHY(POINT, 4326),

    connectivity VARCHAR(50),

    retention_days INTEGER,

    status VARCHAR(30) DEFAULT 'UNKNOWN',

    installation_date DATE,

    last_maintenance_date DATE,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CAMERA HEALTH
-- ============================================

CREATE TABLE IF NOT EXISTS camera_health (
    id BIGSERIAL PRIMARY KEY,

    camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,

    status VARCHAR(30) NOT NULL,

    uptime_percentage NUMERIC(5,2),

    latency_ms INTEGER,

    last_seen TIMESTAMPTZ,

    recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- STREAMS
-- ============================================

CREATE TABLE IF NOT EXISTS streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,

    protocol VARCHAR(50),

    stream_url TEXT,

    stream_type VARCHAR(50),

    resolution VARCHAR(50),

    fps INTEGER,

    status VARCHAR(30) DEFAULT 'UNKNOWN',

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_cameras_department
ON cameras(department_id);

CREATE INDEX IF NOT EXISTS idx_cameras_status
ON cameras(status);

CREATE INDEX IF NOT EXISTS idx_camera_health_camera
ON camera_health(camera_id);

CREATE INDEX IF NOT EXISTS idx_streams_camera
ON streams(camera_id);

CREATE INDEX IF NOT EXISTS idx_cameras_location
ON cameras
USING GIST(location);