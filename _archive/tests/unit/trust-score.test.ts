/**
 * Trust Score Unit Tests
 *
 * Tests for trust score computation and threshold logic.
 *
 * @see src/pipeline/layer3-trust-score.ts
 */

import { describe, it, expect } from "vitest";
import {
  computeAgreement,
  computeTrustComponents,
  computeTrustScoreValue,
  determineTrustBand,
  generateTrustReasons,
  generateHumanReview,
  TRUST_THRESHOLDS,
  TRUST_WEIGHTS,
} from "../../src/pipeline/layer3-trust-score.js";
import type {
  DeterministicReport,
  LLMVerdict,
  CheckResult,
} from "../../src/types/decision-pipeline.js";

describe("Trust Score System", () => {
  // ========================================================================
  // Test Data Builders
  // ========================================================================

  function createMockCheck(
    overrides: Partial<CheckResult> = {}
  ): CheckResult {
    return {
      id: "check_001",
      type: "wage",
      passed: true,
      regulation: "40 U.S.C. § 3142",
      severity: "info",
      message: "OK",
      ...overrides,
    };
  }

  function createMockReport(
    checks: CheckResult[],
    classificationConfidence = 1.0,
    deterministicScore = 1.0
  ): DeterministicReport {
    return {
      traceId: "wcp-20240115-AB12",
      dbwdVersion: "2024-06-01",
      timestamp: "2024-01-15T10:30:00Z",
      extracted: {
        rawInput: "Test",
        role: "Electrician",
        hours: 40,
        wage: 51.69,
      },
      dbwdRate: {
        dbwdId: "ELEC001",
        baseRate: 51.69,
        fringeRate: 34.63,
        totalRate: 86.32,
        version: "2024-06-01",
        effectiveDate: "2024-06-01",
        trade: "Electrician",
      },
      checks,
      classificationMethod: "exact",
      classificationConfidence,
      deterministicScore,
      timings: [],
    };
  }

  function createMockVerdict(
    status: "Approved" | "Revise" | "Reject" = "Approved",
    selfConfidence = 0.95
  ): LLMVerdict {
    return {
      traceId: "wcp-20240115-AB12",
      status,
      rationale: "Test rationale",
      referencedCheckIds: ["check_001"],
      citations: [],
      selfConfidence,
      reasoningTrace: "...",
      tokenUsage: 150,
      model: "gpt-4",
      timestamp: "2024-01-15T10:30:01Z",
    };
  }

  // ========================================================================
  // computeAgreement Tests
  // ========================================================================
  describe("computeAgreement", () => {
    it("returns 1.0 for perfect agreement (Approved with no failures)", () => {
      const checks = [createMockCheck({ passed: true, severity: "info" })];
      const report = createMockReport(checks);
      const verdict = createMockVerdict("Approved");

      expect(computeAgreement(verdict, checks)).toBe(1.0);
    });

    it("returns 1.0 for Reject with critical failure", () => {
      const checks = [
        createMockCheck({ passed: false, severity: "critical" }),
      ];
      const report = createMockReport(checks);
      const verdict = createMockVerdict("Reject");

      expect(computeAgreement(verdict, checks)).toBe(1.0);
    });

    it("returns 1.0 for Revise with error-level failure", () => {
      const checks = [
        createMockCheck({ passed: false, severity: "error" }),
      ];
      const report = createMockReport(checks);
      const verdict = createMockVerdict("Revise");

      expect(computeAgreement(verdict, checks)).toBe(1.0);
    });

    it("returns 0.0 for major disagreement (Approved with critical failure)", () => {
      const checks = [
        createMockCheck({ passed: false, severity: "critical" }),
      ];
      const report = createMockReport(checks);
      const verdict = createMockVerdict("Approved"); // Should be Reject!

      expect(computeAgreement(verdict, checks)).toBe(0.0);
    });

    it("returns 0.5 for partial credit (Reject when only error expected)", () => {
      const checks = [
        createMockCheck({ passed: false, severity: "error" }), // Not critical
      ];
      const report = createMockReport(checks);
      const verdict = createMockVerdict("Reject"); // Overly strict but acknowledged

      expect(computeAgreement(verdict, checks)).toBe(0.5);
    });

    it("returns 0.3 for under-reaction (Approved when error exists)", () => {
      const checks = [
        createMockCheck({ passed: false, severity: "error" }),
      ];
      const report = createMockReport(checks);
      const verdict = createMockVerdict("Approved"); // Should be Revise!

      expect(computeAgreement(verdict, checks)).toBe(0.3);
    });

    it("returns 0.5 for over-reaction (Revise when only warning exists)", () => {
      const checks = [
        createMockCheck({ passed: false, severity: "warning" }),
      ];
      const report = createMockReport(checks);
      const verdict = createMockVerdict("Revise"); // Conservative but acceptable

      expect(computeAgreement(verdict, checks)).toBe(0.5);
    });

    it("handles multiple checks of different severities", () => {
      const checks = [
        createMockCheck({ id: "c1", passed: true, severity: "info" }),
        createMockCheck({ id: "c2", passed: false, severity: "error" }),
        createMockCheck({ id: "c3", passed: false, severity: "warning" }),
      ];
      const report = createMockReport(checks);
      const verdict = createMockVerdict("Revise"); // Matches highest severity (error)

      expect(computeAgreement(verdict, checks)).toBe(1.0);
    });

    it("prioritizes critical over error", () => {
      const checks = [
        createMockCheck({ id: "c1", passed: false, severity: "error" }),
        createMockCheck({ id: "c2", passed: false, severity: "critical" }),
      ];
      const report = createMockReport(checks);
      const verdict = createMockVerdict("Revise"); // Should be Reject due to critical

      expect(computeAgreement(verdict, checks)).toBe(0.5); // Partial credit
    });
  });

  // ========================================================================
  // computeTrustComponents Tests
  // ========================================================================
  describe("computeTrustComponents", () => {
    it("computes all four components correctly", () => {
      const checks = [createMockCheck()];
      const report = createMockReport(checks, 0.9, 0.95); // classification=0.9, deterministic=0.95
      const verdict = createMockVerdict("Approved", 0.85); // llmSelf=0.85

      const components = computeTrustComponents(report, verdict);

      expect(components.deterministic).toBe(0.95);
      expect(components.classification).toBe(0.9);
      expect(components.llmSelf).toBe(0.85);
      expect(components.agreement).toBe(1.0); // Perfect agreement
    });

    it("handles low classification confidence", () => {
      const checks = [createMockCheck()];
      const report = createMockReport(checks, 0.3, 1.0); // Low classification
      const verdict = createMockVerdict("Approved", 0.95);

      const components = computeTrustComponents(report, verdict);

      expect(components.classification).toBe(0.3);
      expect(components.deterministic).toBe(1.0);
    });
  });

  // ========================================================================
  // computeTrustScoreValue Tests
  // ========================================================================
  describe("computeTrustScoreValue", () => {
    it("computes weighted sum correctly with all 1.0", () => {
      const components = {
        deterministic: 1.0,
        classification: 1.0,
        llmSelf: 1.0,
        agreement: 1.0,
      };

      const score = computeTrustScoreValue(components);

      // 0.35*1 + 0.25*1 + 0.20*1 + 0.20*1 = 1.0
      expect(score).toBe(1.0);
    });

    it("computes weighted sum with mixed values", () => {
      const components = {
        deterministic: 1.0,
        classification: 0.8,
        llmSelf: 0.9,
        agreement: 0.5,
      };

      const score = computeTrustScoreValue(components);

      // 0.35*1 + 0.25*0.8 + 0.20*0.9 + 0.20*0.5
      // = 0.35 + 0.20 + 0.18 + 0.10 = 0.83
      const expected =
        TRUST_WEIGHTS.deterministic * 1.0 +
        TRUST_WEIGHTS.classification * 0.8 +
        TRUST_WEIGHTS.llmSelf * 0.9 +
        TRUST_WEIGHTS.agreement * 0.5;

      expect(score).toBeCloseTo(expected, 5);
    });

    it("returns 0 when all components are 0", () => {
      const components = {
        deterministic: 0,
        classification: 0,
        llmSelf: 0,
        agreement: 0,
      };

      expect(computeTrustScoreValue(components)).toBe(0);
    });
  });

  // ========================================================================
  // determineTrustBand Tests
  // ========================================================================
  describe("determineTrustBand", () => {
    it("returns auto for score >= 0.85 with agreement", () => {
      expect(determineTrustBand(0.85, 1.0)).toBe("auto");
      expect(determineTrustBand(0.95, 1.0)).toBe("auto");
      expect(determineTrustBand(1.0, 1.0)).toBe("auto");
    });

    it("returns flag_for_review for score 0.60-0.84 with agreement", () => {
      expect(determineTrustBand(0.60, 1.0)).toBe("flag_for_review");
      expect(determineTrustBand(0.70, 1.0)).toBe("flag_for_review");
      expect(determineTrustBand(0.84, 1.0)).toBe("flag_for_review");
    });

    it("returns require_human for score < 0.60 with agreement", () => {
      expect(determineTrustBand(0.59, 1.0)).toBe("require_human");
      expect(determineTrustBand(0.30, 1.0)).toBe("require_human");
      expect(determineTrustBand(0.0, 1.0)).toBe("require_human");
    });

    it("ALWAYS returns require_human when agreement is 0 (override rule)", () => {
      expect(determineTrustBand(0.99, 0.0)).toBe("require_human");
      expect(determineTrustBand(0.95, 0.0)).toBe("require_human");
      expect(determineTrustBand(0.85, 0.0)).toBe("require_human"); // Would be auto otherwise
    });

    it("returns require_human for low agreement even with decent score", () => {
      expect(determineTrustBand(0.75, 0.0)).toBe("require_human"); // Would be flag otherwise
      expect(determineTrustBand(0.65, 0.0)).toBe("require_human"); // Would be flag otherwise
    });
  });

  // ========================================================================
  // generateTrustReasons Tests
  // ========================================================================
  describe("generateTrustReasons", () => {
    it("generates reason for agreement failure", () => {
      const components = {
        deterministic: 1.0,
        classification: 1.0,
        llmSelf: 1.0,
        agreement: 0.0,
      };

      const reasons = generateTrustReasons(components, "require_human");

      expect(reasons.some((r) => r.includes("contradicts"))).toBe(true);
    });

    it("generates reason for low deterministic score", () => {
      const components = {
        deterministic: 0.5,
        classification: 1.0,
        llmSelf: 1.0,
        agreement: 1.0,
      };

      const reasons = generateTrustReasons(components, "require_human");

      expect(reasons.some((r) => r.includes("deterministic"))).toBe(true);
    });

    it("generates reason for low classification confidence", () => {
      const components = {
        deterministic: 1.0,
        classification: 0.3,
        llmSelf: 1.0,
        agreement: 1.0,
      };

      const reasons = generateTrustReasons(components, "require_human");

      expect(reasons.some((r) => r.includes("classification"))).toBe(true);
    });

    it("generates reason for low LLM confidence", () => {
      const components = {
        deterministic: 1.0,
        classification: 1.0,
        llmSelf: 0.4,
        agreement: 1.0,
      };

      const reasons = generateTrustReasons(components, "flag_for_review");

      expect(reasons.some((r) => r.includes("confidence"))).toBe(true);
    });

    it("includes band-specific messaging for require_human", () => {
      const components = {
        deterministic: 0.5,
        classification: 0.5,
        llmSelf: 0.5,
        agreement: 0.5,
      };

      const reasons = generateTrustReasons(components, "require_human");

      expect(reasons.some((r) => r.includes("below 0.60"))).toBe(true);
    });

    it("includes band-specific messaging for flag_for_review", () => {
      const components = {
        deterministic: 0.8,
        classification: 0.8,
        llmSelf: 0.8,
        agreement: 0.8,
      };

      const reasons = generateTrustReasons(components, "flag_for_review");

      expect(reasons.some((r) => r.includes("0.60-0.84"))).toBe(true);
    });

    it("returns generic message for good scores", () => {
      const components = {
        deterministic: 1.0,
        classification: 1.0,
        llmSelf: 0.95,
        agreement: 1.0,
      };

      const reasons = generateTrustReasons(components, "auto");

      expect(reasons.some((r) => r.includes("acceptable range"))).toBe(true);
    });
  });

  // ========================================================================
  // generateHumanReview Tests
  // ========================================================================
  describe("generateHumanReview", () => {
    it("returns not_required for auto band", () => {
      const review = generateHumanReview("auto", "wcp-001");

      expect(review.required).toBe(false);
      expect(review.status).toBe("not_required");
      expect(review.queuedAt).toBeUndefined();
    });

    it("returns pending for flag_for_review band", () => {
      const review = generateHumanReview("flag_for_review", "wcp-001");

      expect(review.required).toBe(true);
      expect(review.status).toBe("pending");
      expect(review.queuedAt).toBeDefined();
    });

    it("returns pending for require_human band", () => {
      const review = generateHumanReview("require_human", "wcp-001");

      expect(review.required).toBe(true);
      expect(review.status).toBe("pending");
      expect(review.queuedAt).toBeDefined();
    });

    it("sets queuedAt timestamp for bands requiring review", () => {
      const before = new Date().toISOString();
      const review = generateHumanReview("require_human", "wcp-001");
      const after = new Date().toISOString();

      expect(review.queuedAt).toBeDefined();
      expect(review.queuedAt! >= before).toBe(true);
      expect(review.queuedAt! <= after).toBe(true);
    });
  });

  // ========================================================================
  // Constants Tests
  // ========================================================================
  describe("TRUST_WEIGHTS", () => {
    it("sum to 1.0", () => {
      const sum =
        TRUST_WEIGHTS.deterministic +
        TRUST_WEIGHTS.classification +
        TRUST_WEIGHTS.llmSelf +
        TRUST_WEIGHTS.agreement;

      expect(sum).toBe(1.0);
    });

    it("has expected values", () => {
      expect(TRUST_WEIGHTS.deterministic).toBe(0.35);
      expect(TRUST_WEIGHTS.classification).toBe(0.25);
      expect(TRUST_WEIGHTS.llmSelf).toBe(0.20);
      expect(TRUST_WEIGHTS.agreement).toBe(0.20);
    });
  });

  describe("TRUST_THRESHOLDS", () => {
    it("has expected values", () => {
      expect(TRUST_THRESHOLDS.auto).toBe(0.85);
      expect(TRUST_THRESHOLDS.flagMin).toBe(0.60);
    });

    it("auto threshold is higher than flagMin", () => {
      expect(TRUST_THRESHOLDS.auto).toBeGreaterThan(TRUST_THRESHOLDS.flagMin);
    });
  });

  // ========================================================================
  // Integration: Full Trust Score Calculation
  // ========================================================================
  describe("Full Trust Score Calculation", () => {
    it("calculates high trust for clean case", () => {
      const checks = [createMockCheck({ passed: true, severity: "info" })];
      const report = createMockReport(checks, 1.0, 1.0);
      const verdict = createMockVerdict("Approved", 0.95);

      const components = computeTrustComponents(report, verdict);
      const score = computeTrustScoreValue(components);
      const band = determineTrustBand(score, components.agreement);

      expect(score).toBeGreaterThanOrEqual(0.85);
      expect(band).toBe("auto");
    });

    it("calculates low trust for problematic case", () => {
      const checks = [
        createMockCheck({ passed: false, severity: "critical" }),
      ];
      const report = createMockReport(checks, 0.3, 0.5); // Low classification and deterministic
      const verdict = createMockVerdict("Approved", 0.4); // Wrong verdict, low confidence

      const components = computeTrustComponents(report, verdict);
      const score = computeTrustScoreValue(components);
      const band = determineTrustBand(score, components.agreement);

      expect(score).toBeLessThan(0.60);
      expect(band).toBe("require_human");
    });

    it("flags borderline cases for review", () => {
      const checks = [
        createMockCheck({ passed: false, severity: "warning" }),
      ];
      const report = createMockReport(checks, 0.75, 0.85);
      const verdict = createMockVerdict("Revise", 0.75);

      const components = computeTrustComponents(report, verdict);
      const score = computeTrustScoreValue(components);
      const band = determineTrustBand(score, components.agreement);

      expect(score).toBeGreaterThanOrEqual(0.60);
      expect(score).toBeLessThan(0.85);
      expect(band).toBe("flag_for_review");
    });
  });
});
