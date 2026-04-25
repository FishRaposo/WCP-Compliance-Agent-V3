/**
 * WCP Compliance Agent - Decision Orchestrator
 *
 * This module orchestrates the Weekly Certified Payroll (WCP) compliance validation
 * workflow using a three-layer decision architecture:
 * 1. Deterministic Scaffold (Layer 1) - extraction, validation, rule checks
 * 2. LLM Verdict (Layer 2) - reasoning over pre-computed findings
 * 3. Trust Score + Human Review (Layer 3) - governance and audit trail
 *
 * Regulatory Basis:
 * - 29 CFR 5.5(a)(3)(ii): "Contractors shall submit weekly a copy of all payrolls..."
 * - Copeland Act (40 U.S.C. § 3145): "Furnish a statement on the wages paid each employee..."
 * - 29 CFR Part 3: Record keeping requirements
 *
 * Orchestration Flow:
 * 1. Execute deterministic scaffold (Layer 1)
 * 2. Generate LLM verdict over findings (Layer 2)
 * 3. Compute trust score and flag for human review if needed (Layer 3)
 * 4. Return TrustScoredDecision with full audit trail (Copeland Act compliance)
 *
 * Audit Trail Requirements:
 * - Every decision gets unique traceId
 * - All three layers logged with timestamps
 * - LLM reasoning trace captured verbatim
 * - Human review queue for low-trust cases
 * - 7-year retention (federal contract requirement)
 *
 * Deterministic Guarantees:
 * - Layer 1 uses regex patterns (no LLM hallucination)
 * - Layer 1 uses exact arithmetic (no estimation)
 * - Layer 2 CANNOT recompute (must reference Layer 1 findings)
 * - Layer 3 is pure function (replay-safe)
 *
 * @file src/entrypoints/wcp-entrypoint.ts
 * @see docs/architecture/decision-architecture.md - Three-layer doctrine
 * @see docs/adrs/ADR-005-decision-architecture.md - Architectural decision
 * @see docs/compliance/traceability-matrix.md - Regulation-to-code mapping
 */

// Pipeline orchestrator
import { executeDecisionPipeline, type DecisionPipelineInput } from "../pipeline/orchestrator.js";
import type { TrustScoredDecision } from "../types/decision-pipeline.js";
import { ExternalApiError, RateLimitError } from "../utils/errors.js";

/**
 * Generate WCP Compliance Decision
 *
 * Main orchestration function for Davis-Bacon Act compliance validation.
 * Uses the three-layer decision pipeline for auditability and trust.
 *
 * Three-Layer Architecture:
 * Layer 1: Deterministic scaffold (extraction, DBWD lookup, rule checks)
 * Layer 2: LLM verdict (reasoning over pre-computed findings)
 * Layer 3: Trust score + human review flag
 *
 * Regulatory Context:
 * This function implements the "weekly certified payroll" validation workflow
 * required by 29 CFR 5.5(a)(3). For each payroll submission:
 * - Validates prevailing wage compliance (40 U.S.C. § 3142)
 * - Validates overtime calculation (29 CFR 5.32 / CWHSSA)
 * - Validates worker classification (29 CFR 5.5(a)(3)(i))
 * - Generates traceable decision record (Copeland Act)
 * - Computes trust score for human review gating
 *
 * Mock Mode:
 * When OPENAI_API_KEY is set to 'mock', 'mock-key', 'test-api-key', or is empty/undefined,
 * returns deterministic mock responses without API calls. This is checked via isMockMode().
 * Useful for:
 * - Testing without OpenAI API costs
 * - Offline development
 * - Deterministic regression tests
 *
 * @param args.content - Raw WCP input text (e.g., "Role: Electrician, Hours: 45, Wage: $35.50")
 * @param args.traceId - Optional trace ID (generated if not provided)
 *
 * @returns Promise<TrustScoredDecision> - Compliance decision with findings, trust score, audit trail, and health metrics
 *
 * @throws {RateLimitError} - OpenAI API rate limit exceeded
 * @throws {ExternalApiError} - API quota exhausted or network failure
 *
 * @example
 * const decision = await generateWcpDecision({
 *   content: "Role: Electrician, Hours: 45, Wage: 35.50"
 * });
 *
 * // decision.finalStatus: "Reject"
 * // decision.trust.score: 0.45
 * // decision.trust.band: "require_human"
 * // decision.deterministic.checks: [{id: "base_wage_001", passed: false, ...}]
 * // decision.verdict.referencedCheckIds: ["base_wage_001"]
 *
 * // Original health metrics (backward compatible):
 * // decision.health.cycleTime: 245      // Processing time in ms
 * // decision.health.tokenUsage: 150     // LLM tokens consumed
 * // decision.health.validationScore: 0.8 // Deterministic check score
 * // decision.health.confidence: 0.45    // Overall confidence (from trust.score)
 *
 * @see docs/architecture/decision-architecture.md - "Three-Layer Pipeline"
 */
export async function generateWcpDecision(args: {
  content: string;
  traceId?: string;
}): Promise<TrustScoredDecision> {
  const { content, traceId } = args;

  // Build pipeline input
  const pipelineInput: DecisionPipelineInput = {
    content,
    traceId,
  };

  try {
    // Execute the three-layer pipeline
    // This is the ONLY valid path to produce a TrustScoredDecision
    const decision = await executeDecisionPipeline(pipelineInput);

    return decision;
  } catch (error: unknown) {
    // Handle specific API errors from Layer 2
    if (error && typeof error === "object" && "status" in error && error.status === 429) {
      throw new RateLimitError("OpenAI API rate limit exceeded", {
        retryAfter: "headers" in error && error.headers ? (error.headers as Record<string, unknown>)["retry-after"] : undefined,
      });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "insufficient_quota") {
      throw new ExternalApiError("OpenAI API quota exceeded", {
        code: error.code as string,
        type: "quota_error",
      });
    }
    if (error && typeof error === "object" && ("name" in error && error.name === "FetchError" || "code" in error && error.code === "ENOTFOUND")) {
      throw new ExternalApiError("Network connection failed", {
        originalError: "message" in error ? String(error.message) : "Unknown error",
      });
    }

    // Re-throw pipeline errors
    throw new ExternalApiError("Decision pipeline error", {
      code: error && typeof error === "object" && "code" in error ? String(error.code) : "PIPELINE_ERROR",
      message: error && typeof error === "object" && "message" in error ? String(error.message) : "Unknown error",
    });
  }
}