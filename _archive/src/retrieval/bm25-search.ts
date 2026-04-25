/**
 * BM25 Search — Elasticsearch keyword search over DBWD corpus
 *
 * Executes a multi_match query against the dbwd_corpus index.
 * Gracefully returns an empty array when Elasticsearch is unavailable.
 */

import { Client } from "@elastic/elasticsearch";
import { childLogger } from "../utils/logger.js";
import type { RetrievalHit } from "./types.js";

const log = childLogger("BM25");

// ============================================================================
// Client singleton
// ============================================================================

let _esClient: Client | null = null;
let _esUnavailable = false;

function getESClient(): Client {
  if (!_esClient) {
    _esClient = new Client({
      node: process.env.ELASTICSEARCH_URL ?? "http://localhost:9200",
      requestTimeout: 2_000,
      maxRetries: 0,
    });
  }
  return _esClient;
}

/** Reset client and availability cache (for tests) */
export function resetESClient(): void {
  _esClient = null;
  _esUnavailable = false;
}

// ============================================================================
// BM25 search
// ============================================================================

export interface BM25SearchOptions {
  topK?: number;
}

/**
 * Search DBWD corpus using BM25 keyword matching.
 *
 * @param query Trade classification string (e.g. "Wireman", "Pipe Fitter")
 * @param options Search options
 * @returns Ranked hits — empty array if ES unavailable
 */
export async function bm25Search(
  query: string,
  options: BM25SearchOptions = {}
): Promise<RetrievalHit[]> {
  const topK = options.topK ?? parseInt(process.env.ELASTICSEARCH_TOP_K ?? "20", 10);
  const indexName = process.env.ELASTICSEARCH_INDEX ?? "dbwd_corpus";

  if (_esUnavailable) return [];

  const client = getESClient();

  try {
    const result = await client.search({
      index: indexName,
      size: topK,
      query: {
        multi_match: {
          query,
          fields: ["jobTitle^3", "aliases^2", "description"],
          type: "best_fields",
          fuzziness: "AUTO",
        },
      },
    });

    return result.hits.hits.map((hit, rank) => ({
      tradeCode: (hit._source as Record<string, unknown>)?.tradeCode as string ?? "",
      jobTitle: (hit._source as Record<string, unknown>)?.jobTitle as string ?? "",
      baseRate: (hit._source as Record<string, unknown>)?.baseRate as number ?? 0,
      fringeRate: (hit._source as Record<string, unknown>)?.fringeRate as number ?? 0,
      effectiveDate: (hit._source as Record<string, unknown>)?.effectiveDate as string ?? "",
      wdId: (hit._source as Record<string, unknown>)?.wdId as string ?? hit._id,
      score: hit._score ?? 0,
      rank,
      source: "bm25" as const,
    }));
  } catch (err) {
    _esUnavailable = true;
    log.warn({ err }, "[BM25] Elasticsearch unavailable");
    return [];
  }
}
