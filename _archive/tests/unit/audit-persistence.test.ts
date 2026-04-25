/**
 * Unit tests for Audit Persistence Service (M1)
 *
 * These tests verify graceful no-op behavior when PostgreSQL is unavailable
 * (which is the default in test/mock environments).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db-client so no real connection is attempted
vi.mock("../../src/services/db-client.js", () => ({
  query: vi.fn().mockResolvedValue(null), // null = DB unavailable
  resetPool: vi.fn(),
}));

import {
  persistDecision,
  getDecision,
  listDecisions,
} from "../../src/services/audit-persistence.js";
import type { TrustScoredDecision } from "../../src/types/decision-pipeline.js";

function makeMockDecision(traceId: string): TrustScoredDecision {
  return {
    traceId,
    finalStatus: "Approved",
    finalizedAt: new Date().toISOString(),
    deterministic: {
      traceId,
      dbwdVersion: "2024-06-01",
      timestamp: new Date().toISOString(),
      extracted: {
        rawInput: "Role: Electrician, Hours: 40, Wage: 51.69",
        role: "Electrician",
        hours: 40,
        regularHours: 40,
        overtimeHours: 0,
        wage: 51.69,
        weekEndingDate: undefined,
        workerName: undefined,
        socialSecurityLast4: undefined,
        traceId,
        projectId: undefined,
        localityCode: undefined,
        fringe: 34.63,
        grossPay: undefined,
        hoursByDay: undefined,
        employees: undefined,
        signatures: undefined,
        reportedBaseRate: undefined,
        reportedFringeRate: undefined,
        reportedTotalPay: undefined,
      },
      dbwdRate: {
        dbwdId: "WD-001",
        baseRate: 51.69,
        fringeRate: 34.63,
        totalRate: 86.32,
        version: "2024-06-01",
        effectiveDate: "2024-06-01",
        trade: "Electrician",
        tradeCode: "ELEC0101",
      },
      checks: [],
      classificationMethod: "exact",
      classificationConfidence: 1.0,
      deterministicScore: 1.0,
      timings: [],
    },
    verdict: {
      traceId,
      status: "Approved",
      rationale: "All checks pass.",
      referencedCheckIds: [],
      citations: [],
      selfConfidence: 0.95,
      reasoningTrace: "Mock trace",
      tokenUsage: 0,
      model: "mock",
      timestamp: new Date().toISOString(),
      promptVersion: 2,
      promptKey: "wcp_verdict",
    },
    trust: {
      score: 0.95,
      band: "auto",
      components: {
        deterministic: 1.0,
        classification: 1.0,
        llmSelf: 0.95,
        agreement: 1.0,
      },
      reasons: ["Trust score within acceptable range"],
    },
    humanReview: {
      required: false,
      status: "not_required",
    },
    auditTrail: [],
  } as unknown as TrustScoredDecision;
}

describe("Audit Persistence (DB unavailable — no-op mode)", () => {
  it("persistDecision does not throw when DB is null", async () => {
    const decision = makeMockDecision("trace-persist-001");
    await expect(persistDecision(decision)).resolves.toBeUndefined();
  });

  it("getDecision returns null when DB is null", async () => {
    const result = await getDecision("trace-get-001");
    expect(result).toBeNull();
  });

  it("listDecisions returns empty array when DB is null", async () => {
    const result = await listDecisions(10);
    expect(result).toEqual([]);
  });

  it("persistDecision is idempotent (multiple calls don't throw)", async () => {
    const decision = makeMockDecision("trace-idem-001");
    await expect(persistDecision(decision)).resolves.toBeUndefined();
    await expect(persistDecision(decision)).resolves.toBeUndefined();
  });
});
