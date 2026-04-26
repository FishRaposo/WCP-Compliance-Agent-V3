import { describe, expect, it } from "vitest";

import {
  VerdictStatusSchema,
  TrustBandSchema,
  CheckStatusSchema,
  OverallStatusSchema,
  TrustScoredDecisionSchema,
  LLMVerdictSchema,
  DeterministicReportSchema,
} from "../../types/index.js";

describe("Zod schema validation", () => {
  it("accepts valid TrustScoredDecision", () => {
    const data = {
      job_id: "test-001",
      verdict: "approved",
      trust_score: 0.92,
      trust_band: "auto_approve",
      requires_human_review: false,
      violation_count: 0,
      warning_count: 0,
      llm_confidence: 0.95,
      reasoning_summary: "All checks passed.",
      citations: [],
    };
    const parsed = TrustScoredDecisionSchema.safeParse(data);
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid trust_band", () => {
    const data = {
      job_id: "test-001",
      verdict: "approved",
      trust_score: 0.92,
      trust_band: "high",
      requires_human_review: false,
      violation_count: 0,
      warning_count: 0,
      llm_confidence: 0.95,
      reasoning_summary: "All checks passed.",
      citations: [],
    };
    const parsed = TrustScoredDecisionSchema.safeParse(data);
    expect(parsed.success).toBe(false);
  });

  it("accepts valid LLMVerdict", () => {
    const data = {
      job_id: "test-001",
      verdict: "rejected",
      reasoning: "Wage violation detected.",
      citations: [{ regulation: "40 U.S.C. § 3142", section: "", text: "" }],
      confidence: 0.88,
    };
    const parsed = LLMVerdictSchema.safeParse(data);
    expect(parsed.success).toBe(true);
  });

  it("rejects out-of-range confidence", () => {
    const data = {
      job_id: "test-001",
      verdict: "approved",
      reasoning: "test",
      citations: [],
      confidence: 1.5,
    };
    const parsed = LLMVerdictSchema.safeParse(data);
    expect(parsed.success).toBe(false);
  });

  it("accepts valid DeterministicReport", () => {
    const data = {
      job_id: "test-001",
      checks: [
        {
          check_id: "wage_1",
          check_type: "wage_check",
          employee_name: "John",
          status: "pass",
          message: "Wage ok",
        },
      ],
      overall_status: "pass",
      violation_count: 0,
      warning_count: 0,
    };
    const parsed = DeterministicReportSchema.safeParse(data);
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid check_type", () => {
    const data = {
      job_id: "test-001",
      checks: [
        {
          check_id: "wage_1",
          check_type: "invalid_check",
          employee_name: "John",
          status: "pass",
          message: "Wage ok",
        },
      ],
      overall_status: "pass",
      violation_count: 0,
      warning_count: 0,
    };
    const parsed = DeterministicReportSchema.safeParse(data);
    expect(parsed.success).toBe(false);
  });
});
