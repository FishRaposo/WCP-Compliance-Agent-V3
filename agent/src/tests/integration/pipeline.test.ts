import { describe, expect, it } from "vitest";

import { runWCPPipeline } from "../../mastra/workflows/wcp-pipeline.js";
import { isMockMode } from "../../config.js";
import { TrustScoredDecisionSchema } from "../../types/index.js";

describe("WCP Pipeline Integration", () => {
  it("runs full pipeline and returns valid TrustScoredDecision", async () => {
    const text = `
      Contractor: Test Contractor
      Project: Test Project
      Location: Washington, DC
      Certified: 2026-04-18

      Name: John Doe
      Trade: Electrician
      Hours: 40
      Hourly Wage: 51.69
      Fringe: 1385.20
      Gross: 2067.60
      Deductions: 200.00
      Net: 1867.60
    `;

    const decision = await runWCPPipeline(text);

    // Schema validation
    const parsed = TrustScoredDecisionSchema.safeParse(decision);
    expect(parsed.success).toBe(true);

    // Core assertions
    expect(decision.job_id).toBeTruthy();
    expect(["approved", "rejected", "requires_review"]).toContain(decision.verdict);
    expect(decision.trust_score).toBeGreaterThanOrEqual(0);
    expect(decision.trust_score).toBeLessThanOrEqual(1);
    expect([
      "auto_approve",
      "flag_for_review",
      "require_human_review",
    ]).toContain(decision.trust_band);
    expect(typeof decision.requires_human_review).toBe("boolean");
    expect(decision.reasoning_summary).toBeTruthy();
    expect(Array.isArray(decision.citations)).toBe(true);
    expect(decision.latency_ms).toBeGreaterThan(0);
  });

  it("mock mode produces deterministic verdict for passing payroll", async () => {
    if (!isMockMode) {
      return; // Skip in real mode — LLM output is non-deterministic
    }

    const text = `
      Contractor: ABC Construction
      Project: Federal Building
      Location: Washington, DC
      Certified: 2026-04-18

      Name: Jane Smith
      Trade: Plumber
      Hours: 40
      Hourly Wage: 48.50
      Fringe: 1290.00
      Gross: 1940.00
      Deductions: 150.00
      Net: 1790.00
    `;

    const decision = await runWCPPipeline(text);
    expect(decision.verdict).toBe("approved");
    expect(decision.trust_band).toBe("auto_approve");
    expect(decision.requires_human_review).toBe(false);
  });

  it("mock mode flags violations for underpaid wage", async () => {
    if (!isMockMode) {
      return;
    }

    const text = `
      Contractor: LowPay Inc
      Project: Cheap Building
      Location: Washington, DC
      Certified: 2026-04-18

      Name: Bob Worker
      Trade: Laborer
      Hours: 40
      Hourly Wage: 5.00
      Fringe: 0.00
      Gross: 200.00
      Deductions: 0.00
      Net: 200.00
    `;

    const decision = await runWCPPipeline(text);
    expect(decision.verdict).toBe("rejected");
    expect(decision.violation_count).toBeGreaterThan(0);
  });
});
