import type {
  TrustScoredDecision,
  DecisionSummary,
  DecisionVolume,
  ApprovalRateResponse,
  TrustBandDistribution,
  CostAnalytics,
  JobStatus,
} from "../types/api";

export const mockDecisionSummaries: DecisionSummary[] = [
  {
    decision_id: "dec-001",
    job_id: "job-a1b2c3d4",
    verdict: "approved",
    trust_score: 0.92,
    trust_band: "auto_approve",
    requires_human_review: false,
    violation_count: 0,
    warning_count: 1,
    created_at: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    decision_id: "dec-002",
    job_id: "job-e5f6a7b8",
    verdict: "approved",
    trust_score: 0.87,
    trust_band: "auto_approve",
    requires_human_review: false,
    violation_count: 0,
    warning_count: 0,
    created_at: new Date(Date.now() - 7200_000).toISOString(),
  },
  {
    decision_id: "dec-003",
    job_id: "job-c9d0e1f2",
    verdict: "rejected",
    trust_score: 0.45,
    trust_band: "require_human_review",
    requires_human_review: true,
    violation_count: 3,
    warning_count: 2,
    created_at: new Date(Date.now() - 86400_000).toISOString(),
  },
  {
    decision_id: "dec-004",
    job_id: "job-g3h4i5j6",
    verdict: "requires_review",
    trust_score: 0.68,
    trust_band: "flag_for_review",
    requires_human_review: false,
    violation_count: 1,
    warning_count: 1,
    created_at: new Date(Date.now() - 172800_000).toISOString(),
  },
  {
    decision_id: "dec-005",
    job_id: "job-k7l8m9n0",
    verdict: "approved",
    trust_score: 0.95,
    trust_band: "auto_approve",
    requires_human_review: false,
    violation_count: 0,
    warning_count: 0,
    created_at: new Date(Date.now() - 259200_000).toISOString(),
  },
];

export const mockTrustScoredDecision: TrustScoredDecision = {
  job_id: "job-mock-analysis",
  verdict: "approved",
  trust_score: 0.93,
  trust_band: "auto_approve",
  requires_human_review: false,
  violation_count: 0,
  warning_count: 1,
  llm_confidence: 0.95,
  reasoning_summary:
    "All wage rates meet or exceed DBWD minimums. Fringe benefits are compliant. One warning: overtime hours field is empty but no overtime was claimed. Overall compliant with 40 U.S.C. \u00A7 3142.",
  citations: [
    { regulation: "40 U.S.C. \u00A7 3142(b)", section: "3142", text: "Prevailing wage requirements for laborers and mechanics" },
    { regulation: "29 CFR 5.5(a)(1)", section: "5.5", text: "Wage determination compliance" },
  ],
  cost_usd: 0.0042,
  latency_ms: 1850,
  phoenix_trace_id: "trace-mock-abc123",
  created_at: new Date().toISOString(),
};

export const mockDecisionVolume: DecisionVolume[] = Array.from({ length: 14 }, (_, i) => ({
  date: new Date(Date.now() - (13 - i) * 86400_000).toISOString().slice(0, 10),
  count: Math.floor(Math.random() * 15) + 2,
}));

export const mockApprovalRate: ApprovalRateResponse = {
  overall: { total: 156, approved: 134, rate: 0.859 },
  by_trust_band: [
    { trust_band: "auto_approve", total: 98, approved: 98, rate: 1.0 },
    { trust_band: "flag_for_review", total: 42, approved: 30, rate: 0.714 },
    { trust_band: "require_human_review", total: 16, approved: 6, rate: 0.375 },
  ],
};

export const mockTrustBandDistribution: TrustBandDistribution[] = [
  { trust_band: "auto_approve", count: 98, percentage: 62.8 },
  { trust_band: "flag_for_review", count: 42, percentage: 26.9 },
  { trust_band: "require_human_review", count: 16, percentage: 10.3 },
];

export const mockCostAnalytics: CostAnalytics = {
  total_decisions: 156,
  decisions_this_month: 42,
  note: "Mock mode \u2014 no real LLM costs incurred",
};

export const mockJobStatus: JobStatus = {
  job_id: "job-mock-analysis",
  status: "complete",
  result: mockTrustScoredDecision,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockPromptVersions: string[] = ["v2", "v1"];
