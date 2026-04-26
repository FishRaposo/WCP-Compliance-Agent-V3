// Auto-generated from shared/schemas/*.json - do not edit manually
import { z } from "zod";

export const AuditEventSchema = z.object({
  event_id: z.string(),
  job_id: z.string(),
  event_type: z.enum(['extraction_complete', 'validation_complete', 'verdict_issued', 'trust_scored', 'human_review_queued', 'human_review_complete', 'decision_persisted']),
  timestamp: z.string(),
  actor: z.string(),
  payload: z.record(z.any()),
  regulation_references: z.array(z.any()),
  trace_id: z.string(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const DeterministicReportSchema = z.object({
  job_id: z.string(),
  checks: z.array(z.any()),
  overall_status: z.enum(['pass', 'fail', 'warnings']),
  violation_count: z.number().int(),
  warning_count: z.number().int(),
  dbwd_rates_used: z.array(z.any()),
});
export type DeterministicReport = z.infer<typeof DeterministicReportSchema>;

export const ExtractedWCPSchema = z.object({
  job_id: z.string(),
  contractor: z.record(z.any()),
  project: z.record(z.any()),
  employees: z.array(z.any()),
  certification_date: z.string(),
  payroll_number: z.number().int(),
  week_ending: z.string(),
});
export type ExtractedWCP = z.infer<typeof ExtractedWCPSchema>;

export const LLMVerdictSchema = z.object({
  job_id: z.string(),
  verdict: z.enum(['approved', 'rejected', 'requires_review']),
  reasoning: z.string(),
  citations: z.array(z.any()),
  confidence: z.number(),
  rag_context_used: z.boolean(),
  model: z.string(),
  prompt_version: z.string(),
  langfuse_trace_id: z.string(),
  token_usage: z.record(z.any()),
});
export type LLMVerdict = z.infer<typeof LLMVerdictSchema>;

export const TrustScoredDecisionSchema = z.object({
  job_id: z.string(),
  verdict: z.enum(['approved', 'rejected', 'requires_review']),
  trust_score: z.number(),
  trust_band: z.enum(['auto_approve', 'flag_for_review', 'require_human_review']),
  requires_human_review: z.boolean(),
  violation_count: z.number().int(),
  warning_count: z.number().int(),
  llm_confidence: z.number(),
  reasoning_summary: z.string(),
  citations: z.array(z.any()),
  cost_usd: z.number(),
  latency_ms: z.number().int(),
  phoenix_trace_id: z.string(),
  created_at: z.string(),
});
export type TrustScoredDecision = z.infer<typeof TrustScoredDecisionSchema>;
