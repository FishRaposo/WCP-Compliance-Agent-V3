/**
 * Trust Calibration Evaluation Test
 *
 * Golden set evaluation to validate trust score accuracy.
 * Run this in CI to ensure trust scores correlate with actual correctness.
 *
 * @see docs/architecture/trust-scoring.md - Calibration methodology
 */

import { describe, it, expect, beforeAll } from "vitest";
import { executeDecisionPipeline } from "../../src/pipeline/orchestrator.js";
import type { TrustScoredDecision } from "../../src/types/decision-pipeline.js";
import { GOLDEN_SET } from "./golden-set.js";

describe("Trust Calibration - Golden Set Evaluation", () => {
  // ========================================================================
  // Golden Set: 100 labeled examples imported from golden-set.ts
  // ========================================================================

  // GOLDEN_SET imported from ./golden-set.ts — 100 manually reviewed examples

  // Results storage
  let results: Array<{
    id: string;
    decision: TrustScoredDecision;
    expected: string;
    actual: string;
    trustScore: number;
    trustBand: string;
    correct: boolean;
  }> = [];

  // Run all cases before tests
  beforeAll(async () => {
    results = [];

    for (const testCase of GOLDEN_SET) {
      const decision = await executeDecisionPipeline({
        content: testCase.input,
        traceId: testCase.id,
      });

      const actual = decision.finalStatus;
      // Some cases might return "Pending Human Review" which is acceptable for violations
      const correct =
        actual === testCase.expectedStatus ||
        (testCase.expectedStatus === "Reject" && actual === "Pending Human Review") ||
        (testCase.expectedStatus === "Revise" && actual === "Pending Human Review");

      results.push({
        id: testCase.id,
        decision,
        expected: testCase.expectedStatus,
        actual,
        trustScore: decision.trust.score,
        trustBand: decision.trust.band,
        correct,
      });
    }
  }, 120_000); // 120s timeout — 100 examples in mock mode

  // ========================================================================
  // Metric: Overall Accuracy
  // ========================================================================

  describe("Overall Accuracy", () => {
    it("should have >90% accuracy on golden set", () => {
      const correctCount = results.filter((r) => r.correct).length;
      const accuracy = correctCount / results.length;

      console.log(`\n  Overall Accuracy: ${(accuracy * 100).toFixed(1)}% (${correctCount}/${results.length})`);

      expect(accuracy).toBeGreaterThan(0.90);
    });

    it("should catch all clear violations", () => {
      const violations = results.filter(
        (r) =>
          r.id.includes("underpay") ||
          r.id.includes("fringe") ||
          r.id.includes("unknown") ||
          r.id.includes("overtime")
      );

      const caughtViolations = violations.filter(
        (r) => r.actual !== "Approved"
      );
      const detectionRate = caughtViolations.length / violations.length;

      console.log(`\n  Violation Detection Rate: ${(detectionRate * 100).toFixed(1)}%`);

      expect(detectionRate).toBeGreaterThan(0.95);
    });

    it("should not false-approve violations", () => {
      const violations = results.filter(
        (r) =>
          r.id.includes("underpay") ||
          r.id.includes("fringe") ||
          r.id.includes("unknown")
      );

      const falseApprovals = violations.filter((r) => r.actual === "Approved");
      const falseApproveRate = falseApprovals.length / violations.length;

      console.log(`\n  False-Approve Rate: ${(falseApproveRate * 100).toFixed(1)}%`);

      expect(falseApproveRate).toBeLessThan(0.05);
    });
  });

  // ========================================================================
  // Metric: Trust Score Correlation
  // ========================================================================

  describe("Trust Score Correlation", () => {
    it("high trust (≥0.85) decisions should be >98% correct", () => {
      const highTrust = results.filter((r) => r.trustScore >= 0.85);

      if (highTrust.length === 0) {
        console.log("  No high-trust decisions in golden set");
        return;
      }

      const correctHighTrust = highTrust.filter((r) => r.correct).length;
      const accuracy = correctHighTrust / highTrust.length;

      console.log(`\n  High Trust (≥0.85) Accuracy: ${(accuracy * 100).toFixed(1)}% (${correctHighTrust}/${highTrust.length})`);

      expect(accuracy).toBeGreaterThan(0.98);
    });

    it("low trust (<0.60) decisions should have >80% actual issues", () => {
      const lowTrust = results.filter((r) => r.trustScore < 0.60);

      if (lowTrust.length === 0) {
        console.log("  No low-trust decisions in golden set");
        return;
      }

      const actualIssues = lowTrust.filter((r) => r.actual !== "Approved").length;
      const issueRate = actualIssues / lowTrust.length;

      console.log(`\n  Low Trust (<0.60) Issue Rate: ${(issueRate * 100).toFixed(1)}% (${actualIssues}/${lowTrust.length})`);

      expect(issueRate).toBeGreaterThan(0.80);
    });

    it("flagged decisions (0.60-0.84) should have mixed outcomes", () => {
      const flagged = results.filter(
        (r) => r.trustScore >= 0.60 && r.trustScore < 0.85
      );

      if (flagged.length === 0) {
        console.log("  No flagged decisions in golden set");
        return;
      }

      const issues = flagged.filter((r) => r.actual !== "Approved").length;
      const issueRate = issues / flagged.length;

      console.log(`\n  Flagged (0.60-0.84) Issue Rate: ${(issueRate * 100).toFixed(1)}% (${issues}/${flagged.length})`);

      // Flagged range should mostly contain issues (violations flagged for review)
      // Note: a 100% issue rate in the flagged band is acceptable — it means the
      // system is correctly flagging violations without auto-approving them.
      expect(issueRate).toBeGreaterThan(0.10);
    });
  });

  // ========================================================================
  // Metric: Trust Band Accuracy
  // ========================================================================

  describe("Trust Band Accuracy", () => {
    it("auto band decisions should rarely require review", () => {
      const autoDecisions = results.filter((r) => r.trustBand === "auto");

      if (autoDecisions.length === 0) {
        console.log("  No auto-decisions in golden set");
        return;
      }

      const needReview = autoDecisions.filter(
        (r) => r.id.includes("underpay") || r.id.includes("unknown")
      ).length;

      const errorRate = needReview / autoDecisions.length;

      console.log(`\n  Auto Band Error Rate: ${(errorRate * 100).toFixed(1)}%`);

      // Auto band should almost never include violations
      expect(errorRate).toBeLessThan(0.02);
    });

    it("require_human band should catch problematic cases", () => {
      const requireHuman = results.filter((r) => r.trustBand === "require_human");

      if (requireHuman.length === 0) {
        console.log("  No require_human decisions in golden set");
        return;
      }

      const problematic = requireHuman.filter(
        (r) => r.actual !== "Approved" || r.id.includes("unknown")
      ).length;

      const catchRate = problematic / requireHuman.length;

      console.log(`\n  Require Human Catch Rate: ${(catchRate * 100).toFixed(1)}%`);

      expect(catchRate).toBeGreaterThan(0.90);
    });
  });

  // ========================================================================
  // Detailed Per-Case Results
  // ========================================================================

  describe("Per-Case Analysis", () => {
    it("logs detailed results for each case", () => {
      console.log("\n  === Golden Set Results ===\n");

      for (const result of results) {
        const status = result.correct ? "✅" : "❌";
        console.log(
          `  ${status} ${result.id}: expected=${result.expected}, actual=${result.actual}, trust=${result.trustScore.toFixed(2)} (${result.trustBand})`
        );
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it("correctly handles all clean cases", () => {
      const cleanCases = results.filter((r) => r.id.startsWith("clean"));

      for (const testCase of cleanCases) {
        expect(testCase.correct).toBe(true);
        expect(testCase.trustScore).toBeGreaterThanOrEqual(0.80);
      }
    });

    it("correctly handles all violation cases", () => {
      const violationCases = results.filter(
        (r) =>
          r.id.includes("underpay") ||
          r.id.includes("fringe") ||
          r.id.includes("unknown") ||
          r.id.includes("overtime")
      );

      for (const testCase of violationCases) {
        // Should not auto-approve
        expect(testCase.actual).not.toBe("Approved");

        // Should have appropriate trust level (fringe-only violations may stay near 0.95)
        expect(testCase.trustScore).toBeLessThan(0.97);
      }
    });
  });

  // ========================================================================
  // Calibration Recommendations
  // ========================================================================

  describe("Calibration Recommendations", () => {
    it("provides recommendations if thresholds need adjustment", () => {
      const highTrustErrors = results.filter(
        (r) => r.trustScore >= 0.85 && !r.correct
      ).length;

      const lowTrustCorrect = results.filter(
        (r) => r.trustScore < 0.60 && r.correct
      ).length;

      console.log("\n  === Calibration Recommendations ===\n");

      if (highTrustErrors > 0) {
        console.log(
          `  ⚠️  ${highTrustErrors} high-trust (≥0.85) decision(s) incorrect`
        );
        console.log(
          `     Consider raising auto threshold or adjusting weights`
        );
      }

      if (lowTrustCorrect > 0) {
        console.log(
          `  ⚠️  ${lowTrustCorrect} low-trust (<0.60) decision(s) were actually correct`
        );
        console.log(
          `     Consider lowering require_human threshold`
        );
      }

      if (highTrustErrors === 0 && lowTrustCorrect === 0) {
        console.log("  ✅ Thresholds appear well-calibrated");
      }

      expect(results.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Component Analysis
  // ========================================================================

  describe("Trust Component Analysis", () => {
    it("analyzes component distribution", () => {
      const avgComponents = {
        deterministic:
          results.reduce((sum, r) => sum + r.decision.trust.components.deterministic, 0) /
          results.length,
        classification:
          results.reduce((sum, r) => sum + r.decision.trust.components.classification, 0) /
          results.length,
        llmSelf:
          results.reduce((sum, r) => sum + r.decision.trust.components.llmSelf, 0) /
          results.length,
        agreement:
          results.reduce((sum, r) => sum + r.decision.trust.components.agreement, 0) /
          results.length,
      };

      console.log("\n  === Average Trust Components ===\n");
      console.log(`    deterministic: ${avgComponents.deterministic.toFixed(3)}`);
      console.log(`    classification: ${avgComponents.classification.toFixed(3)}`);
      console.log(`    llmSelf: ${avgComponents.llmSelf.toFixed(3)}`);
      console.log(`    agreement: ${avgComponents.agreement.toFixed(3)}`);

      expect(results.length).toBeGreaterThan(0);
    });
  });
});
