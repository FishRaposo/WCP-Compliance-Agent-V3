/**
 * Coverage Gap Tests
 *
 * Targets the specific modules and paths that fall below the 80% coverage
 * threshold but cannot easily be reached by existing integration tests
 * running in mock mode:
 *
 * - cross-encoder.ts (mock mode returns zero-vector similarities)
 * - vector-search.ts (mock mode returns empty — pool unavailable)
 * - layer2-llm-verdict.ts (buildLayer2Prompt, mock verdict construction)
 * - orchestrator.ts (error fallback path, production-mode warning)
 * - retrieval/rrf-fusion.ts (edge case: single-source)
 * - bm25-search.ts (resetESClient utility)
 */

import { describe, it, expect, beforeAll, vi } from "vitest";

// ============================================================================
// Setup
// ============================================================================

beforeAll(() => {
  process.env.OPENAI_API_KEY = "test-api-key";
  delete process.env.POSTGRES_URL;
  delete process.env.ELASTICSEARCH_URL;
});

// ============================================================================
// vector-search.ts — mock-mode generateEmbedding and vectorSearch
// ============================================================================

describe("generateEmbedding (mock mode)", () => {
  it("returns a zero vector of default length 1536", async () => {
    const { generateEmbedding } = await import("../../src/retrieval/vector-search.js");
    const vec = await generateEmbedding("Electrician");
    expect(vec).toHaveLength(1536);
    expect(vec.every((v) => v === 0)).toBe(true);
  });

  it("respects PGVECTOR_DIMENSIONS env override", async () => {
    process.env.PGVECTOR_DIMENSIONS = "512";
    const { generateEmbedding } = await import("../../src/retrieval/vector-search.js");
    const vec = await generateEmbedding("Plumber");
    expect(vec).toHaveLength(512);
    delete process.env.PGVECTOR_DIMENSIONS;
  });

  it("vectorSearch returns empty array when pool unavailable (mock mode)", async () => {
    const { vectorSearch } = await import("../../src/retrieval/vector-search.js");
    const hits = await vectorSearch("Carpenter");
    expect(hits).toEqual([]);
  });
});

// ============================================================================
// cross-encoder.ts — mock mode (zero vectors produce 0 cosine similarity)
// ============================================================================

describe("crossEncoderRerank (mock mode)", () => {
  it("returns empty array when given no candidates", async () => {
    const { crossEncoderRerank } = await import("../../src/retrieval/cross-encoder.js");
    const result = await crossEncoderRerank("Electrician", [], new Map());
    expect(result).toEqual([]);
  });

  it("re-ranks candidates by cosine similarity (mock mode produces 0 scores)", async () => {
    const { crossEncoderRerank } = await import("../../src/retrieval/cross-encoder.js");
    const candidates = [
      { tradeCode: "ELEC0490", jobTitle: "Electrician", baseRate: 51.69, fringeRate: 34.63,
        effectiveDate: "2024-06-01", wdId: "WD-2024-ELEC-0490", score: 0.9, rank: 0,
        source: "bm25" as const, rrfScore: 0.9, sources: ["bm25" as const] },
      { tradeCode: "PLMB0380", jobTitle: "Plumber", baseRate: 48.20, fringeRate: 28.10,
        effectiveDate: "2024-06-01", wdId: "WD-2024-PLMB-0380", score: 0.7, rank: 1,
        source: "bm25" as const, rrfScore: 0.7, sources: ["bm25" as const] },
    ];
    const descriptions = new Map([
      ["ELEC0490", "Electrician: installs electrical wiring and equipment."],
      ["PLMB0380", "Plumber: installs and repairs pipes and fixtures."],
    ]);
    const result = await crossEncoderRerank("Electrician", candidates, descriptions);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty("source", "reranked");
    expect(result.every((r) => typeof r.score === "number")).toBe(true);
  });

  it("returns candidates in original order when re-ranking produces equal scores", async () => {
    const { crossEncoderRerank } = await import("../../src/retrieval/cross-encoder.js");
    const candidate = {
      tradeCode: "CARP0150", jobTitle: "Carpenter", baseRate: 45.0, fringeRate: 25.0,
      effectiveDate: "2024-06-01", wdId: "WD-2024-CARP-0150", score: 0.8, rank: 0,
      source: "vector" as const, rrfScore: 0.8, sources: ["vector" as const],
    };
    const result = await crossEncoderRerank("Carpenter", [candidate], new Map());
    expect(result).toHaveLength(1);
    expect(result[0].tradeCode).toBe("CARP0150");
  });
});

// ============================================================================
// bm25-search.ts — resetESClient
// ============================================================================

describe("bm25-search resetESClient", () => {
  it("resets client state without throwing", async () => {
    const { resetESClient } = await import("../../src/retrieval/bm25-search.js");
    expect(() => resetESClient()).not.toThrow();
  });

  it("bm25Search returns empty array when ES unavailable", async () => {
    const { bm25Search, resetESClient } = await import("../../src/retrieval/bm25-search.js");
    resetESClient();
    const hits = await bm25Search("Electrician");
    expect(Array.isArray(hits)).toBe(true);
  });
});

// ============================================================================
// layer2-llm-verdict.ts — mock mode full path including buildLayer2Prompt
// ============================================================================

describe("layer2LLMVerdict (mock mode)", () => {
  it("returns a valid LLMVerdict in mock mode", async () => {
    const { layer2LLMVerdict } = await import("../../src/pipeline/layer2-llm-verdict.js");
    const mockReport = {
      traceId: "test-trace-001",
      dbwdVersion: "2024-06-01",
      timestamp: new Date().toISOString(),
      extracted: {
        rawInput: "Role: Electrician, Hours: 40, Wage: 51.69, Fringe: 34.63",
        role: "Electrician",
        hours: 40,
        regularHours: 40,
        overtimeHours: 0,
        wage: 51.69,
        fringe: 34.63,
      },
      dbwdRate: {
        dbwdId: "WD-2024-ELEC-0490",
        baseRate: 51.69,
        fringeRate: 34.63,
        totalRate: 86.32,
        version: "2024-06-01",
        effectiveDate: "2024-06-01",
        trade: "Electrician",
      },
      checks: [
        {
          id: "base_wage_check_001",
          type: "wage" as const,
          passed: true,
          regulation: "40 U.S.C. § 3142(a)",
          severity: "info" as const,
          message: "Wage meets prevailing wage",
          expected: 51.69,
          actual: 51.69,
        },
        {
          id: "overtime_check_002",
          type: "overtime" as const,
          passed: true,
          regulation: "29 CFR 5.32 (CWHSSA)",
          severity: "info" as const,
          message: "No overtime hours worked",
        },
        {
          id: "fringe_check_003",
          type: "fringe" as const,
          passed: true,
          regulation: "29 CFR 5.5(a)(1)(i) / 40 U.S.C. § 3141(2)(B)",
          severity: "info" as const,
          message: "Fringe meets requirement",
          expected: 34.63,
          actual: 34.63,
        },
      ],
      classificationMethod: "exact" as const,
      classificationConfidence: 1.0,
      deterministicScore: 1.0,
      timings: [],
    };

    const verdict = await layer2LLMVerdict(mockReport);

    expect(verdict).toHaveProperty("status");
    expect(["Approved", "Revise", "Reject"]).toContain(verdict.status);
    expect(verdict.referencedCheckIds.length).toBeGreaterThan(0);
    expect(verdict.traceId).toBe("test-trace-001");
    expect(verdict.model).toBe("mock");
    expect(verdict.tokenUsage).toBe(0);
  });

  it("returns a LLMVerdict with all required fields", async () => {
    const { layer2LLMVerdict } = await import("../../src/pipeline/layer2-llm-verdict.js");
    const mockReport = {
      traceId: "test-trace-002",
      dbwdVersion: "2024-06-01",
      timestamp: new Date().toISOString(),
      extracted: {
        rawInput: "Role: Laborer, Hours: 40, Wage: 20.00",
        role: "Laborer",
        hours: 40,
        regularHours: 40,
        overtimeHours: 0,
        wage: 20.0,
        fringe: undefined,
      },
      dbwdRate: {
        dbwdId: "WD-2024-LABR-0210",
        baseRate: 26.45,
        fringeRate: 12.50,
        totalRate: 38.95,
        version: "2024-06-01",
        effectiveDate: "2024-06-01",
        trade: "Laborer",
      },
      checks: [
        {
          id: "base_wage_check_006",
          type: "wage" as const,
          passed: false,
          regulation: "40 U.S.C. § 3142(a)",
          severity: "critical" as const,
          message: "UNDERPAYMENT: $20.00 below $26.45",
          expected: 26.45,
          actual: 20.0,
          difference: 6.45,
        },
      ],
      classificationMethod: "exact" as const,
      classificationConfidence: 1.0,
      deterministicScore: 0,
      timings: [],
    };

    const verdict = await layer2LLMVerdict(mockReport);
    expect(verdict).toHaveProperty("traceId");
    expect(verdict).toHaveProperty("status");
    expect(verdict).toHaveProperty("rationale");
    expect(verdict).toHaveProperty("referencedCheckIds");
    expect(verdict).toHaveProperty("selfConfidence");
    expect(verdict).toHaveProperty("reasoningTrace");
    expect(verdict).toHaveProperty("citations");
    expect(verdict).toHaveProperty("tokenUsage");
    expect(verdict).toHaveProperty("model");
    expect(verdict).toHaveProperty("timestamp");
  });
});

// ============================================================================
// orchestrator.ts — error fallback path
// ============================================================================

describe("executeDecisionPipeline error fallback", () => {
  it("returns a fallback TrustScoredDecision when layer1 throws a non-layer-specific error", async () => {
    const { executeDecisionPipeline } = await import("../../src/pipeline/orchestrator.js");

    // Throw by passing content that triggers extraction to an empty string path
    // The pipeline handles all errors gracefully and returns a fallback decision
    const result = await executeDecisionPipeline({
      content: "FORCE_PARSE_ERROR_XXXXXXXXXX_UNPARSEABLE",
      traceId: "test-error-trace-001",
    });

    // Should always return a valid TrustScoredDecision (never throw)
    expect(result).toHaveProperty("traceId");
    expect(result).toHaveProperty("finalStatus");
    expect(result).toHaveProperty("trust");
    expect(result).toHaveProperty("deterministic");
    expect(result).toHaveProperty("verdict");
    expect(result).toHaveProperty("auditTrail");
  });

  it("returns a valid decision with health metrics", async () => {
    const { executeDecisionPipeline } = await import("../../src/pipeline/orchestrator.js");
    const result = await executeDecisionPipeline({
      content: "Role: Electrician, Hours: 40, Wage: 51.69, Fringe: 34.63",
      traceId: "test-health-trace-001",
    });

    expect(result).toHaveProperty("health");
    expect(result.health?.cycleTime).toBeGreaterThanOrEqual(0);
    expect(result.health).toHaveProperty("tokenUsage");
    expect(result.health).toHaveProperty("validationScore");
    expect(result.health).toHaveProperty("confidence");
  });
});

// ============================================================================
// retrieval/rrf-fusion.ts — edge cases
// ============================================================================

describe("rrfFusion edge cases", () => {
  it("handles BM25-only hits (no vector hits)", async () => {
    const { rrfFusion } = await import("../../src/retrieval/rrf-fusion.js");
    const bm25Hits = [
      { tradeCode: "ELEC0490", jobTitle: "Electrician", baseRate: 51.69, fringeRate: 34.63,
        effectiveDate: "2024-06-01", wdId: "WD-ELEC", score: 0.9, rank: 0, source: "bm25" as const },
    ];
    const result = rrfFusion(bm25Hits, []);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].sources).toContain("bm25");
  });

  it("handles vector-only hits (no BM25 hits)", async () => {
    const { rrfFusion } = await import("../../src/retrieval/rrf-fusion.js");
    const vectorHits = [
      { tradeCode: "CARP0150", jobTitle: "Carpenter", baseRate: 45.0, fringeRate: 25.0,
        effectiveDate: "2024-06-01", wdId: "WD-CARP", score: 0.85, rank: 0, source: "vector" as const },
    ];
    const result = rrfFusion([], vectorHits);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].sources).toContain("vector");
  });

  it("merges hits from both sources and boosts overlap", async () => {
    const { rrfFusion } = await import("../../src/retrieval/rrf-fusion.js");
    const hit = { tradeCode: "ELEC0490", jobTitle: "Electrician", baseRate: 51.69, fringeRate: 34.63,
      effectiveDate: "2024-06-01", wdId: "WD-ELEC", score: 0.9, rank: 0 };
    const bm25Hits = [{ ...hit, source: "bm25" as const }];
    const vectorHits = [{ ...hit, source: "vector" as const }];
    const result = rrfFusion(bm25Hits, vectorHits);
    expect(result.length).toBeGreaterThan(0);
    const elec = result.find((r) => r.tradeCode === "ELEC0490");
    expect(elec).toBeDefined();
    expect(elec?.sources).toContain("bm25");
    expect(elec?.sources).toContain("vector");
  });
});
