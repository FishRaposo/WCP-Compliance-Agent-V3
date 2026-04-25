/**
 * ============================================================================
 * DBWD Retrieval Service — JSON File-Based (PoC)
 * ============================================================================
 *
 * This module provides Davis-Bacon Wage Determination (DBWD) rate lookups
 * and fuzzy trade classification matching for Layer 1 of the WCP Compliance
 * Agent decision pipeline.
 *
 * ---------------------------------------------------------------------------
 * CURRENT STATE: JSON File-Based Retrieval
 * ---------------------------------------------------------------------------
 *
 * Why JSON files?
 *   • Zero infrastructure — no database, no vector store, no search engine.
 *   • Perfect for a portfolio PoC that must compile and run anywhere.
 *   • Rates are loaded once at module init and held in memory.
 *   • No new dependencies added to the project.
 *
 * What it does:
 *   1. Loads `data/dbwd-rates.json` at startup (5 core trades + aliases).
 *   2. Builds an in-memory index: trade name → DBWDRateInfo.
 *   3. Builds an alias map: alias string → canonical trade name.
 *   4. `lookupRate()` — exact or alias match against the loaded corpus.
 *   5. `fuzzyMatchTrade()` — Levenshtein-distance fallback for typos,
 *      partial matches, and unknown variants.
 *
 * Limitations (acceptable for PoC scope):
 *   • Only 5 trades — real SAM.gov corpus has thousands.
 *   • No locality-specific rates — all entries share "Metropolitan Area".
 *   • No versioning or historical lookups — single effective date.
 *   • Fuzzy match is pure string distance — no semantic/vector understanding.
 *   • No full-text search, BM25, or hybrid ranking.
 *
 * ---------------------------------------------------------------------------
 * TARGET STATE: PostgreSQL + pgvector Hybrid Search
 * ---------------------------------------------------------------------------
 *
 * For a production deployment, swap this module for a SQL-backed retriever:
 *
 *   Schema (simplified):
 *     CREATE TABLE dbwd_rates (
 *       dbwd_id      TEXT PRIMARY KEY,
 *       trade        TEXT NOT NULL,
 *       trade_code   TEXT NOT NULL,
 *       base_rate    NUMERIC(10,2) NOT NULL,
 *       fringe_rate  NUMERIC(10,2) NOT NULL,
 *       total_rate   NUMERIC(10,2) GENERATED ALWAYS AS (base_rate + fringe_rate) STORED,
 *       locality     TEXT NOT NULL,
 *       effective_date DATE NOT NULL,
 *       source       TEXT NOT NULL DEFAULT 'SAM.gov',
 *       description  TEXT,
 *       embedding    VECTOR(384)   -- pgvector extension
 *     );
 *
 *     CREATE INDEX idx_dbwd_embedding ON dbwd_rates USING ivfflat (embedding vector_cosine_ops);
 *     CREATE INDEX idx_dbwd_trade_gin ON dbwd_rates USING gin (to_tsvector('english', trade || ' ' || COALESCE(description, '')));
 *
 *   Query pattern (hybrid: BM25 + vector + rerank):
 *     WITH bm25 AS (
 *       SELECT dbwd_id, ts_rank(to_tsvector(...), plainto_tsquery($1)) AS bm25_score
 *       FROM dbwd_rates WHERE to_tsvector(...) @@ plainto_tsquery($1)
 *     ),
 *     vec AS (
 *       SELECT dbwd_id, 1 - (embedding <=> $2::vector) AS vec_score
 *       FROM dbwd_rates ORDER BY embedding <=> $2::vector LIMIT 50
 *     )
 *     SELECT r.*,
 *            COALESCE(b.bm25_score, 0) * 0.4 + COALESCE(v.vec_score, 0) * 0.6 AS hybrid_score
 *     FROM dbwd_rates r
 *     LEFT JOIN bm25 b ON r.dbwd_id = b.dbwd_id
 *     LEFT JOIN vec  v ON r.dbwd_id = v.dbwd_id
 *     ORDER BY hybrid_score DESC LIMIT 5;
 *
 *   Then run a cross-encoder reranker (e.g., sentence-transformers/ms-marco-MiniLM-L-6-v2)
 *   on the top-5 results to produce a final confidence score.
 *
 * Migration path (when upgrading from JSON to PostgreSQL):
 *   1. Replace the `loadRates()` call below with a `DbwdRepository` class
 *      that uses `pg` (already in package.json) to query the table above.
 *   2. Replace `lookupRate()` to execute a SQL query instead of Map lookup.
 *   3. Keep `fuzzyMatchTrade()` as a client-side fallback for when the DB
 *      is unreachable or returns no hits.
 *   4. Remove `data/dbwd-rates.json` from the repo; seed the DB via a
 *      migration script that parses the official SAM.gov WD JSON export.
 *
 * Why this was scoped out:
 *   This is a portfolio proof-of-concept, not a production platform.
 *   Adding PostgreSQL, pgvector, Elasticsearch, and a cross-encoder would
 *   require Docker, cloud infra, and significant setup time — all of which
 *   would make the repo harder to clone and run for reviewers. The JSON
 *   approach proves the architecture (deterministic → LLM → trust score)
 *   without infrastructure gatekeeping.
 *
 * @see docs/architecture/retrieval-upgrade-path.md
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { DBWDRateInfo } from "../types/decision-pipeline.js";
import { childLogger } from "../utils/logger.js";

const _dirname = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));

const log = childLogger("DBWDRetrieval");

// ============================================================================
// Levenshtein Distance (for fuzzy matching)
// ============================================================================

/**
 * Compute Levenshtein edit distance between two strings.
 * Classic dynamic-programming implementation — O(n×m) time, O(min(n,m)) space.
 */
function levenshtein(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  if (s === t) return 0;
  if (s.length === 0) return t.length;
  if (t.length === 0) return s.length;

  // Ensure s is the shorter string to minimize space
  if (s.length > t.length) {
    return levenshtein(t, s);
  }

  let prev = new Array(s.length + 1);
  let curr = new Array(s.length + 1);
  for (let i = 0; i <= s.length; i++) prev[i] = i;

  for (let j = 1; j <= t.length; j++) {
    curr[0] = j;
    for (let i = 1; i <= s.length; i++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        prev[i] + 1,      // deletion
        curr[i - 1] + 1,  // insertion
        prev[i - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[s.length];
}

// ============================================================================
// JSON Corpus Loading
// ============================================================================

interface JsonRateEntry {
  trade: string;
  dbwdId: string;
  tradeCode: string;
  baseRate: number;
  fringeRate: number;
  totalRate: number;
  effectiveDate: string;
  locality: string;
  source: string;
  description: string;
  aliases: string[];
}

interface JsonCorpus {
  metadata: {
    source: string;
    version: string;
    description: string;
    locality: string;
    effectiveDate: string;
    totalTrades: number;
    totalAliases: number;
  };
  trades: JsonRateEntry[];
}

const RATES_BY_TRADE = new Map<string, DBWDRateInfo>();
const ALIAS_TO_TRADE = new Map<string, string>();
const ALL_ALIASES: string[] = [];

/** Schema for dbwd-corpus.json (array of entries) */
interface CorpusEntry {
  wdId: string;
  tradeCode: string;
  jobTitle: string;
  aliases: string[];
  locality: string;
  state: string;
  baseRate: number;
  fringeRate: number;
  effectiveDate: string;
  description: string;
}

function loadRates(): void {
  // Try multiple resolution paths so this works both in dev (tsx/vitest)
  // and after build (node dist/server.js).
  // Prefer dbwd-corpus.json (authoritative source); fall back to dbwd-rates.json.
  const candidates = [
    resolve(process.cwd(), "data/dbwd-corpus.json"),
    resolve(_dirname, "../../data/dbwd-corpus.json"),   // from dist/services/
    resolve(_dirname, "../../../data/dbwd-corpus.json"), // from dist/
    resolve(process.cwd(), "data/dbwd-rates.json"),
    resolve(_dirname, "../../data/dbwd-rates.json"),   // from dist/services/
    resolve(_dirname, "../../../data/dbwd-rates.json"), // from dist/
  ];

  let raw: string | null = null;
  let loadedPath: string | null = null;

  for (const path of candidates) {
    if (existsSync(path)) {
      try {
        raw = readFileSync(path, "utf-8");
        loadedPath = path;
        break;
      } catch {
        continue;
      }
    }
  }

  if (!raw || !loadedPath) {
    log.error({ candidates }, "Could not find DBWD corpus — DBWD lookups will fail");
    return;
  }

  try {
    if (loadedPath.endsWith("dbwd-corpus.json")) {
      // Array format: dbwd-corpus.json
      const entries = JSON.parse(raw) as CorpusEntry[];
      for (const entry of entries) {
        const rateInfo: DBWDRateInfo = {
          dbwdId: entry.wdId,
          baseRate: entry.baseRate,
          fringeRate: entry.fringeRate,
          totalRate: entry.baseRate + entry.fringeRate,
          version: entry.effectiveDate,
          effectiveDate: entry.effectiveDate,
          trade: entry.jobTitle,
          tradeCode: entry.tradeCode,
          locality: entry.locality,
        };

        RATES_BY_TRADE.set(entry.jobTitle, rateInfo);
        ALL_ALIASES.push(entry.jobTitle);

        for (const alias of entry.aliases) {
          ALIAS_TO_TRADE.set(alias, entry.jobTitle);
          ALL_ALIASES.push(alias);
        }
      }
    } else {
      // Object format: dbwd-rates.json { metadata, trades }
      const corpus = JSON.parse(raw) as JsonCorpus;
      for (const entry of corpus.trades) {
        const rateInfo: DBWDRateInfo = {
          dbwdId: entry.dbwdId,
          baseRate: entry.baseRate,
          fringeRate: entry.fringeRate,
          totalRate: entry.totalRate,
          version: corpus.metadata.version,
          effectiveDate: entry.effectiveDate,
          trade: entry.trade,
          tradeCode: entry.tradeCode,
          locality: entry.locality,
        };

        RATES_BY_TRADE.set(entry.trade, rateInfo);
        ALL_ALIASES.push(entry.trade);

        for (const alias of entry.aliases) {
          ALIAS_TO_TRADE.set(alias, entry.trade);
          ALL_ALIASES.push(alias);
        }
      }
    }

    log.info(
      {
        path: loadedPath,
        trades: RATES_BY_TRADE.size,
        aliases: ALIAS_TO_TRADE.size,
      },
      "Loaded DBWD rates from JSON corpus"
    );
  } catch (err) {
    log.error({ err, path: loadedPath }, "Failed to parse DBWD corpus");
  }
}

// Load at module init
loadRates();

// ============================================================================
// Public API
// ============================================================================

/**
 * Look up a DBWD rate by trade name or known alias.
 *
 * @param trade       Trade classification string (e.g. "Electrician" or "Wireman")
 * @param locality    Optional locality override (ignored in JSON mode —
 *                    all entries share "Metropolitan Area"; kept for API
 *                    compatibility with the future PostgreSQL implementation)
 * @returns DBWDRateInfo or null if not found
 */
export function lookupRate(trade: string, locality?: string): DBWDRateInfo | null {
  const normalized = trade.trim();

  // Exact match on canonical trade name
  const direct = RATES_BY_TRADE.get(normalized);
  if (direct) {
    return locality ? { ...direct, locality } : direct;
  }

  // Alias match
  const aliasedTrade = ALIAS_TO_TRADE.get(normalized);
  if (aliasedTrade) {
    const rate = RATES_BY_TRADE.get(aliasedTrade);
    if (rate) {
      return locality ? { ...rate, locality } : rate;
    }
  }

  return null;
}

/**
 * Fuzzy-match an arbitrary input string against all known trade names and aliases.
 *
 * Uses Levenshtein distance with a configurable similarity threshold.
 * Falls back to the original input when nothing is close enough, allowing
 * upstream code to treat it as an unknown classification.
 *
 * @param input  Raw trade string from WCP extraction (may contain typos,
 *               abbreviations, or unrecognised variants)
 * @returns      Best-matching canonical trade name, or the original input if
 *               no match exceeds the threshold
 */
export function fuzzyMatchTrade(input: string): string {
  const normalized = input.trim();
  if (normalized.length === 0) return normalized;

  // Fast path: exact match
  if (RATES_BY_TRADE.has(normalized) || ALIAS_TO_TRADE.has(normalized)) {
    return normalized;
  }

  // Compute Levenshtein distance against every known alias + trade name
  let bestMatch = normalized;
  let bestScore = Infinity;

  for (const candidate of ALL_ALIASES) {
    const dist = levenshtein(normalized, candidate);
    // Normalise by candidate length so short aliases don't unfairly win
    const normalisedDist = dist / candidate.length;
    if (normalisedDist < bestScore) {
      bestScore = normalisedDist;
      bestMatch = candidate;
    }
  }

  // Threshold: reject matches that require > 40 % edits relative to candidate length
  const THRESHOLD = 0.40;
  if (bestScore > THRESHOLD) {
    return normalized;
  }

  // Map alias back to canonical trade name if needed
  const canonical = ALIAS_TO_TRADE.get(bestMatch) ?? bestMatch;
  return canonical;
}
