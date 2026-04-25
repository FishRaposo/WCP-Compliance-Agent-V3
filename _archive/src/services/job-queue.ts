/**
 * Async Job Queue Service (M8)
 *
 * Postgres-backed job queue for async WCP analysis requests.
 * Supports status polling via GET /api/jobs/:jobId.
 *
 * When Postgres is unavailable, falls back to a bounded in-memory map.
 * Workers pick up pending jobs and run them through the decision pipeline.
 *
 * ⚠️  In-memory fallback is PROCESS-LOCAL: jobs queued in one process are
 * invisible to other processes. It is suitable for single-process local
 * development only and must NOT be used in multi-process or serverless
 * deployments. Set POSTGRES_URL to enable the durable Postgres-backed queue.
 */

import { randomUUID } from "crypto";
import { query } from "./db-client.js";
import { childLogger } from "../utils/logger.js";

const log = childLogger("JobQueue");

// ============================================================================
// Types
// ============================================================================

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface JobRecord {
  jobId: string;
  status: JobStatus;
  input: string;
  result?: unknown;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Schema (auto-bootstrapped)
// ============================================================================

let _schemaMigrated = false;

async function ensureJobSchema(): Promise<void> {
  if (_schemaMigrated) return;
  const result = await query(
    `CREATE TABLE IF NOT EXISTS job_queue (
       job_id        TEXT        PRIMARY KEY,
       status        TEXT        NOT NULL DEFAULT 'pending',
       input         TEXT        NOT NULL,
       result        JSONB,
       error_message TEXT,
       created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
     );
     CREATE INDEX IF NOT EXISTS job_queue_status_idx ON job_queue (status);
     CREATE INDEX IF NOT EXISTS job_queue_created_at_idx ON job_queue (created_at DESC);`
  );
  if (result !== null) {
    _schemaMigrated = true;
    log.info("Job queue schema verified");
  }
}

// ============================================================================
// In-memory fallback
// ============================================================================

const IN_MEMORY_JOBS = new Map<string, JobRecord>();
const MAX_IN_MEMORY_JOBS = 1000;

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Create a new async job and return its ID.
 *
 * @param input Raw WCP text content to analyze
 * @returns Job ID
 */
export async function createJob(input: string): Promise<string> {
  const jobId = randomUUID();
  const now = new Date().toISOString();

  await ensureJobSchema();

  const result = await query(
    `INSERT INTO job_queue (job_id, status, input, created_at, updated_at)
     VALUES ($1, 'pending', $2, $3, $3)`,
    [jobId, input, now]
  );

  if (result === null) {
    // Fallback to in-memory
    if (IN_MEMORY_JOBS.size >= MAX_IN_MEMORY_JOBS) {
      // Evict oldest entry
      const oldest = [...IN_MEMORY_JOBS.entries()].sort((a, b) =>
        a[1].createdAt.localeCompare(b[1].createdAt)
      )[0];
      if (oldest) IN_MEMORY_JOBS.delete(oldest[0]);
    }
    IN_MEMORY_JOBS.set(jobId, {
      jobId,
      status: "pending",
      input,
      createdAt: now,
      updatedAt: now,
    });
    log.debug({ jobId }, "Job created (in-memory fallback)");
  } else {
    log.info({ jobId }, "Job created in PostgreSQL");
  }

  return jobId;
}

/**
 * Get a job by ID.
 *
 * @param jobId Job UUID
 * @returns JobRecord or null if not found
 */
export async function getJob(jobId: string): Promise<JobRecord | null> {
  await ensureJobSchema();

  const result = await query<{
    job_id: string;
    status: string;
    input: string;
    result: unknown;
    error_message: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT job_id, status, input, result, error_message, created_at, updated_at
     FROM job_queue WHERE job_id = $1`,
    [jobId]
  );

  if (result && result.rows.length > 0) {
    const r = result.rows[0];
    return {
      jobId: r.job_id,
      status: r.status as JobStatus,
      input: r.input,
      result: r.result,
      errorMessage: r.error_message ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  // Fallback to in-memory
  return IN_MEMORY_JOBS.get(jobId) ?? null;
}

/**
 * Update a job's status and result.
 */
export async function updateJob(
  jobId: string,
  status: JobStatus,
  result?: unknown,
  errorMessage?: string
): Promise<void> {
  const now = new Date().toISOString();

  const dbResult = await query(
    `UPDATE job_queue
     SET status = $2, result = $3, error_message = $4, updated_at = $5
     WHERE job_id = $1`,
    [jobId, status, result ? JSON.stringify(result) : null, errorMessage ?? null, now]
  );

  if (dbResult === null) {
    // Fallback to in-memory
    const existing = IN_MEMORY_JOBS.get(jobId);
    if (existing) {
      IN_MEMORY_JOBS.set(jobId, { ...existing, status, result, errorMessage, updatedAt: now });
    }
  }

  log.debug({ jobId, status }, "Job updated");
}

/**
 * Claim the next pending job for processing (for worker processes).
 * Returns null if no pending jobs.
 *
 * ⚠️ PROCESS-LOCAL FALLBACK: When PostgreSQL is unavailable, this falls back
 * to an in-memory Map (IN_MEMORY_JOBS). Jobs queued in one process are NOT
 * visible to other processes. This fallback is suitable for single-process
 * development only.
 */
export async function claimNextJob(): Promise<JobRecord | null> {
  await ensureJobSchema();

  const result = await query<{
    job_id: string;
    status: string;
    input: string;
    created_at: string;
    updated_at: string;
  }>(
    `UPDATE job_queue
     SET status = 'running', updated_at = NOW()
     WHERE job_id = (
       SELECT job_id FROM job_queue
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING job_id, status, input, created_at, updated_at`
  );

  if (result && result.rows.length > 0) {
    const r = result.rows[0];
    return {
      jobId: r.job_id,
      status: r.status as JobStatus,
      input: r.input,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  // Fallback: claim from in-memory
  for (const [id, job] of IN_MEMORY_JOBS.entries()) {
    if (job.status === "pending") {
      IN_MEMORY_JOBS.set(id, { ...job, status: "running", updatedAt: new Date().toISOString() });
      return { ...job, status: "running" };
    }
  }

  return null;
}
