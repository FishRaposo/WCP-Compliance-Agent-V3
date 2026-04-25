-- Migration 001: Create audit persistence tables (M1)
-- Provides 7-year compliant audit retention per Davis-Bacon Act requirements.
-- Run with: psql $POSTGRES_URL -f migrations/001_create_audit_tables.sql

BEGIN;

-- ============================================================================
-- decisions: Immutable audit record of every TrustScoredDecision
-- ============================================================================
CREATE TABLE IF NOT EXISTS decisions (
  trace_id          TEXT        PRIMARY KEY,
  final_status      TEXT        NOT NULL CHECK (final_status IN ('Approved', 'Revise', 'Reject', 'Pending Human Review')),
  trust_score       NUMERIC(4,3) NOT NULL CHECK (trust_score >= 0 AND trust_score <= 1),
  trust_band        TEXT        NOT NULL CHECK (trust_band IN ('auto', 'flag_for_review', 'require_human')),
  prompt_version    INTEGER,
  prompt_key        TEXT,
  deterministic_score NUMERIC(4,3),
  human_review_required BOOLEAN NOT NULL DEFAULT FALSE,
  payload           JSONB       NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS decisions_created_at_idx ON decisions (created_at DESC);
CREATE INDEX IF NOT EXISTS decisions_final_status_idx ON decisions (final_status);
CREATE INDEX IF NOT EXISTS decisions_trust_band_idx ON decisions (trust_band);

-- ============================================================================
-- audit_events: Individual pipeline events (streamed from AuditEvent[])
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_events (
  id                BIGSERIAL   PRIMARY KEY,
  trace_id          TEXT        NOT NULL REFERENCES decisions (trace_id) ON DELETE CASCADE,
  stage             TEXT        NOT NULL CHECK (stage IN ('layer1', 'layer2', 'layer3')),
  event             TEXT        NOT NULL,
  details           JSONB       NOT NULL DEFAULT '{}',
  occurred_at       TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_events_trace_id_idx ON audit_events (trace_id);
CREATE INDEX IF NOT EXISTS audit_events_occurred_at_idx ON audit_events (occurred_at DESC);

-- ============================================================================
-- human_review_queue: Postgres-backed review queue (replaces JSON file stub)
-- ============================================================================
CREATE TABLE IF NOT EXISTS human_review_queue (
  trace_id          TEXT        PRIMARY KEY REFERENCES decisions (trace_id) ON DELETE CASCADE,
  status            TEXT        NOT NULL CHECK (status IN ('pending', 'in_review', 'completed', 'escalated')),
  priority          TEXT        NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  assigned_to       TEXT,
  reviewer_decision TEXT        CHECK (reviewer_decision IN ('approve', 'reject', 'escalate')),
  reviewer_notes    TEXT,
  queued_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_at       TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  audit_trail       JSONB       NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS hrq_status_idx ON human_review_queue (status);
CREATE INDEX IF NOT EXISTS hrq_priority_idx ON human_review_queue (priority);
CREATE INDEX IF NOT EXISTS hrq_queued_at_idx ON human_review_queue (queued_at DESC);

COMMIT;
