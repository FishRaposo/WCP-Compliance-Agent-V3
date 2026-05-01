import type {
  AnalyticsOverview,
  TrustScoredDecision,
  DecisionSummary,
  DecisionVolume,
  ApprovalRateResponse,
  TrustBandDistribution,
  CostAnalytics,
  JobStatus,
} from "../types/api";
import type { IngestionJobSummary, PaginatedContracts, PaginatedPayrolls } from "../types/v4";

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

export const mockAnalyticsOverview: AnalyticsOverview = {
  total_decisions: 156,
  total_contracts: 12,
  avg_trust_score: 0.87,
  overall_approval_rate: 0.859,
  human_review_queue_depth: 16,
  decisions_this_month: 42,
  note: "Mock mode — summary metrics derived from sample V3 decisions",
};

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

export const mockContracts: PaginatedContracts = {
  items: [
    {
      id: "contract-001",
      contract_number: "DBA-2026-001",
      project_name: "Federal Courthouse Renovation",
      contractor_name: "Keystone Builders",
      locality: "Boston, MA",
      status: "active",
      decision_count: 18,
      payroll_record_count: 240,
      created_at: new Date(Date.now() - 86400_000 * 10).toISOString(),
    },
    {
      id: "contract-002",
      contract_number: "DBA-2026-002",
      project_name: "Transit Maintenance Facility",
      contractor_name: "Northline Electric",
      locality: "Cambridge, MA",
      status: "active",
      decision_count: 9,
      payroll_record_count: 112,
      created_at: new Date(Date.now() - 86400_000 * 4).toISOString(),
    },
  ],
  total: 2,
  page: 1,
  per_page: 25,
  pages: 1,
};

export const mockPayrolls: PaginatedPayrolls = {
  items: [
    {
      id: "payroll-001",
      contract_id: "contract-001",
      employee_name: "Jane Worker",
      trade_code: "Electrician",
      locality_code: "Boston, MA",
      week_ending: "2026-01-09",
      total_hours: "40.0",
      hourly_rate: "51.69",
      gross_pay: "2067.60",
    },
    {
      id: "payroll-002",
      contract_id: "contract-001",
      employee_name: "Alex Mechanic",
      trade_code: "Laborer",
      locality_code: "Boston, MA",
      week_ending: "2026-01-09",
      total_hours: "42.0",
      hourly_rate: "38.50",
      gross_pay: "1694.00",
    },
  ],
  total: 2,
  page: 1,
  per_page: 25,
  pages: 1,
};

export const mockIngestionJobs: IngestionJobSummary[] = [
  {
    job_id: "ing-001",
    type: "payroll_import",
    status: "completed",
    source_type: "csv",
    total_records: 240,
    processed_records: 240,
    failed_records: 0,
    created_at: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    job_id: "ing-002",
    type: "contract_import",
    status: "partial",
    source_type: "csv",
    total_records: 12,
    processed_records: 10,
    failed_records: 2,
    created_at: new Date(Date.now() - 7200_000).toISOString(),
  },
];

// V4 analytics mock data for canonical endpoint responses
export const mockComplianceAnalytics = {
  total_decisions: 156,
  approval_rate: 85.9,
  by_trade: [
    { trade: "Electrician", total: 48, approved: 44, flagged: 3, rejected: 1, approval_rate: 91.7 },
    { trade: "Laborer", total: 39, approved: 31, flagged: 5, rejected: 3, approval_rate: 79.5 },
    { trade: "Carpenter", total: 28, approved: 25, flagged: 2, rejected: 1, approval_rate: 89.3 },
    { trade: "Plumber", total: 22, approved: 18, flagged: 3, rejected: 1, approval_rate: 81.8 },
    { trade: "HVAC Technician", total: 19, approved: 16, flagged: 2, rejected: 1, approval_rate: 84.2 },
  ],
  by_locality: [
    { locality: "Boston, MA", total: 62, approval_rate: 91.9 },
    { locality: "Cambridge, MA", total: 41, approval_rate: 87.8 },
    { locality: "Worcester, MA", total: 28, approval_rate: 78.6 },
    { locality: "Springfield, MA", total: 25, approval_rate: 72.0 },
  ],
};

export const mockWagesAnalytics = {
  total_decisions: 156,
  violation_rate: 14.1,
  avg_actual_vs_required_diff: 2.34,
  fringe_compliance_rate: 91.2,
  wage_trend: Array.from({ length: 14 }, (_, i) => ({
    date: new Date(Date.now() - (13 - i) * 86400_000).toISOString().slice(0, 10),
    violations: Math.floor(Math.random() * 8) + 1,
    total_checked: Math.floor(Math.random() * 20) + 10,
    violation_rate: Math.random() * 10 + 5,
  })),
  actual_vs_required: Array.from({ length: 20 }, (_, i) => ({
    trade_code: ["Electrician", "Laborer", "Carpenter"][i % 3],
    locality_code: "Boston, MA",
    actual_rate: (45 + Math.random() * 15).toFixed(2),
    required_rate: (48 + Math.random() * 5).toFixed(2),
    diff: (Math.random() * 6 - 3).toFixed(2),
  })),
  fringe_compliance: Array.from({ length: 14 }, (_, i) => ({
    date: new Date(Date.now() - (13 - i) * 86400_000).toISOString().slice(0, 10),
    compliant_pct: 85 + Math.random() * 12,
  })),
};

export const mockLLMAnalytics = {
  summary: {
    total_cost: 0.67,
    cost_per_decision: 0.0043,
    avg_latency_ms: 1842,
    total_tokens: 482000,
    decisions: 156,
  },
  cost: Array.from({ length: 14 }, (_, i) => ({
    date: new Date(Date.now() - (13 - i) * 86400_000).toISOString().slice(0, 10),
    cost_usd: Math.random() * 0.08 + 0.01,
    decisions: Math.floor(Math.random() * 15) + 2,
    total_cost: Math.random() * 0.1 + 0.02,
  })),
  tokens: Array.from({ length: 14 }, (_, i) => ({
    date: new Date(Date.now() - (13 - i) * 86400_000).toISOString().slice(0, 10),
    prompt_tokens: Math.floor(Math.random() * 20000) + 5000,
    completion_tokens: Math.floor(Math.random() * 8000) + 2000,
    total_tokens: Math.floor(Math.random() * 28000) + 7000,
  })),
  model_distribution: [
    { model: "gpt-4o", count: 89, percentage: 57.1, avg_cost: 0.0052 },
    { model: "gpt-4o-mini", count: 48, percentage: 30.8, avg_cost: 0.0008 },
    { model: "claude-3-5-sonnet", count: 19, percentage: 12.1, avg_cost: 0.0068 },
  ],
  latency: [
    { model: "gpt-4o", p50_ms: 1200, p95_ms: 2500, p99_ms: 3800 },
    { model: "gpt-4o-mini", p50_ms: 400, p95_ms: 900, p99_ms: 1500 },
    { model: "claude-3-5-sonnet", p50_ms: 1100, p95_ms: 2200, p99_ms: 3500 },
  ],
};
