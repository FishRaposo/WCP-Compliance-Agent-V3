/**
 * Cross-Encoder Re-ranking
 *
 * Re-ranks fused candidates using cosine similarity between the query embedding
 * and each candidate's cached description embedding. This approximates a proper
 * cross-encoder without requiring a separate model.
 *
 * In mock mode, returns candidates unchanged (no API calls).
 */

import { generateEmbedding } from "./vector-search.js";
import { childLogger } from "../utils/logger.js";
import type { FusedHit, RetrievalHit } from "./types.js";

const log = childLogger("CrossEncoder");

// ============================================================================
// Utilities
// ============================================================================

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ============================================================================
// Cross-encoder
// ============================================================================

/**
 * Re-rank candidates by computing cosine similarity between query and each
 * candidate's title+description embedding.
 *
 * @param query Original trade classification query
 * @param candidates Fused candidates from RRF (top-20)
 * @param descriptions Map of tradeCode → description text for embedding
 * @returns Re-ranked hits marked with source="reranked"
 */
export async function crossEncoderRerank(
  query: string,
  candidates: FusedHit[],
  descriptions: Map<string, string>
): Promise<RetrievalHit[]> {
  if (candidates.length === 0) return [];

  try {
    // Generate query embedding once
    const queryEmbedding = await generateEmbedding(query);

    // Generate candidate embeddings and score
    const scored: { hit: FusedHit; similarity: number }[] = [];

    for (const hit of candidates) {
      const descText = descriptions.get(hit.tradeCode) ?? `${hit.jobTitle}`;
      const candidateEmbedding = await generateEmbedding(descText);
      const similarity = cosineSimilarity(queryEmbedding, candidateEmbedding);
      scored.push({ hit, similarity });
    }

    // Sort by similarity descending
    scored.sort((a, b) => b.similarity - a.similarity);

    return scored.map(({ hit, similarity }, rank) => ({
      ...hit,
      score: similarity,
      rank,
      source: "reranked" as const,
    }));
  } catch (err) {
    log.warn({ err }, "[CrossEncoder] Re-ranking failed, returning original order");
    return candidates;
  }
}
