/**
 * Decision Pipeline Orchestrator
 *
 * Composes the three-layer decision pipeline:
 * Layer 1 (Deterministic) → Layer 2 (LLM Verdict) → Layer 3 (Trust Score + Human Review)
 *
 * This is the ONLY valid entry point for generating compliance decisions.
 * Bypassing this orchestrator violates the architecture and will fail CI.
 *
 * @see docs/architecture/decision-architecture.md - Three-layer doctrine
 * @see docs/adrs/ADR-005-decision-architecture.md - Architectural decision
 */

import { layer1Deterministic } from "./layer1-deterministic.js";
import { layer2LLMVerdict } from "./layer2-llm-verdict.js";
import { layer3TrustScore } from "./layer3-trust-score.js";
import { humanReviewQueue } from "../services/human-review-queue.js";
import { isMockMode } from "../utils/mock-responses.js";
import { 
  Layer1Error, 
  Layer2Error, 
  Layer3Error,
  recoverLayer1Error,
  recoverLayer2Error,
  recoverLayer3Error
} from "../utils/errors.js";
import type { TrustScoredDecision } from "../types/decision-pipeline.js";
import { childLogger } from "../utils/logger.js";
import { persistDecision } from "../services/audit-persistence.js";

const log = childLogger("Orchestrator");

// ============================================================================
// Pipeline Input
// ============================================================================

/**
 * Input for the decision pipeline
 */
export interface DecisionPipelineInput {
  /** Raw WCP text content */
  content: string;

  /** Optional trace ID (generated if not provided) */
  traceId?: string;

  /** Optional DBWD version to use (default: latest) */
  dbwdVersion?: string;
}

// ============================================================================
// Pipeline Orchestrator
// ============================================================================

/**
 * Execute the three-layer decision pipeline
 *
 * This is the ONLY way to produce a TrustScoredDecision.
 * All other paths are considered bugs.
 *
 * Pipeline flow:
 * 1. Layer 1: Deterministic scaffold (extract, lookup, check)
 * 2. Layer 2: LLM verdict (reasoning over Layer 1 findings)
 * 3. Layer 3: Trust score + human review flag
 * 4. Enqueue to human review if required
 *
 * @param input Pipeline input
 * @returns TrustScoredDecision with full audit trail
 */
export async function executeDecisionPipeline(
  input: DecisionPipelineInput
): Promise<TrustScoredDecision> {
  const traceId = input.traceId ?? generateTraceId();
  const startTime = Date.now();

  // Log mode on first pipeline execution
  const mockMode = isMockMode();
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  log.info({ mockMode, model }, "Pipeline mode");

  if (mockMode && process.env.NODE_ENV === "production") {
    log.warn("Running in MOCK MODE in production — real OpenAI API key required for production decisions");
  }

  log.info({ traceId, inputLength: input.content.length }, "Starting decision pipeline");

  try {
    // ======================================================================
    // Layer 1: Deterministic Scaffold
    // ======================================================================
    log.info({ traceId }, "Layer 1: Deterministic Scaffold");
    const report = await layer1Deterministic(input.content, traceId);

    const failedChecks = report.checks.filter((c) => !c.passed);
    log.info({ checkCount: report.checks.length, deterministicScore: report.deterministicScore, failedCheckCount: failedChecks.length }, "Layer 1 complete");
    if (failedChecks.length > 0) {
      log.debug({ failedChecks: failedChecks.map((c) => ({ id: c.id, type: c.type })) }, "Failed checks");
    }

    // ======================================================================
    // Layer 2: LLM Verdict
    // ======================================================================
    log.info({ traceId }, "Layer 2: LLM Verdict");
    const verdict = await layer2LLMVerdict(report);

    log.info({ status: verdict.status, selfConfidence: verdict.selfConfidence, referencedCheckIds: verdict.referencedCheckIds, promptVersion: verdict.promptVersion }, "Layer 2 complete");

    // ======================================================================
    // Layer 3: Trust Score + Human Review
    // ======================================================================
    log.info({ traceId }, "Layer 3: Trust Score + Human Review");
    const decision = layer3TrustScore(report, verdict);

    log.info({ trustScore: decision.trust.score, band: decision.trust.band, humanReviewRequired: decision.humanReview.required }, "Layer 3 complete");

    // ======================================================================
    // Human Review Queue (if required)
    // ======================================================================
    if (decision.humanReview.required) {
      log.info({ traceId }, "Enqueuing for human review");
      try {
        await humanReviewQueue.enqueue(decision);
        log.info({ traceId }, "Successfully enqueued for human review");
      } catch (error) {
        log.error({ traceId, err: error }, "Failed to enqueue for review");
        decision.auditTrail.push({
          timestamp: new Date().toISOString(),
          stage: "layer3",
          event: "enqueued",
          details: {
            error: error instanceof Error ? error.message : "Unknown error",
            note: "Enqueue failed but decision is valid",
          },
        });
      }
    }

    // ======================================================================
    // Finalize
    // ======================================================================
    const totalTime = Date.now() - startTime;
    log.info({ traceId: decision.traceId, finalStatus: decision.finalStatus, totalMs: totalTime, auditEvents: decision.auditTrail.length }, "Pipeline complete");

    // Add health metrics for backward compatibility with original health checks
    const decisionWithHealth: TrustScoredDecision = {
      ...decision,
      health: {
        cycleTime: totalTime,
        tokenUsage: decision.verdict.tokenUsage,
        validationScore: decision.deterministic.deterministicScore,
        confidence: decision.trust.score,
      },
    };

    // M1: Persist to PostgreSQL (non-blocking, graceful degradation)
    persistDecision(decisionWithHealth).catch((err) => {
      log.error({ err }, "Background persistDecision failed");
    });

    return decisionWithHealth;
  } catch (error) {
    log.error({ traceId, err: error }, "FATAL ERROR in pipeline");

    // Determine error type and recovery strategy
    let errorType = "unknown";
    let canRecover = false;
    let errorStage: "layer1" | "layer2" | "layer3" | "final" = "final";

    if (error instanceof Layer1Error) {
      errorType = error.name;
      errorStage = "layer1";
      canRecover = recoverLayer1Error(error);
    } else if (error instanceof Layer2Error) {
      errorType = error.name;
      errorStage = "layer2";
      canRecover = recoverLayer2Error(error);
    } else if (error instanceof Layer3Error) {
      errorType = error.name;
      errorStage = "layer3";
      canRecover = recoverLayer3Error(error);
    } else if (error instanceof Error) {
      errorType = "GenericError";
      errorStage = "final";
    }

    log.error({ errorType, errorStage, canRecover }, "Error classification");

    // Create a fallback decision that requires human review
    const now = new Date().toISOString();
    const fallbackDecision: TrustScoredDecision = {
      traceId,
      deterministic: {
        traceId,
        dbwdVersion: "error",
        timestamp: now,
        extracted: {
          rawInput: input.content,
          role: "Unknown",
          hours: 0,
          wage: 0,
        },
        dbwdRate: {
          dbwdId: "ERROR",
          baseRate: 0,
          fringeRate: 0,
          totalRate: 0,
          version: "error",
          effectiveDate: "error",
          trade: "Unknown",
        },
        checks: [
          {
            id: "pipeline_error_001",
            type: "classification",
            passed: false,
            regulation: "Error",
            severity: "critical",
            message: `Pipeline execution failed: ${errorType} - ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        classificationMethod: "unknown",
        classificationConfidence: 0,
        deterministicScore: 0,
        timings: [],
      },
      verdict: {
        traceId,
        status: "Reject",
        rationale: `Pipeline execution failed at ${errorStage} (${errorType}). Conservatively rejecting pending human review. Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        referencedCheckIds: ["pipeline_error_001"],
        citations: [
          {
            statute: "Error",
            description: `Pipeline failure at ${errorStage}`,
          },
        ],
        selfConfidence: 0,
        reasoningTrace: `Error fallback - ${errorType} at ${errorStage}, recoverable: ${canRecover}`,
        tokenUsage: 0,
        model: "error-fallback",
        timestamp: now,
      },
      trust: {
        score: 0,
        components: {
          deterministic: 0,
          classification: 0,
          llmSelf: 0,
          agreement: 0,
        },
        band: "require_human",
        reasons: [`Pipeline execution failed at ${errorStage} (${errorType}) - human review required`],
      },
      humanReview: {
        required: true,
        status: "pending",
        queuedAt: now,
      },
      auditTrail: [
        {
          timestamp: now,
          stage: errorStage,
          event: "check_completed",
          details: { 
            errorType, 
            canRecover, 
            message: error instanceof Error ? error.message : "Unknown"
          },
        },
        {
          timestamp: now,
          stage: "final",
          event: "finalized",
          details: { fallback: true, error: true, errorType, errorStage },
        },
      ],
      finalStatus: "Pending Human Review",
      finalizedAt: now,
      health: {
        cycleTime: Date.now() - startTime,
        tokenUsage: 0,
        validationScore: 0,
        confidence: 0,
      },
    };

    // Try to enqueue the error decision
    try {
      await humanReviewQueue.enqueue(fallbackDecision);
    } catch (enqueueError) {
      log.error({ err: enqueueError }, "Failed to enqueue error decision");
    }

    return fallbackDecision;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique trace ID
 *
 * Format: wcp-{date}-{random}
 */
function generateTraceId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomUUID().slice(0, 4).toUpperCase();
  return `wcp-${date}-${random}`;
}

// ============================================================================
// Exports
// ============================================================================

export { generateTraceId };
