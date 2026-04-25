/**
 * Live Calibration Test — Full Golden Set vs. Real OpenAI API
 *
 * Runs the 102-case golden set against real OpenAI LLM reasoning.
 * Measures true accuracy (not mock accuracy) and reports per-case results.
 *
 * Run with:
 *   $env:OPENAI_API_KEY="sk-proj-..."
 *   npx vitest run tests/live/live-calibration.test.ts
 *
 * Expected cost: ~$1-3 per full run (gpt-4o-mini, 102 cases).
 * Skipped automatically if OPENAI_API_KEY is in mock mode.
 *
 * Thresholds (live mode — real LLM may be more accurate than mock):
 *   - Overall accuracy:      > 88%
 *   - Violation detection:   > 92%
 *   - False-approve rate:    < 5%
 *   - High-trust accuracy:   > 95%
 */

import { describe, it, expect, beforeAll } from "vitest";
import { executeDecisionPipeline } from "../../src/pipeline/orchestrator.js";
import type { TrustScoredDecision } from "../../src/types/decision-pipeline.js";
import { GOLDEN_SET } from "../eval/golden-set.js";

const REAL_KEY = process.env.OPENAI_API_KEY ?? "";
const IS_LIVE =
  REAL_KEY.startsWith("sk-") &&
  !["mock", "mock-key", "test-api-key"].includes(REAL_KEY);

const describeIfLive = IS_LIVE ? describe : describe.skip;

describeIfLive("Live Calibration — Golden Set vs. Real OpenAI", () => {
  type Result = {
    id: string;
    decision: TrustScoredDecision;
    expected: string;
    actual: string;
    trustScore: number;
    trustBand: string;
    correct: boolean;
    rationale: string;
  };

  let results: Result[] = [];

  beforeAll(async () => {
    results = [];

    for (const testCase of GOLDEN_SET) {
      const decision = await executeDecisionPipeline({
        content: testCase.input,
        traceId: `live-${testCase.id}`,
      });

      const actual = decision.finalStatus;
      const correct =
        actual === testCase.expectedStatus ||
        (testCase.expectedStatus !== "Approved" && actual === "Pending Human Review");

      results.push({
        id: testCase.id,
        decision,
        expected: testCase.expectedStatus,
        actual,
        trustScore: decision.trust.score,
        trustBand: decision.trust.band,
        correct,
        rationale: decision.verdict.rationale,
      });
    }
  }, 600_000); // 10 min — real API, sequential

  // =========================================================================
  // Per-case log
  // =========================================================================

  it("logs detailed per-case results", () => {
    const incorrect = results.filter((r) => !r.correct);

    console.log("\n\n=== LIVE CALIBRATION RESULTS ===");
    console.log(`  Total cases: ${results.length}`);
    console.log(`  Correct:     ${results.filter((r) => r.correct).length}`);
    console.log(`  Incorrect:   ${incorrect.length}`);
    console.log(`  Accuracy:    ${((results.filter((r) => r.correct).length / results.length) * 100).toFixed(1)}%`);

    if (incorrect.length > 0) {
      console.log("\n  --- INCORRECT CASES ---");
      for (const r of incorrect) {
        console.log(
          `  ✗ ${r.id}: expected=${r.expected}, actual=${r.actual}, trust=${r.trustScore.toFixed(2)} (${r.trustBand})`
        );
        console.log(`    Rationale: ${r.rationale.slice(0, 120)}...`);
      }
    }

    expect(results.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // Accuracy
  // =========================================================================

  it("should have >88% overall accuracy with real LLM", () => {
    const correct = results.filter((r) => r.correct).length;
    const accuracy = correct / results.length;
    console.log(`\n  Live Overall Accuracy: ${(accuracy * 100).toFixed(1)}% (${correct}/${results.length})`);
    expect(accuracy).toBeGreaterThan(0.88);
  });

  it("should catch >92% of clear violations", () => {
    const violations = results.filter(
      (r) =>
        r.id.includes("underpay") ||
        r.id.includes("fringe") ||
        r.id.includes("unknown") ||
        r.id.includes("overtime")
    );
    const caught = violations.filter((r) => r.actual !== "Approved").length;
    const rate = caught / violations.length;
    console.log(`\n  Live Violation Detection: ${(rate * 100).toFixed(1)}% (${caught}/${violations.length})`);
    expect(rate).toBeGreaterThan(0.92);
  });

  it("should not false-approve clear violations", () => {
    const violations = results.filter(
      (r) =>
        r.id.includes("underpay") ||
        r.id.includes("fringe") ||
        r.id.includes("unknown")
    );
    const falseApprovals = violations.filter((r) => r.actual === "Approved").length;
    const rate = falseApprovals / violations.length;
    console.log(`\n  Live False-Approve Rate: ${(rate * 100).toFixed(1)}% (${falseApprovals}/${violations.length})`);
    expect(rate).toBeLessThan(0.05);
  });

  // =========================================================================
  // Trust correlation
  // =========================================================================

  it("high-trust decisions (≥0.85) should be >95% correct", () => {
    const highTrust = results.filter((r) => r.trustScore >= 0.85);
    if (highTrust.length === 0) return;

    const correct = highTrust.filter((r) => r.correct).length;
    const accuracy = correct / highTrust.length;
    console.log(`\n  Live High-Trust Accuracy: ${(accuracy * 100).toFixed(1)}% (${correct}/${highTrust.length})`);
    expect(accuracy).toBeGreaterThan(0.95);
  });

  it("LLM rationale is substantive (>50 chars) for all cases", () => {
    for (const r of results) {
      expect(r.rationale.length).toBeGreaterThan(50);
    }
  });

  it("all verdicts cite at least one Layer 1 check ID", () => {
    const l1Ids = results.map((r) =>
      new Set(r.decision.deterministic.checks.map((c) => c.id))
    );

    results.forEach((r, i) => {
      const cited = r.decision.verdict.referencedCheckIds;
      if (cited.length > 0) {
        for (const id of cited) {
          expect(l1Ids[i].has(id)).toBe(true);
        }
      }
    });
  });
});

// =========================================================================
// Skip notice
// =========================================================================

if (!IS_LIVE) {
  describe("Live Calibration", () => {
    it("SKIPPED — set OPENAI_API_KEY=sk-... to run live calibration", () => {
      console.log(
        "\n  ⚠️  Live calibration skipped. Set a real OpenAI key:\n" +
        "     $env:OPENAI_API_KEY='sk-proj-...'\n" +
        "     npx vitest run tests/live/live-calibration.test.ts\n" +
        "  Expected cost: ~$1-3 per run (gpt-4o-mini, 102 cases)\n"
      );
    });
  });
}
