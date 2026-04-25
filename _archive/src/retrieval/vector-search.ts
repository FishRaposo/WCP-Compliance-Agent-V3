/**
 * Vector Search — pgvector cosine similarity search over DBWD corpus
 *
 * Generates an embedding for the query, then queries wage_determination_vectors
 * using the <=> cosine distance operator.
 * Gracefully returns an empty array when PostgreSQL is unavailable.
 */

import { getPool } from "../services/db-client.js";
import { isMockMode } from "../utils/mock-responses.js";
import { childLogger } from "../utils/logger.js";
import type { RetrievalHit } from "./types.js";

const log = childLogger("VectorSearch");

// ============================================================================
// Embedding
// ============================================================================

/**
 * Generate an embedding vector for the given text.
 * Returns a zero vector in mock mode.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (isMockMode()) {
    return new Array(parseInt(process.env.PGVECTOR_DIMENSIONS ?? "1536", 10)).fill(0);
  }

  const apiKey = process.env.OPENAI_API_KEY!;
  const model = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";

  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input: text }),
  });

  if (!resp.ok) {
    throw new Error(`OpenAI embeddings error: ${resp.status}`);
  }

  const data = (await resp.json()) as { data: { embedding: number[] }[] };
  return data.data[0].embedding;
}

// ============================================================================
// Vector search
// ============================================================================

export interface VectorSearchOptions {
  topK?: number;
}

/**
 * Search DBWD corpus using pgvector cosine similarity.
 *
 * @param query Trade classification string
 * @param options Search options
 * @returns Ranked hits — empty array if DB unavailable
 */
export async function vectorSearch(
  query: string,
  options: VectorSearchOptions = {}
): Promise<RetrievalHit[]> {
  const topK = options.topK ?? parseInt(process.env.PGVECTOR_TOP_K ?? "20", 10);
  const pool = await getPool();

  if (!pool) {
    return [];
  }

  try {
    const embedding = await generateEmbedding(query);
    const embeddingStr = `[${embedding.join(",")}]`;

    const result = await pool.query<{
      wd_id: string;
      job_title: string;
      locality: string;
      wage_rate: string;
      fringe_rate: string;
      effective_date: string;
      metadata: Record<string, unknown>;
      distance: string;
    }>(
      `SELECT wd_id, job_title, locality, wage_rate, fringe_rate, effective_date, metadata,
              embedding <=> $1::vector AS distance
       FROM wage_determination_vectors
       ORDER BY distance ASC
       LIMIT $2`,
      [embeddingStr, topK]
    );

    return result.rows.map((row, rank) => ({
      tradeCode: typeof row.metadata?.tradeCode === "string" ? row.metadata.tradeCode : "",
      jobTitle: row.job_title,
      baseRate: Number.isFinite(Number(row.wage_rate)) ? parseFloat(row.wage_rate) : 0,
      fringeRate: Number.isFinite(Number(row.fringe_rate)) ? parseFloat(row.fringe_rate) : 0,
      effectiveDate: row.effective_date,
      wdId: row.wd_id,
      score: Number.isFinite(Number(row.distance)) ? 1 - parseFloat(row.distance) : 0, // cosine similarity = 1 - distance
      rank,
      source: "vector" as const,
    }));
  } catch (err) {
    log.warn({ err }, "[VectorSearch] Query failed");
    return [];
  }
}
