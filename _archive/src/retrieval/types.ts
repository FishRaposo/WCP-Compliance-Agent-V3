/**
 * Shared types for the hybrid retrieval pipeline
 */

/** A single candidate result from any retrieval source */
export interface RetrievalHit {
  /** DBWD trade code (e.g. "ELEC0490") */
  tradeCode: string;
  /** Human-readable job title */
  jobTitle: string;
  /** Base hourly wage rate */
  baseRate: number;
  /** Fringe benefit rate */
  fringeRate: number;
  /** Effective date of this rate */
  effectiveDate: string;
  /** SAM.gov WD identifier */
  wdId: string;
  /** Raw retrieval score from source system */
  score: number;
  /** 0-based rank within source results */
  rank: number;
  /** Which retrieval system produced this hit */
  source: "bm25" | "vector" | "reranked";
}

/** Fused result after Reciprocal Rank Fusion */
export interface FusedHit extends RetrievalHit {
  /** RRF combined score */
  rrfScore: number;
  /** Sources that contributed to this hit */
  sources: Array<"bm25" | "vector">;
}

/** Timing information for performance monitoring */
export interface RetrievalTimings {
  bm25Ms: number;
  vectorMs: number;
  fusionMs: number;
  rerankMs: number;
  totalMs: number;
}

/** Full retrieval result with metadata */
export interface RetrievalResult {
  query: string;
  hits: RetrievalHit[];
  timings: RetrievalTimings;
  metrics: {
    bm25Hits: number;
    vectorHits: number;
    fusedHits: number;
    finalHits: number;
  };
}
