/**
 * PostgreSQL Client
 *
 * Thin wrapper around the `pg` pool. Provides a shared connection pool
 * for all Phase 02 database access (vector search, prompt registry,
 * decisions persistence, human review queue).
 *
 * Graceful degradation: when POSTGRES_URL is not set or the DB is
 * unreachable, callers receive null from getPool() and must fall back
 * to in-memory / file-based implementations.
 */

import pg from "pg";
import { isMockMode } from "../utils/mock-responses.js";
import { childLogger } from "../utils/logger.js";

const log = childLogger("DB");

const { Pool } = pg;

// ============================================================================
// Pool singleton
// ============================================================================

let _pool: pg.Pool | null = null;
let _connectionAttempted = false;

/**
 * Get the shared PostgreSQL connection pool.
 * Returns null when the DB is unavailable (no URL set, or connection refused).
 * All callers must handle the null case gracefully.
 */
export async function getPool(): Promise<pg.Pool | null> {
  if (_pool) return _pool;
  if (_connectionAttempted) return null;

  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;

  if (!url || url.startsWith("file:") || isMockMode()) {
    return null;
  }

  _connectionAttempted = true;

  try {
    const pool = new Pool({
      connectionString: url,
      max: parseInt(process.env.DB_MAX_CONNECTIONS ?? "10", 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 3_000,
    });

    // Verify connectivity (throws on failure)
    const client = await pool.connect();
    client.release();

    _pool = pool;
    log.info("PostgreSQL connected");
    return _pool;
  } catch (err) {
    log.warn({ err: (err as Error).message }, "PostgreSQL unavailable — falling back to in-memory");
    return null;
  }
}

/**
 * Execute a parameterized query.
 * Returns null if the pool is unavailable.
 */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<pg.QueryResult<T> | null> {
  const pool = await getPool();
  if (!pool) return null;

  try {
    return await pool.query<T>(sql, params);
  } catch (err) {
    log.error({ err: (err as Error).message, sql }, "Query error");
    throw err;
  }
}

/**
 * Reset the pool (for testing isolation).
 */
export async function resetPool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
  _connectionAttempted = false;
}
