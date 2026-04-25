/**
 * Live API Smoke Tests
 *
 * Verifies the full three-layer pipeline works with a real OpenAI API key.
 * Requires OPENAI_API_KEY to be a real sk-... key (not mock/test-api-key).
 *
 * Run with:
 *   $env:OPENAI_API_KEY="sk-proj-..."
 *   npx vitest run tests/live/smoke.test.ts
 *
 * These tests are intentionally excluded from `npx vitest run` (mock suite).
 * They are skipped automatically if OPENAI_API_KEY is in mock mode.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { executeDecisionPipeline } from "../../src/pipeline/orchestrator.js";
import type { TrustScoredDecision } from "../../src/types/decision-pipeline.js";

const REAL_KEY = process.env.OPENAI_API_KEY ?? "";
const IS_LIVE =
  REAL_KEY.startsWith("sk-") &&
  !["mock", "mock-key", "test-api-key"].includes(REAL_KEY);

const describeIfLive = IS_LIVE ? describe : describe.skip;

describeIfLive("Live API Smoke Tests (real OpenAI key)", () => {
  // =========================================================================
  // Helper
  // =========================================================================

  async function run(input: string): Promise<TrustScoredDecision> {
    return executeDecisionPipeline({ content: input });
  }

  function assertDecisionShape(d: TrustScoredDecision) {
    expect(d.traceId).toBeTruthy();
    expect(["Approved", "Revise", "Reject", "Pending Human Review"]).toContain(d.finalStatus);
    expect(d.trust.score).toBeGreaterThanOrEqual(0);
    expect(d.trust.score).toBeLessThanOrEqual(1);
    expect(["auto", "flag_for_review", "require_human"]).toContain(d.trust.band);
    expect(d.verdict.rationale).toBeTruthy();
    expect(d.verdict.rationale.length).toBeGreaterThan(10);
    expect(d.auditTrail.length).toBeGreaterThan(0);
  }

  // =========================================================================
  // Smoke Case 1: Clean compliant Electrician
  // =========================================================================

  it("approves a clean compliant Electrician payroll", async () => {
    const d = await run("Role: Electrician, Hours: 40, Wage: 51.69, Fringe: 34.63");

    assertDecisionShape(d);
    // In live mode the LLM may return Revise for a missing-signature warning
    // (signature_check is warning-severity). Accept Approved or Revise — not Reject/PHR.
    expect(["Approved", "Revise"]).toContain(d.finalStatus);
    expect(d.trust.score).toBeGreaterThan(0.70);
    expect(d.deterministic.classificationMethod).toBe("exact");
  }, 30_000);

  // =========================================================================
  // Smoke Case 2: Clear wage underpayment
  // =========================================================================

  it("flags clear wage underpayment as Revise or Reject", async () => {
    const d = await run("Role: Electrician, Hours: 40, Wage: 30.00, Fringe: 34.63");

    assertDecisionShape(d);
    expect(["Revise", "Reject", "Pending Human Review"]).toContain(d.finalStatus);

    const underpayCheck = d.deterministic.checks.find(
      (c) => c.type === "wage" && !c.passed
    );
    expect(underpayCheck).toBeDefined();
  }, 30_000);

  // =========================================================================
  // Smoke Case 3: Unknown classification
  // =========================================================================

  it("routes unknown classification to human review", async () => {
    const d = await run("Role: Xenon Installer, Hours: 40, Wage: 45.00");

    assertDecisionShape(d);
    expect(d.deterministic.classificationMethod).toBe("unknown");
    expect(["Pending Human Review", "Reject"]).toContain(d.finalStatus);
  }, 30_000);

  // =========================================================================
  // Smoke Case 4: Overtime with correct gross pay (should approve)
  // =========================================================================

  it("approves correctly-paid overtime", async () => {
    // Electrician: 40 reg + 10 OT at 1.5x
    // correctGross = 40*51.69 + 10*51.69*1.5 = 2067.60 + 775.35 = 2842.95
    const d = await run(
      "Role: Electrician, Hours: 50, Wage: 51.69, Fringe: 34.63, Gross Pay: 2842.95"
    );

    assertDecisionShape(d);
    // In live mode the LLM may return Revise for missing-signature warning even on OT cases
    expect(["Approved", "Revise"]).toContain(d.finalStatus);
    // Must not be flagged as a wage violation
    const otViolation = d.deterministic.checks.find(
      (c) => c.type === "overtime" && !c.passed
    );
    expect(otViolation).toBeUndefined();
  }, 30_000);

  // =========================================================================
  // Smoke Case 5: Verdict cites real check IDs
  // =========================================================================

  it("LLM verdict cites at least one check ID from Layer 1", async () => {
    const d = await run("Role: Laborer, Hours: 40, Wage: 26.45, Fringe: 12.50");

    assertDecisionShape(d);
    expect(d.verdict.referencedCheckIds.length).toBeGreaterThan(0);

    const checkIds = d.deterministic.checks.map((c) => c.id);
    for (const cited of d.verdict.referencedCheckIds) {
      expect(checkIds).toContain(cited);
    }
  }, 30_000);

  // =========================================================================
  // Smoke Case 6: Audit trail has all three layers
  // =========================================================================

  it("audit trail records events from all three layers", async () => {
    const d = await run("Role: Plumber, Hours: 40, Wage: 48.20, Fringe: 28.10");

    assertDecisionShape(d);
    const stages = d.auditTrail.map((e) => e.stage);
    expect(stages).toContain("layer1");
    expect(stages).toContain("layer2");
    expect(stages).toContain("layer3");
  }, 30_000);
});

// =========================================================================
// Informational message when skipped
// =========================================================================

if (!IS_LIVE) {
  describe("Live API Smoke Tests", () => {
    it("SKIPPED — set OPENAI_API_KEY=sk-... to run live tests", () => {
      console.log(
        "\n  ⚠️  Live smoke tests skipped. Set a real OpenAI key:\n" +
        "     $env:OPENAI_API_KEY='sk-proj-...'\n" +
        "     npx vitest run tests/live/smoke.test.ts\n"
      );
    });
  });
}
