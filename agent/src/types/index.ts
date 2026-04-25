import { z } from "zod";

export const VerdictStatusSchema = z.enum(["approved", "rejected", "requires_review"]);
export type VerdictStatus = z.infer<typeof VerdictStatusSchema>;

export const TrustBandSchema = z.enum(["high", "medium", "low"]);
export type TrustBand = z.infer<typeof TrustBandSchema>;

export const CitationSchema = z.object({
  regulation: z.string(),
  section: z.string().default(""),
  text: z.string().default(""),
});
export type Citation = z.infer<typeof CitationSchema>;

export const ExtractedWCPSchema = z.object({
  job_id: z.string(),
  contractor: z.object({ name: z.string(), address: z.string(), ein: z.string() }),
  project: z.object({
    name: z.string(),
    location: z.string(),
    contract_number: z.string(),
    wage_determination_number: z.string(),
  }),
  employees: z.array(
    z.object({
      name: z.string(),
      trade_classification: z.string(),
      hours_worked: z.number(),
      overtime_hours: z.number().default(0),
      hourly_wage: z.number(),
      fringe_benefits: z.number().default(0),
      gross_earnings: z.number(),
      deductions: z.number().default(0),
      net_wages: z.number(),
    })
  ),
  certification_date: z.string(),
  payroll_number: z.number().nullable().optional(),
  week_ending: z.string().nullable().optional(),
});
export type ExtractedWCP = z.infer<typeof ExtractedWCPSchema>;

export const TrustScoredDecisionSchema = z.object({
  job_id: z.string(),
  verdict: VerdictStatusSchema,
  trust_score: z.number().min(0).max(1),
  trust_band: TrustBandSchema,
  requires_human_review: z.boolean(),
  violation_count: z.number(),
  warning_count: z.number(),
  llm_confidence: z.number(),
  reasoning_summary: z.string(),
  citations: z.array(CitationSchema),
  cost_usd: z.number().nullable().optional(),
  latency_ms: z.number().nullable().optional(),
  phoenix_trace_id: z.string().optional(),
  created_at: z.string().optional(),
});
export type TrustScoredDecision = z.infer<typeof TrustScoredDecisionSchema>;
