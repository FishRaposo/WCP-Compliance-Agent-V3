import { describe, expect, it } from "vitest";

import {
  computeTrustComponents,
  computeTrustScore,
  determineTrustBand,
  safeVerdict,
} from "../../mastra/agents/trust-score.js";
import type { DeterministicReport, LLMVerdict } from "../../types/index.js";

describe("Trust score computation", () => {
  const makeDeterministic = (
    overall_status: "pass" | "fail" | "warnings",
    violation_count: number,
    warning_count: number,
    checksCount: number
  ): DeterministicReport => ({
    job_id: "test-001",
    checks: Array.from({ length: checksCount }, (_, i) => ({
      check_id: `check-${i}`,
      check_type: "wage_check",
      employee_name: "Test",
      status: i < violation_count ? "fail" : "pass",
      expected_value: null,
      actual_value: null,
      variance: null,
      regulation_cite: "",
      message: "",
    })),
    overall_status,
    violation_count,
    warning_count,
    dbwd_rates_used: [],
  });

  const makeLLM = (
    verdict: "approved" | "rejected" | "requires_review",
    confidence: number
  ): LLMVerdict => ({
    job_id: "test-001",
    verdict,
    reasoning: "test",
    citations: [],
    confidence,
    rag_context_used: false,
    model: "gpt-4o-mini",
    prompt_version: "v2",
    langfuse_trace_id: "",
    token_usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  });

  it("perfect deterministic + approved LLM = high trust score", () => {
    const det = makeDeterministic("pass", 0, 0, 5);
    const llm = makeLLM("approved", 0.95);
    const comp = computeTrustComponents(det, llm);
    const score = computeTrustScore(comp);

    expect(score).toBeGreaterThan(0.85);
    expect(determineTrustBand(score)).toBe("auto_approve");
  });

  it("violations + approved LLM = low agreement, lower trust", () => {
    const det = makeDeterministic("fail", 2, 0, 5);
    const llm = makeLLM("approved", 0.9);
    const comp = computeTrustComponents(det, llm);
    const score = computeTrustScore(comp);

    expect(comp.agreement).toBe(0.0);
    expect(score).toBeLessThan(0.8);
  });

  it("violations force rejected verdict regardless of LLM approval", () => {
    const det = makeDeterministic("fail", 1, 0, 5);
    const llm = makeLLM("approved", 0.9);
    expect(safeVerdict(det, llm)).toBe("rejected");
  });

  it("no violations + approved LLM = approved verdict", () => {
    const det = makeDeterministic("pass", 0, 0, 5);
    const llm = makeLLM("approved", 0.9);
    expect(safeVerdict(det, llm)).toBe("approved");
  });

  it("trust band boundaries", () => {
    expect(determineTrustBand(0.9)).toBe("auto_approve");
    expect(determineTrustBand(0.85)).toBe("auto_approve");
    expect(determineTrustBand(0.84)).toBe("flag_for_review");
    expect(determineTrustBand(0.6)).toBe("flag_for_review");
    expect(determineTrustBand(0.59)).toBe("require_human_review");
    expect(determineTrustBand(0.0)).toBe("require_human_review");
  });
});
