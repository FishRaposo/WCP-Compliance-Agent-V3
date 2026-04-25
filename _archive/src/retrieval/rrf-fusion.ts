/**
 * Reciprocal Rank Fusion (RRF)
 *
 * Combines BM25 and vector search results into a single ranked list.
 * Formula: score(d) = Σ_r 1 / (k + rank_r(d))  where k=60 (standard)
 *
 * Pure function — no external dependencies. Always synchronous.
 */

import type { RetrievalHit, FusedHit } from "./types.js";

const RRF_K = 60;

/**
 * Fuse BM25 and vector hits using Reciprocal Rank Fusion.
 *
 * @param bm25Hits Hits from BM25 search, ordered by relevance (best first)
 * @param vectorHits Hits from vector search, ordered by similarity (best first)
 * @returns Fused and deduplicated hits ordered by RRF score (best first)
 */
export function rrfFusion(
  bm25Hits: RetrievalHit[],
  vectorHits: RetrievalHit[]
): FusedHit[] {
  // Map: tradeCode -> accumulated RRF score + contributing sources
  const scores = new Map<string, { rrfScore: number; hit: RetrievalHit; sources: Set<"bm25" | "vector"> }>();

  const addHits = (hits: RetrievalHit[], source: "bm25" | "vector"): void => {
    hits.forEach((hit, rank) => {
      const key = hit.tradeCode || hit.wdId;
      const contribution = 1 / (RRF_K + rank + 1); // rank is 0-based

      const existing = scores.get(key);
      if (existing) {
        existing.rrfScore += contribution;
        existing.sources.add(source);
        // Keep the hit from the better-scoring source
        if (hit.score > existing.hit.score) {
          existing.hit = hit;
        }
      } else {
        scores.set(key, {
          rrfScore: contribution,
          hit,
          sources: new Set([source]),
        });
      }
    });
  };

  addHits(bm25Hits, "bm25");
  addHits(vectorHits, "vector");

  return Array.from(scores.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .map(({ hit, rrfScore, sources }) => ({
      ...hit,
      rrfScore,
      sources: Array.from(sources),
    }));
}
