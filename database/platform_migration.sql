-- Additive, idempotent platform tables. Never drops existing data.
CREATE TABLE IF NOT EXISTS alerts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), camera_id UUID REFERENCES cameras(id) ON DELETE SET NULL, alert_type VARCHAR(60) NOT NULL, priority VARCHAR(20) DEFAULT 'NORMAL', message TEXT, evidence_snapshot TEXT, status VARCHAR(20) DEFAULT 'OPEN', created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, resolved_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS watchlists (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(150) NOT NULL, category VARCHAR(60) NOT NULL, status VARCHAR(20) DEFAULT 'ACTIVE', created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS watchlist_entries (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE, identifier VARCHAR(120) NOT NULL, notes TEXT, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, UNIQUE(watchlist_id, identifier));
CREATE TABLE IF NOT EXISTS audit_logs (id BIGSERIAL PRIMARY KEY, actor VARCHAR(150), action VARCHAR(100) NOT NULL, resource_type VARCHAR(80), resource_id VARCHAR(120), metadata JSONB, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_alerts_status_created ON alerts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_watchlist_entries_identifier ON watchlist_entries(identifier);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
