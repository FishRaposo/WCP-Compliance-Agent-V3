export type VerdictStatus = "approved" | "rejected" | "requires_review";
export type TrustBand = "auto_approve" | "flag_for_review" | "require_human_review";

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
  trust_band: TrustBand;
  requires_human_review: boolean;
  violation_count: number;
  warning_count: number;
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

export interface DecisionVolume {
  date: string;
  count: number;
}

export interface ApprovalRateOverall {
  total: number;
  approved: number;
  rate: number;
}

export interface ApprovalRateByBand {
  trust_band: string;
  total: number;
  approved: number;
  rate: number;
}

export interface ApprovalRateResponse {
  overall: ApprovalRateOverall;
  by_trust_band: ApprovalRateByBand[];
}

export interface TrustBandDistribution {
  trust_band: string;
  count: number;
  percentage: number;
}

export interface CostAnalytics {
  total_decisions: number;
  decisions_this_month: number;
  note: string;
}

export interface PipelineStep {
  label: string;
  status: "pending" | "running" | "done" | "error";
}
