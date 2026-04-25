export type VerdictStatus = "approved" | "rejected" | "requires_review";
export type TrustBand = "high" | "medium" | "low";

export interface Citation {
  regulation: string;
  section: string;
  text: string;
}

export interface TrustScoredDecision {
  job_id: string;
  verdict: VerdictStatus;
  trust_score: number;
  trust_band: TrustBand;
  requires_human_review: boolean;
  violation_count: number;
  warning_count: number;
  llm_confidence: number;
  reasoning_summary: string;
  citations: Citation[];
  cost_usd?: number;
  latency_ms?: number;
  phoenix_trace_id?: string;
  created_at?: string;
}

export interface DecisionSummary {
  decision_id: string;
  job_id: string;
  verdict: VerdictStatus;
  trust_score: number;
  created_at: string;
}

export interface JobStatus {
  job_id: string;
  status: "pending" | "processing" | "complete" | "failed";
  result?: TrustScoredDecision;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsVolume {
  date: string;
  total: number;
  approved: number;
  rejected: number;
  in_review: number;
}
