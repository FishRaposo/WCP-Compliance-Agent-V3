/**
 * Audit Persistence Service (M1)
 *
 * Persists TrustScoredDecision records to PostgreSQL for 7-year compliant
 * audit retention per Davis-Bacon Act requirements.
 *
 * Graceful degradation: when PostgreSQL is unavailable, persist() is a no-op.
 * The in-memory audit trail on the decision object always remains the source
 * of truth for the current request.
 */

import { query } from "./db-client.js";
import type { TrustScoredDecision, AuditEvent } from "../types/decision-pipeline.js";
import { childLogger } from "../utils/logger.js";

const log = childLogger("AuditPersistence");

// ============================================================================
// Schema Migration (auto-run on first persist if table missing)
// ============================================================================

let _migrated = false;

async function ensureSchema(): Promise<void> {
  if (_migrated) return;

  const result = await query(
    `CREATE TABLE IF NOT EXISTS decisions (
       trace_id              TEXT        PRIMARY KEY,
       final_status          TEXT        NOT NULL,
       trust_score           NUMERIC(4,3) NOT NULL,
       trust_band            TEXT        NOT NULL,
       prompt_version        INTEGER,
       prompt_key            TEXT,
       deterministic_score   NUMERIC(4,3),
       human_review_required BOOLEAN     NOT NULL DEFAULT FALSE,
       payload               JSONB       NOT NULL,
       created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       finalized_at          TIMESTAMPTZ
     );
     CREATE TABLE IF NOT EXISTS audit_events (
       id          BIGSERIAL   PRIMARY KEY,
       trace_id    TEXT        NOT NULL,
       stage       TEXT        NOT NULL,
       event       TEXT        NOT NULL,
       details     JSONB       NOT NULL DEFAULT '{}',
       occurred_at TIMESTAMPTZ NOT NULL
     );`
  );

  if (result !== null) {
    _migrated = true;
    log.info("Audit schema verified");
  }
}

// ============================================================================
// Persist Decision
// ============================================================================

/**
 * Persist a TrustScoredDecision to PostgreSQL.
 * No-op when the DB is unavailable.
 *
 * @param decision The finalized decision to persist
 */
export async function persistDecision(decision: TrustScoredDecision): Promise<void> {
  try {
    await ensureSchema();

    // Upsert the decision record
    const upsertResult = await query(
      `INSERT INTO decisions
         (trace_id, final_status, trust_score, trust_band, prompt_version, prompt_key,
          deterministic_score, human_review_required, payload, finalized_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (trace_id) DO UPDATE SET
         final_status          = EXCLUDED.final_status,
         trust_score           = EXCLUDED.trust_score,
         trust_band            = EXCLUDED.trust_band,
         prompt_version        = EXCLUDED.prompt_version,
         prompt_key            = EXCLUDED.prompt_key,
         deterministic_score   = EXCLUDED.deterministic_score,
         human_review_required = EXCLUDED.human_review_required,
         payload               = EXCLUDED.payload,
         finalized_at          = EXCLUDED.finalized_at`,
      [
        decision.traceId,
        decision.finalStatus,
        decision.trust.score,
        decision.trust.band,
        decision.verdict.promptVersion ?? null,
        decision.verdict.promptKey ?? null,
        decision.deterministic.deterministicScore,
        decision.humanReview.required,
        JSON.stringify(decision),
        decision.finalizedAt,
      ]
    );

    if (upsertResult === null) return; // DB unavailable

    // Bulk-insert audit events (ignore conflicts for idempotency)
    if (decision.auditTrail.length > 0) {
      await persistAuditEvents(decision.traceId, decision.auditTrail);
    }

    log.info({ traceId: decision.traceId, finalStatus: decision.finalStatus }, "Decision persisted to PostgreSQL");
  } catch (err) {
    log.error({ traceId: decision.traceId, err }, "Failed to persist decision — audit trail preserved in-memory");
    // Non-fatal: the decision was already returned to the caller
  }
}

/**
 * Persist individual audit events for a decision.
 */
async function persistAuditEvents(traceId: string, events: AuditEvent[]): Promise<void> {
  for (const event of events) {
    await query(
      `INSERT INTO audit_events (trace_id, stage, event, details, occurred_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [traceId, event.stage, event.event, JSON.stringify(event.details), event.timestamp]
    );
  }
}

// ============================================================================
// Query Helpers
// ============================================================================

/**
 * Retrieve a persisted decision by traceId.
 * Returns null when DB unavailable or record not found.
 */
export async function getDecision(traceId: string): Promise<TrustScoredDecision | null> {
  const result = await query<{ payload: string }>(
    `SELECT payload FROM decisions WHERE trace_id = $1 LIMIT 1`,
    [traceId]
  );

  if (!result || result.rows.length === 0) return null;

  try {
    return JSON.parse(result.rows[0].payload) as TrustScoredDecision;
  } catch {
    return null;
  }
}

/**
 * List recent decisions (most recent first).
 */
export async function listDecisions(limit = 50): Promise<Array<{
  traceId: string;
  finalStatus: string;
  trustScore: number;
  trustBand: string;
  humanReviewRequired: boolean;
  createdAt: string;
}>> {
  const result = await query<{
    trace_id: string;
    final_status: string;
    trust_score: number;
    trust_band: string;
    human_review_required: boolean;
    created_at: string;
  }>(
    `SELECT trace_id, final_status, trust_score, trust_band, human_review_required, created_at
     FROM decisions
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );

  if (!result) return [];

  return result.rows.map((r) => ({
    traceId: r.trace_id,
    finalStatus: r.final_status,
    trustScore: Number(r.trust_score),
    trustBand: r.trust_band,
    humanReviewRequired: r.human_review_required,
    createdAt: r.created_at,
  }));
}
