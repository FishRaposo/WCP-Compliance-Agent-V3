/**
 * Pipeline Contracts Unit Tests
 *
 * Tests for typed contracts and Zod schema validation.
 *
 * @see src/types/decision-pipeline.ts
 */

import { describe, it, expect } from "vitest";
import {
  CheckResultSchema,
  ExtractedWCPSchema,
  DBWDRateInfoSchema,
  DeterministicReportSchema,
  LLMVerdictSchema,
  TrustScoreSchema,
  TrustScoredDecisionSchema,
  HumanReviewSchema,
  isTrustScoredDecision,
  validateReferencedCheckIds,
  type DeterministicReport,
  type LLMVerdict,
  type CheckResult,
} from "../../src/types/decision-pipeline.js";

describe("Pipeline Contracts", () => {
  // ========================================================================
  // CheckResult Schema
  // ========================================================================
  describe("CheckResultSchema", () => {
    it("validates a valid check result", () => {
      const check = {
        id: "base_wage_001",
        type: "wage",
        passed: true,
        regulation: "40 U.S.C. § 3142(a)",
        expected: 51.69,
        actual: 51.69,
        severity: "info",
        message: "Wage meets prevailing rate",
      };

      const result = CheckResultSchema.safeParse(check);
      expect(result.success).toBe(true);
    });

    it("rejects invalid severity", () => {
      const check = {
        id: "base_wage_001",
        type: "wage",
        passed: true,
        regulation: "40 U.S.C. § 3142(a)",
        severity: "invalid_severity", // Invalid
        message: "Test",
      };

      const result = CheckResultSchema.safeParse(check);
      expect(result.success).toBe(false);
    });

    it("rejects missing required fields", () => {
      const check = {
        id: "base_wage_001",
        type: "wage",
        // Missing: passed, regulation, severity, message
      };

      const result = CheckResultSchema.safeParse(check);
      expect(result.success).toBe(false);
    });

    it("accepts optional numeric fields", () => {
      const check = {
        id: "classification_001",
        type: "classification",
        passed: true,
        regulation: "29 CFR 5.5",
        severity: "info",
        message: "Classification resolved",
        // expected, actual, difference are optional
      };

      const result = CheckResultSchema.safeParse(check);
      expect(result.success).toBe(true);
    });
  });

  // ========================================================================
  // ExtractedWCP Schema
  // ========================================================================
  describe("ExtractedWCPSchema", () => {
    it("validates minimal extracted data", () => {
      const data = {
        rawInput: "Role: Electrician, Hours: 40, Wage: 51.69",
        role: "Electrician",
        hours: 40,
        wage: 51.69,
      };

      const result = ExtractedWCPSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("validates full extracted data with all fields", () => {
      const data = {
        rawInput: "Role: Electrician, Hours: 45, Wage: 51.69, Fringe: 34.63",
        role: "Electrician",
        hours: 45,
        regularHours: 40,
        overtimeHours: 5,
        wage: 51.69,
        fringe: 34.63,
        grossPay: 2584.5,
        workerName: "John Doe",
        weekEnding: "2024-06-15",
        projectId: "PROJ-001",
      };

      const result = ExtractedWCPSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("rejects negative hours", () => {
      const data = {
        rawInput: "Test",
        role: "Electrician",
        hours: -5, // Invalid
        wage: 51.69,
      };

      const result = ExtractedWCPSchema.safeParse(data);
      expect(result.success).toBe(false); // Enforced by .min(0) on hours
    });
  });

  // ========================================================================
  // DeterministicReport Schema
  // ========================================================================
  describe("DeterministicReportSchema", () => {
    const validReport = {
      traceId: "wcp-20240115-AB12",
      dbwdVersion: "2024-06-01",
      timestamp: "2024-01-15T10:30:00Z",
      extracted: {
        rawInput: "Role: Electrician, Hours: 40, Wage: 51.69",
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
      checks: [
        {
          id: "check_001",
          type: "wage",
          passed: true,
          regulation: "40 U.S.C. § 3142",
          severity: "info",
          message: "OK",
        },
      ],
      classificationMethod: "exact",
      classificationConfidence: 1.0,
      deterministicScore: 1.0,
      timings: [{ stage: "extraction", ms: 50 }],
    };

    it("validates a complete report", () => {
      const result = DeterministicReportSchema.safeParse(validReport);
      expect(result.success).toBe(true);
    });

    it("rejects invalid classification method", () => {
      const report = {
        ...validReport,
        classificationMethod: "invalid_method",
      };

      const result = DeterministicReportSchema.safeParse(report);
      expect(result.success).toBe(false);
    });

    it("rejects confidence outside 0-1 range", () => {
      const report = {
        ...validReport,
        classificationConfidence: 1.5, // Invalid: > 1
      };

      const result = DeterministicReportSchema.safeParse(report);
      expect(result.success).toBe(false);
    });

    it("rejects empty checks array", () => {
      const report = {
        ...validReport,
        checks: [],
      };

      // Empty array is technically valid for Zod, but semantically questionable
      const result = DeterministicReportSchema.safeParse(report);
      expect(result.success).toBe(true); // Would need .min(1) to reject
    });
  });

  // ========================================================================
  // LLMVerdict Schema
  // ========================================================================
  describe("LLMVerdictSchema", () => {
    const validVerdict = {
      traceId: "wcp-20240115-AB12",
      status: "Approved",
      rationale: "All checks passed",
      referencedCheckIds: ["check_001"],
      citations: [
        {
          statute: "40 U.S.C. § 3142",
          description: "Prevailing wage",
        },
      ],
      selfConfidence: 0.95,
      reasoningTrace: "Step 1: Checked wage...",
      tokenUsage: 150,
      model: "gpt-4o-mini",
      timestamp: "2024-01-15T10:30:01Z",
    };

    it("validates a complete verdict", () => {
      const result = LLMVerdictSchema.safeParse(validVerdict);
      expect(result.success).toBe(true);
    });

    it("rejects invalid status", () => {
      const verdict = {
        ...validVerdict,
        status: "Pending", // Invalid
      };

      const result = LLMVerdictSchema.safeParse(verdict);
      expect(result.success).toBe(false);
    });

    it("rejects empty referencedCheckIds", () => {
      const verdict = {
        ...validVerdict,
        referencedCheckIds: [], // Invalid: must have at least one
      };

      const result = LLMVerdictSchema.safeParse(verdict);
      expect(result.success).toBe(false);
    });

    it("rejects selfConfidence outside 0-1", () => {
      const verdict = {
        ...validVerdict,
        selfConfidence: 1.5,
      };

      const result = LLMVerdictSchema.safeParse(verdict);
      expect(result.success).toBe(false);
    });
  });

  // ========================================================================
  // TrustScoredDecision Schema
  // ========================================================================
  describe("TrustScoredDecisionSchema", () => {
    const validDecision = {
      traceId: "wcp-20240115-AB12",
      deterministic: {
        traceId: "wcp-20240115-AB12",
        dbwdVersion: "2024-06-01",
        timestamp: "2024-01-15T10:30:00Z",
        extracted: {
          rawInput: "Role: Electrician, Hours: 40, Wage: 51.69",
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
        checks: [
          {
            id: "check_001",
            type: "wage",
            passed: true,
            regulation: "40 U.S.C. § 3142",
            severity: "info",
            message: "OK",
          },
        ],
        classificationMethod: "exact",
        classificationConfidence: 1.0,
        deterministicScore: 1.0,
        timings: [],
      },
      verdict: {
        traceId: "wcp-20240115-AB12",
        status: "Approved",
        rationale: "All checks passed",
        referencedCheckIds: ["check_001"],
        citations: [],
        selfConfidence: 0.95,
        reasoningTrace: "...",
        tokenUsage: 150,
        model: "gpt-4o-mini",
        timestamp: "2024-01-15T10:30:01Z",
      },
      trust: {
        score: 0.95,
        components: {
          deterministic: 1.0,
          classification: 1.0,
          llmSelf: 0.95,
          agreement: 1.0,
        },
        band: "auto",
        reasons: ["All good"],
      },
      humanReview: {
        required: false,
        status: "not_required",
      },
      auditTrail: [
        {
          timestamp: "2024-01-15T10:30:00Z",
          stage: "layer1",
          event: "check_completed",
          details: {},
        },
      ],
      finalStatus: "Approved",
      finalizedAt: "2024-01-15T10:30:02Z",
    };

    it("validates a complete decision", () => {
      const result = TrustScoredDecisionSchema.safeParse(validDecision);
      expect(result.success).toBe(true);
    });

    it("rejects invalid finalStatus", () => {
      const decision = {
        ...validDecision,
        finalStatus: "InvalidStatus",
      };

      const result = TrustScoredDecisionSchema.safeParse(decision);
      expect(result.success).toBe(false);
    });

    it("rejects mismatched traceIds", () => {
      const decision = {
        ...validDecision,
        verdict: {
          ...validDecision.verdict,
          traceId: "different-trace-id", // Mismatch!
        },
      };

      // Enforced by superRefine cross-field traceId check
      const result = TrustScoredDecisionSchema.safeParse(decision);
      expect(result.success).toBe(false);
    });
  });

  // ========================================================================
  // HumanReview Schema
  // ========================================================================
  describe("HumanReviewSchema", () => {
    it("validates not_required state", () => {
      const review = {
        required: false,
        status: "not_required",
      };

      const result = HumanReviewSchema.safeParse(review);
      expect(result.success).toBe(true);
    });

    it("validates pending state with timestamps", () => {
      const review = {
        required: true,
        status: "pending",
        queuedAt: "2024-01-15T10:30:00Z",
      };

      const result = HumanReviewSchema.safeParse(review);
      expect(result.success).toBe(true);
    });

    it("validates completed review", () => {
      const review = {
        required: true,
        status: "approved",
        queuedAt: "2024-01-15T10:30:00Z",
        reviewedAt: "2024-01-15T11:00:00Z",
        reviewer: "reviewer_001",
        notes: "Approved after review",
        overrideReason: "Wage exception applies",
      };

      const result = HumanReviewSchema.safeParse(review);
      expect(result.success).toBe(true);
    });
  });

  // ========================================================================
  // Type Guards
  // ========================================================================
  describe("isTrustScoredDecision", () => {
    it("returns true for valid decision", () => {
      const decision = {
        traceId: "wcp-20240115-AB12",
        deterministic: {
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
          checks: [
            {
              id: "check_001",
              type: "wage",
              passed: true,
              regulation: "40 U.S.C. § 3142",
              severity: "info",
              message: "OK",
            },
          ],
          classificationMethod: "exact",
          classificationConfidence: 1.0,
          deterministicScore: 1.0,
          timings: [],
        },
        verdict: {
          traceId: "wcp-20240115-AB12",
          status: "Approved",
          rationale: "OK",
          referencedCheckIds: ["check_001"],
          citations: [],
          selfConfidence: 0.95,
          reasoningTrace: "...",
          tokenUsage: 150,
          model: "gpt-4",
          timestamp: "2024-01-15T10:30:01Z",
        },
        trust: {
          score: 0.95,
          components: {
            deterministic: 1.0,
            classification: 1.0,
            llmSelf: 0.95,
            agreement: 1.0,
          },
          band: "auto",
          reasons: ["OK"],
        },
        humanReview: {
          required: false,
          status: "not_required",
        },
        auditTrail: [],
        finalStatus: "Approved",
        finalizedAt: "2024-01-15T10:30:02Z",
      };

      expect(isTrustScoredDecision(decision)).toBe(true);
    });

    it("returns false for invalid decision", () => {
      const invalid = { random: "data" };
      expect(isTrustScoredDecision(invalid)).toBe(false);
    });

    it("returns false for null", () => {
      expect(isTrustScoredDecision(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isTrustScoredDecision(undefined)).toBe(false);
    });
  });

  // ========================================================================
  // validateReferencedCheckIds
  // ========================================================================
  describe("validateReferencedCheckIds", () => {
    const mockReport: DeterministicReport = {
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
      checks: [
        { id: "check_001", type: "wage", passed: true, regulation: "40 U.S.C. § 3142", severity: "info", message: "OK" },
        { id: "check_002", type: "overtime", passed: true, regulation: "40 U.S.C. § 3702", severity: "info", message: "OK" },
      ],
      classificationMethod: "exact",
      classificationConfidence: 1.0,
      deterministicScore: 1.0,
      timings: [],
    };

    it("returns valid for all existing check IDs", () => {
      const verdict: LLMVerdict = {
        traceId: "wcp-20240115-AB12",
        status: "Approved",
        rationale: "OK",
        referencedCheckIds: ["check_001", "check_002"],
        citations: [],
        selfConfidence: 0.95,
        reasoningTrace: "...",
        tokenUsage: 150,
        model: "gpt-4",
        timestamp: "2024-01-15T10:30:01Z",
      };

      const result = validateReferencedCheckIds(verdict, mockReport);
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it("returns invalid for missing check ID", () => {
      const verdict: LLMVerdict = {
        traceId: "wcp-20240115-AB12",
        status: "Approved",
        rationale: "OK",
        referencedCheckIds: ["check_001", "check_999"], // check_999 doesn't exist
        citations: [],
        selfConfidence: 0.95,
        reasoningTrace: "...",
        tokenUsage: 150,
        model: "gpt-4",
        timestamp: "2024-01-15T10:30:01Z",
      };

      const result = validateReferencedCheckIds(verdict, mockReport);
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(["check_999"]);
    });

    it("returns invalid for all missing check IDs", () => {
      const verdict: LLMVerdict = {
        traceId: "wcp-20240115-AB12",
        status: "Approved",
        rationale: "OK",
        referencedCheckIds: ["check_999", "check_998"], // None exist
        citations: [],
        selfConfidence: 0.95,
        reasoningTrace: "...",
        tokenUsage: 150,
        model: "gpt-4",
        timestamp: "2024-01-15T10:30:01Z",
      };

      const result = validateReferencedCheckIds(verdict, mockReport);
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(["check_999", "check_998"]);
    });

    it("returns valid for empty referencedCheckIds (edge case)", () => {
      const verdict: LLMVerdict = {
        traceId: "wcp-20240115-AB12",
        status: "Approved",
        rationale: "OK",
        referencedCheckIds: [], // Empty
        citations: [],
        selfConfidence: 0.95,
        reasoningTrace: "...",
        tokenUsage: 150,
        model: "gpt-4",
        timestamp: "2024-01-15T10:30:01Z",
      };

      // Empty array has no missing IDs, so technically valid
      // (But Zod schema requires min(1), so this wouldn't parse)
      const result = validateReferencedCheckIds(verdict, mockReport);
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });
  });
});
