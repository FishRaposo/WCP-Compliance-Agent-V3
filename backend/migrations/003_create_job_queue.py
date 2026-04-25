"""003 — Create job queue tracking table."""

UPGRADE_SQL = """
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id TEXT NOT NULL UNIQUE,
    celery_task_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    payload JSONB DEFAULT '{}',
    result JSONB,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
"""

DOWNGRADE_SQL = """
DROP TABLE IF EXISTS jobs;
"""
