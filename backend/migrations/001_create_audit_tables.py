"""001 — Create audit tables: decisions, audit_events."""

# TODO: convert to Alembic migration format
# Run with: alembic upgrade head

UPGRADE_SQL = """
CREATE TABLE IF NOT EXISTS decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id TEXT NOT NULL UNIQUE,
    verdict TEXT NOT NULL,
    trust_score FLOAT NOT NULL,
    trust_band TEXT NOT NULL,
    requires_human_review BOOLEAN NOT NULL DEFAULT FALSE,
    violation_count INTEGER NOT NULL DEFAULT 0,
    warning_count INTEGER NOT NULL DEFAULT 0,
    reasoning_summary TEXT,
    citations JSONB DEFAULT '[]',
    cost_usd FLOAT,
    latency_ms INTEGER,
    phoenix_trace_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    actor TEXT NOT NULL DEFAULT 'system',
    payload JSONB DEFAULT '{}',
    regulation_references TEXT[] DEFAULT '{}',
    trace_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decisions_job_id ON decisions(job_id);
CREATE INDEX IF NOT EXISTS idx_decisions_created_at ON decisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_job_id ON audit_events(job_id);
"""

DOWNGRADE_SQL = """
DROP TABLE IF EXISTS audit_events;
DROP TABLE IF EXISTS decisions;
"""
