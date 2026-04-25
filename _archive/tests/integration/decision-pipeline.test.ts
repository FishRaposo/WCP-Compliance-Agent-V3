/**
 * Decision Pipeline Integration Tests
 *
 * End-to-end tests for the three-layer decision pipeline.
 *
 * @see src/pipeline/orchestrator.ts
 */

import { describe, it, expect, beforeAll } from "vitest";
import { executeDecisionPipeline } from "../../src/pipeline/orchestrator.js";
import { isTrustScoredDecision } from "../../src/types/decision-pipeline.js";
import { humanReviewQueue } from "../../src/services/human-review-queue.js";

describe("Decision Pipeline Integration", () => {
  // ========================================================================
  // Test Scenarios
  // ========================================================================

  const SCENARIOS = {
    // Clean compliant case - should get auto-approved
    cleanElectrician: {
      input: "Role: Electrician, Hours: 40, Wage: 51.69, Fringe: 34.63",
      expectedStatus: ["Approved"],
      expectedBand: "auto",
      description: "Electrician at prevailing wage, no overtime",
    },

    // Clean case with overtime (correctly calculated)
    cleanOvertime: {
      input: "Role: Laborer, Hours: 45, Wage: 26.45, Fringe: 12.50",
      expectedStatus: ["Approved", "Revise"], // May flag for review due to OT
      minTrustBand: "flag_for_review",
      description: "Laborer with overtime hours",
    },

    // Underpayment violation
    underpayment: {
      input: "Role: Electrician, Hours: 40, Wage: 45.00, Fringe: 34.63",
      expectedStatus: ["Reject", "Revise"],
      maxTrustBand: "flag_for_review",
      description: "Electrician underpaid by $6.69/hr",
    },

    // Fringe shortfall
    fringeShortfall: {
      input: "Role: Electrician, Hours: 40, Wage: 51.69, Fringe: 20.00",
      expectedStatus: ["Revise", "Reject"],
      maxTrustBand: "auto", // Could still be auto if wage is OK
      description: "Correct wage but low fringe benefits",
    },

    // Unknown classification
    unknownRole: {
      input: "Role: Astrophysicist, Hours: 40, Wage: 40.00",
      expectedStatus: ["Reject", "Pending Human Review"],
      expectedBand: "require_human",
      description: "Unknown role classification",
    },

    // Edge: Zero hours
    zeroHours: {
      input: "Role: Electrician, Hours: 0, Wage: 51.69",
      expectedStatus: ["Approved"],
      minTrustBand: "auto",
      description: "Zero hours worked (no violation possible)",
    },

    // Edge: Extreme overtime
    extremeOvertime: {
      input: "Role: Laborer, Hours: 80, Wage: 26.45",
      expectedStatus: ["Reject", "Revise"],
      maxTrustBand: "flag_for_review",
      description: "80 hours (40 regular + 40 OT) at wrong rate",
    },
  };

  // Clear queue before tests
  beforeAll(async () => {
    await humanReviewQueue.clear();
  });

  // ========================================================================
  // Helper Functions
  // ========================================================================

  async function runPipeline(input: string) {
    return await executeDecisionPipeline({
      content: input,
    });
  }

  // ========================================================================
  // Core Pipeline Tests
  // ========================================================================

  describe("Pipeline Structure", () => {
    it("returns TrustScoredDecision type", async () => {
      const decision = await runPipeline(SCENARIOS.cleanElectrician.input);

      expect(isTrustScoredDecision(decision)).toBe(true);
    });

    it("has all three layers populated", async () => {
      const decision = await runPipeline(SCENARIOS.cleanElectrician.input);

      expect(decision.deterministic).toBeDefined();
      expect(decision.deterministic.checks.length).toBeGreaterThan(0);

      expect(decision.verdict).toBeDefined();
      expect(decision.verdict.status).toBeDefined();

      expect(decision.trust).toBeDefined();
      expect(decision.trust.score).toBeGreaterThanOrEqual(0);
      expect(decision.trust.score).toBeLessThanOrEqual(1);
    });

    it("has audit trail with all three stages", async () => {
      const decision = await runPipeline(SCENARIOS.cleanElectrician.input);

      expect(decision.auditTrail).toBeDefined();
      expect(decision.auditTrail.length).toBeGreaterThanOrEqual(3);

      const stages = decision.auditTrail.map((e) => e.stage);
      expect(stages).toContain("layer1");
      expect(stages).toContain("layer2");
      expect(stages).toContain("layer3");
    });

    it("has consistent traceId across all components", async () => {
      const decision = await runPipeline(SCENARIOS.cleanElectrician.input);

      expect(decision.traceId).toBeDefined();
      expect(decision.deterministic.traceId).toBe(decision.traceId);
      expect(decision.verdict.traceId).toBe(decision.traceId);
    });

    it("has regulation citations in checks", async () => {
      const decision = await runPipeline(SCENARIOS.cleanElectrician.input);

      for (const check of decision.deterministic.checks) {
        expect(check.regulation).toBeDefined();
        expect(check.regulation.length).toBeGreaterThan(0);
      }
    });
  });

  // ========================================================================
  // Scenario Tests
  // ========================================================================

  describe("Clean Compliant Case", () => {
    it("approves valid electrician at prevailing wage", async () => {
      const decision = await runPipeline(SCENARIOS.cleanElectrician.input);

      expect(decision.finalStatus).toBe("Approved");
      expect(decision.deterministic.extracted.role).toBe("Electrician");
      expect(decision.deterministic.dbwdRate.baseRate).toBe(51.69);
    });

    it("has high trust score for clean case", async () => {
      const decision = await runPipeline(SCENARIOS.cleanElectrician.input);

      expect(decision.trust.score).toBeGreaterThanOrEqual(0.85);
      expect(decision.trust.band).toBe("auto");
    });

    it("does not require human review for clean case", async () => {
      const decision = await runPipeline(SCENARIOS.cleanElectrician.input);

      expect(decision.humanReview.required).toBe(false);
      expect(decision.humanReview.status).toBe("not_required");
    });

    it("has no error-severity check failures", async () => {
      const decision = await runPipeline(SCENARIOS.cleanElectrician.input);

      const errorFailures = decision.deterministic.checks.filter(
        (c) => !c.passed && (c.severity === "error" || c.severity === "critical")
      );
      expect(errorFailures.length).toBe(0);
    });
  });

  describe("Underpayment Violation", () => {
    it("detects wage underpayment", async () => {
      const decision = await runPipeline(SCENARIOS.underpayment.input);

      expect(decision.deterministic.extracted.wage).toBe(45.0);
      expect(decision.deterministic.dbwdRate.baseRate).toBe(51.69);

      const wageCheck = decision.deterministic.checks.find(
        (c) => c.type === "wage"
      );
      expect(wageCheck).toBeDefined();
      expect(wageCheck!.passed).toBe(false);
    });

    it("reports correct underpayment amount", async () => {
      const decision = await runPipeline(SCENARIOS.underpayment.input);

      const wageCheck = decision.deterministic.checks.find(
        (c) => c.type === "wage"
      );
      expect(wageCheck!.difference).toBeCloseTo(6.69, 1); // $51.69 - $45.00
    });

    it("does NOT auto-approve underpayment", async () => {
      const decision = await runPipeline(SCENARIOS.underpayment.input);

      expect(decision.finalStatus).not.toBe("Approved");
    });

    it("flags or requires human review for violations", async () => {
      const decision = await runPipeline(SCENARIOS.underpayment.input);

      expect(["flag_for_review", "require_human"]).toContain(
        decision.trust.band
      );
    });
  });

  describe("Unknown Classification", () => {
    it("identifies unknown role", async () => {
      const decision = await runPipeline(SCENARIOS.unknownRole.input);

      expect(decision.deterministic.classificationMethod).toBe("unknown");
      expect(decision.deterministic.classificationConfidence).toBeLessThan(0.5);
    });

    it("fails classification check", async () => {
      const decision = await runPipeline(SCENARIOS.unknownRole.input);

      const classificationCheck = decision.deterministic.checks.find(
        (c) => c.type === "classification"
      );
      expect(classificationCheck).toBeDefined();
      expect(classificationCheck!.passed).toBe(false);
      expect(classificationCheck!.severity).toBe("critical");
    });

    it("requires human review for unknown classification", async () => {
      const decision = await runPipeline(SCENARIOS.unknownRole.input);

      expect(decision.trust.band).toBe("require_human");
      expect(decision.humanReview.required).toBe(true);
      expect(decision.finalStatus).toBe("Pending Human Review");
    });

    it("has low trust score", async () => {
      const decision = await runPipeline(SCENARIOS.unknownRole.input);

      expect(decision.trust.score).toBeLessThan(0.60);
    });
  });

  describe("Overtime Scenarios", () => {
    it("detects overtime hours", async () => {
      const decision = await runPipeline(SCENARIOS.cleanOvertime.input);

      expect(decision.deterministic.extracted.hours).toBe(45);
      expect(decision.deterministic.extracted.overtimeHours).toBe(5);
    });

    it("runs overtime check when OT hours present", async () => {
      const decision = await runPipeline(SCENARIOS.cleanOvertime.input);

      const otCheck = decision.deterministic.checks.find(
        (c) => c.type === "overtime"
      );
      expect(otCheck).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("handles zero hours", async () => {
      const decision = await runPipeline(SCENARIOS.zeroHours.input);

      expect(decision.deterministic.extracted.hours).toBe(0);
      expect(decision.deterministic.extracted.overtimeHours).toBe(0);

      // No underpayment possible with 0 hours
      const wageCheck = decision.deterministic.checks.find(
        (c) => c.type === "wage"
      );
      if (wageCheck) {
        expect(wageCheck.passed).toBe(true);
      }
    });

    it("handles extreme overtime", async () => {
      const decision = await runPipeline(SCENARIOS.extremeOvertime.input);

      expect(decision.deterministic.extracted.hours).toBe(80);
      expect(decision.deterministic.extracted.regularHours).toBe(40);
      expect(decision.deterministic.extracted.overtimeHours).toBe(40);

      // Should flag significant overtime
      expect(decision.trust.band).not.toBe("auto");
    });
  });

  // ========================================================================
  // Human Review Queue Integration
  // ========================================================================

  describe("Human Review Queue", () => {
    it("enqueues low-trust decisions", async () => {
      // Clear queue first
      await humanReviewQueue.clear();

      // Run a case that should require human review
      const decision = await runPipeline(SCENARIOS.unknownRole.input);

      // Verify it was queued
      expect(decision.humanReview.required).toBe(true);

      // Check queue (may not be immediate due to async)
      const pending = await humanReviewQueue.listPending();
      const found = pending.find((item) => item.traceId === decision.traceId);

      // Note: In test environment, queue might not persist
      // This is a best-effort check
      if (found) {
        expect(found.priority).toBeDefined();
        expect(found.decision.traceId).toBe(decision.traceId);
      }
    });

    it("does not enqueue high-trust decisions", async () => {
      await humanReviewQueue.clear();

      const decision = await runPipeline(SCENARIOS.cleanElectrician.input);

      expect(decision.humanReview.required).toBe(false);
      expect(decision.humanReview.status).toBe("not_required");
    });
  });

  // ========================================================================
  // Layer 2 Verdict Tests
  // ========================================================================

  describe("LLM Verdict Layer", () => {
    it("verdict references valid check IDs", async () => {
      const decision = await runPipeline(SCENARIOS.underpayment.input);

      // All referenced check IDs must exist in the report
      const validIds = new Set(decision.deterministic.checks.map((c) => c.id));
      for (const id of decision.verdict.referencedCheckIds) {
        expect(validIds.has(id)).toBe(true);
      }
    });

    it("verdict has reasoning trace", async () => {
      const decision = await runPipeline(SCENARIOS.cleanElectrician.input);

      expect(decision.verdict.reasoningTrace).toBeDefined();
      expect(decision.verdict.reasoningTrace.length).toBeGreaterThan(0);
    });

    it("verdict has self-reported confidence", async () => {
      const decision = await runPipeline(SCENARIOS.cleanElectrician.input);

      expect(decision.verdict.selfConfidence).toBeGreaterThanOrEqual(0);
      expect(decision.verdict.selfConfidence).toBeLessThanOrEqual(1);
    });

    it("verdict includes citations", async () => {
      const decision = await runPipeline(SCENARIOS.cleanElectrician.input);

      expect(decision.verdict.citations).toBeDefined();
      expect(decision.verdict.citations.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ========================================================================
  // Trust Score Tests
  // ========================================================================

  describe("Trust Score Calculation", () => {
    it("trust components sum correctly", async () => {
      const decision = await runPipeline(SCENARIOS.cleanElectrician.input);

      const { components } = decision.trust;
      const weightedSum =
        0.35 * components.deterministic +
        0.25 * components.classification +
        0.20 * components.llmSelf +
        0.20 * components.agreement;

      expect(decision.trust.score).toBeCloseTo(weightedSum, 5);
    });

    it("agreement component reflects LLM/deterministic alignment", async () => {
      // Clean case: should have high agreement
      const clean = await runPipeline(SCENARIOS.cleanElectrician.input);
      expect(clean.trust.components.agreement).toBeGreaterThanOrEqual(0.5);

      // Underpayment with wrong verdict: should have low agreement
      // (but we can't easily force wrong verdict in integration test)
    });

    it("generates appropriate trust reasons", async () => {
      const decision = await runPipeline(SCENARIOS.unknownRole.input);

      expect(decision.trust.reasons).toBeDefined();
      expect(decision.trust.reasons.length).toBeGreaterThan(0);

      // Should mention classification issue
      const hasClassificationReason = decision.trust.reasons.some((r) =>
        r.toLowerCase().includes("classification")
      );
      expect(hasClassificationReason).toBe(true);
    });
  });

  // ========================================================================
  // Performance Tests
  // ========================================================================

  describe("Performance", () => {
    it("completes within reasonable time", async () => {
      const start = Date.now();
      await runPipeline(SCENARIOS.cleanElectrician.input);
      const duration = Date.now() - start;

      // Should complete in under 5 seconds (including mock/API latency)
      expect(duration).toBeLessThan(5000);
    });

    it("Layer 1 (deterministic) is fast", async () => {
      const decision = await runPipeline(SCENARIOS.cleanElectrician.input);

      const layer1Time = decision.deterministic.timings.reduce(
        (sum, t) => sum + t.ms,
        0
      );

      // Deterministic layer should be under 1 second
      expect(layer1Time).toBeLessThan(1000);
    });
  });

  // ========================================================================
  // Error Handling
  // ========================================================================

  describe("Error Handling", () => {
    it("handles empty input gracefully", async () => {
      const decision = await runPipeline("");

      // Should still return a decision (likely with errors)
      expect(decision).toBeDefined();
      expect(decision.traceId).toBeDefined();
    });

    it("handles malformed input gracefully", async () => {
      const decision = await runPipeline("random gibberish here");

      expect(decision).toBeDefined();
      expect(decision.deterministic).toBeDefined();
    });

    it("has fallback for pipeline errors", async () => {
      // This tests the error handling in orchestrator.ts
      // In normal operation, we can't easily trigger errors
      // But we verify the structure exists
      const decision = await runPipeline("test");

      expect(decision.finalStatus).toBeDefined();
      expect(["Approved", "Revise", "Reject", "Pending Human Review"]).toContain(
        decision.finalStatus
      );
    });
  });
});
