/**
 * Layer 3: Trust Score + Human Review
 *
 * Computes hybrid trust score and applies human-review thresholds.
 * Pure deterministic function - same input always produces same output.
 *
 * Responsibilities:
 * - Compute trust score from 4 components
 * - Determine trust band (auto / flag / require_human)
 * - Check LLM/deterministic agreement
 * - Generate audit events
 *
 * @see docs/architecture/decision-architecture.md - Layer 3 documentation
 * @see docs/architecture/trust-scoring.md - Trust formula and calibration
 * @see docs/adrs/ADR-005-decision-architecture.md - Architectural decision
 */

import {
  type DeterministicReport,
  type LLMVerdict,
  type TrustScore,
  type TrustScoreComponents,
  type TrustScoredDecision,
  type HumanReview,
  type AuditEvent,
} from "../types/decision-pipeline.js";
import { childLogger } from "../utils/logger.js";

const log = childLogger("Layer3");

// ============================================================================
// Trust Formula Constants
// ============================================================================

/**
 * Trust score weights (must sum to 1.0)
 *
 * Rationale:
 * - deterministic (35%): Foundation accuracy is most important
 * - classification (25%): Classification errors cascade
 * - llmSelf (20%): Model confidence is informative but not fully trusted
 * - agreement (20%): Catch LLM/deterministic misalignment
 */
const TRUST_WEIGHTS = {
  deterministic: 0.35,
  classification: 0.25,
  llmSelf: 0.20,
  agreement: 0.20,
} as const;

/**
 * Trust thresholds
 *
 * - ≥0.85: High confidence, auto-decide
 * - 0.60-0.84: Moderate confidence, flag for review
 * - <0.60: Low confidence, require human review
 */
const TRUST_THRESHOLDS = {
  auto: 0.85,
  flagMin: 0.60,
} as const;

// ============================================================================
// Trust Score Computation
// ============================================================================

/**
 * Compute agreement score between LLM verdict and deterministic checks
 *
 * Checks if the LLM's verdict aligns with the severity of check findings.
 *
 * @param verdict LLM verdict
 * @param checks Deterministic check results
 * @returns Agreement score (0.0-1.0)
 */
export function computeAgreement(
  verdict: LLMVerdict,
  checks: DeterministicReport["checks"]
): number {
  // Check severity classification
  const hasCritical = checks.some((c) => c.severity === "critical" && !c.passed);
  const hasError = checks.some((c) => c.severity === "error" && !c.passed);
  const hasWarning = checks.some((c) => c.severity === "warning" && !c.passed);

  // Expected verdict based on severity
  let expectedStatus: "Approved" | "Revise" | "Reject";
  if (hasCritical) {
    expectedStatus = "Reject";
  } else if (hasError) {
    expectedStatus = "Revise";
  } else {
    expectedStatus = "Approved";
  }

  // Score based on alignment
  if (verdict.status === expectedStatus) {
    return 1.0;
  }

  // Partial credit for adjacent statuses
  // Reject → Revise (acknowledged issues but not critical)
  if (expectedStatus === "Reject" && verdict.status === "Revise") {
    return 0.5;
  }

  // Revise → Approved (overly optimistic)
  if (expectedStatus === "Revise" && verdict.status === "Approved") {
    return 0.3;
  }

  // Approved → Revise (overly conservative)
  if (expectedStatus === "Approved" && verdict.status === "Revise") {
    return 0.5;
  }

  // Revise → Reject (overly strict, but acknowledges issue exists)
  if (expectedStatus === "Revise" && verdict.status === "Reject") {
    return 0.5;
  }

  // Major disagreement (e.g., Approved when critical failure exists)
  return 0.0;
}

/**
 * Compute trust score components
 *
 * @param report Deterministic report
 * @param verdict LLM verdict
 * @returns Trust score components
 */
export function computeTrustComponents(
  report: DeterministicReport,
  verdict: LLMVerdict
): TrustScoreComponents {
  return {
    deterministic: report.deterministicScore,
    classification: report.classificationConfidence,
    llmSelf: verdict.selfConfidence,
    agreement: computeAgreement(verdict, report.checks),
  };
}

/**
 * Compute overall trust score
 *
 * Formula: weighted sum of components
 *
 * @param components Trust score components
 * @returns Overall trust score (0.0-1.0)
 */
export function computeTrustScoreValue(
  components: TrustScoreComponents
): number {
  return (
    TRUST_WEIGHTS.deterministic * components.deterministic +
    TRUST_WEIGHTS.classification * components.classification +
    TRUST_WEIGHTS.llmSelf * components.llmSelf +
    TRUST_WEIGHTS.agreement * components.agreement
  );
}

/**
 * Determine trust band from score
 *
 * @param score Trust score (0.0-1.0)
 * @param agreementScore Agreement score (0.0-1.0)
 * @returns Trust band
 */
export function determineTrustBand(
  score: number,
  agreementScore: number
): "auto" | "flag_for_review" | "require_human" {
  // Override: disagreement forces human review
  if (agreementScore === 0.0) {
    return "require_human";
  }

  if (score >= TRUST_THRESHOLDS.auto) {
    return "auto";
  }

  if (score >= TRUST_THRESHOLDS.flagMin) {
    return "flag_for_review";
  }

  return "require_human";
}

/**
 * Generate human review state from trust band
 *
 * @param band Trust band
 * @param traceId Decision trace ID
 * @returns Human review state
 */
export function generateHumanReview(
  band: TrustScore["band"],
  traceId: string
): HumanReview {
  const now = new Date().toISOString();

  switch (band) {
    case "auto":
      return {
        required: false,
        status: "not_required",
      };

    case "flag_for_review":
      return {
        required: true,
        status: "pending",
        queuedAt: now,
      };

    case "require_human":
      return {
        required: true,
        status: "pending",
        queuedAt: now,
      };

    default:
      // Exhaustive check
      const _exhaustive: never = band;
      return {
        required: true,
        status: "pending",
        queuedAt: now,
      };
  }
}

/**
 * Generate reasons for trust band assignment
 *
 * @param components Trust components
 * @param band Assigned band
 * @returns Human-readable reasons
 */
export function generateTrustReasons(
  components: TrustScoreComponents,
  band: TrustScore["band"]
): string[] {
  const reasons: string[] = [];

  // Agreement issues (most serious)
  if (components.agreement === 0.0) {
    reasons.push("LLM verdict contradicts deterministic findings (agreement = 0)");
  } else if (components.agreement < 0.5) {
    reasons.push("LLM verdict partially misaligned with findings");
  }

  // Component-specific issues
  if (components.deterministic < 0.8) {
    reasons.push(`Low deterministic score (${(components.deterministic * 100).toFixed(0)}%)`);
  }

  if (components.classification < 0.6) {
    reasons.push(`Uncertain classification (${(components.classification * 100).toFixed(0)}%)`);
  }

  if (components.llmSelf < 0.6) {
    reasons.push(`LLM expressed low confidence (${(components.llmSelf * 100).toFixed(0)}%)`);
  }

  // Band-specific messaging
  if (band === "require_human") {
    reasons.push("Trust score below 0.60 threshold - human review required");
  } else if (band === "flag_for_review") {
    reasons.push("Trust score 0.60-0.84 - flagged for optional review");
  }

  return reasons.length > 0 ? reasons : ["Trust score within acceptable range"];
}

// ============================================================================
// Audit Trail Generation
// ============================================================================

/**
 * Generate audit trail from Layer 1, 2, and 3
 *
 * @param report Layer 1 report
 * @param verdict Layer 2 verdict
 * @param trust Layer 3 trust score
 * @returns Audit events
 */
export function generateAuditTrail(
  report: DeterministicReport,
  verdict: LLMVerdict,
  trust: TrustScore
): AuditEvent[] {
  const events: AuditEvent[] = [];
  const now = new Date().toISOString();

  // Layer 1 events
  const failedChecks = report.checks
    .filter((c) => !c.passed)
    .map((c) => ({ id: c.id, type: c.type, severity: c.severity, message: c.message }));

  events.push({
    timestamp: report.timestamp,
    stage: "layer1",
    event: "check_completed",
    details: {
      checkCount: report.checks.length,
      passedCount: report.checks.filter((c) => c.passed).length,
      failedCount: failedChecks.length,
      deterministicScore: report.deterministicScore,
      classificationMethod: report.classificationMethod,
      classificationConfidence: report.classificationConfidence,
      failedChecks,
    },
  });

  // Layer 2 events
  events.push({
    timestamp: verdict.timestamp,
    stage: "layer2",
    event: "llm_reasoning",
    details: {
      status: verdict.status,
      rationale: verdict.rationale,
      reasoningTrace: verdict.reasoningTrace,
      referencedCheckIds: verdict.referencedCheckIds,
      selfConfidence: verdict.selfConfidence,
      tokenUsage: verdict.tokenUsage,
      model: verdict.model,
      promptVersion: verdict.promptVersion,
      promptKey: verdict.promptKey,
    },
  });

  // Layer 3 events
  events.push({
    timestamp: now,
    stage: "layer3",
    event: "trust_computed",
    details: {
      trustScore: trust.score,
      components: trust.components,
      band: trust.band,
      reasons: trust.reasons,
    },
  });

  return events;
}

// ============================================================================
// Decision Narrative Builder
// ============================================================================

/**
 * Build a human-readable explanation of why the decision was made.
 *
 * This narrative answers the core auditability question:
 * "Why did the agent reach this decision, or why couldn't it decide?"
 *
 * @param report Layer 1 deterministic report
 * @param verdict Layer 2 LLM verdict
 * @param trust Layer 3 trust score
 * @param finalStatus The final decision status
 * @returns Human-readable decision explanation
 */
export function buildDecisionNarrative(
  report: DeterministicReport,
  verdict: LLMVerdict,
  trust: TrustScore,
  finalStatus: TrustScoredDecision["finalStatus"]
): string {
  const failedCritical = report.checks.filter((c) => !c.passed && c.severity === "critical");
  const failedErrors = report.checks.filter((c) => !c.passed && c.severity === "error");
  const failedWarnings = report.checks.filter((c) => !c.passed && c.severity === "warning");
  const passCount = report.checks.filter((c) => c.passed).length;
  const totalCount = report.checks.length;

  const parts: string[] = [];

  if (finalStatus === "Pending Human Review") {
    parts.push(
      `The agent could not reach a final decision automatically. ` +
      `The overall trust score of ${(trust.score * 100).toFixed(0)}% fell below the 60% threshold required for automated decisions.`
    );
    if (trust.reasons.length > 0) {
      parts.push(`Contributing factors: ${trust.reasons.join("; ")}.`);
    }
    parts.push(`A human reviewer must examine this payroll before a final ruling is issued.`);

  } else if (finalStatus === "Reject") {
    if (failedCritical.length > 0) {
      const checkSummaries = failedCritical.map((c) => `${c.id} (${c.message})`).join("; ");
      parts.push(
        `Rejected because ${failedCritical.length} critical violation${failedCritical.length > 1 ? "s were" : " was"} found: ${checkSummaries}.`
      );
    } else {
      parts.push(`Rejected based on LLM assessment of the compliance findings.`);
    }
    if (verdict.referencedCheckIds.length > 0) {
      parts.push(`The LLM cited checks: ${verdict.referencedCheckIds.join(", ")}.`);
    }
    parts.push(`LLM rationale: ${verdict.rationale}`);

  } else if (finalStatus === "Revise") {
    if (failedErrors.length > 0) {
      const checkSummaries = failedErrors.map((c) => `${c.id} (${c.message})`).join("; ");
      parts.push(
        `Revision required because ${failedErrors.length} error-level issue${failedErrors.length > 1 ? "s were" : " was"} found: ${checkSummaries}.`
      );
    } else {
      parts.push(`Revision required based on LLM assessment.`);
    }
    if (verdict.referencedCheckIds.length > 0) {
      parts.push(`The LLM cited checks: ${verdict.referencedCheckIds.join(", ")}.`);
    }
    parts.push(`LLM rationale: ${verdict.rationale}`);

  } else if (finalStatus === "Approved") {
    parts.push(`Approved: ${passCount} of ${totalCount} checks passed.`);
    if (failedWarnings.length > 0) {
      parts.push(
        `${failedWarnings.length} minor warning${failedWarnings.length > 1 ? "s were" : " was"} noted but are not sufficient to block approval.`
      );
    }
    parts.push(
      `The LLM confirmed compliance with ${(verdict.selfConfidence * 100).toFixed(0)}% confidence. Rationale: ${verdict.rationale}`
    );
  }

  return parts.join(" ");
}

// ============================================================================
// Main Layer 3 Function
// ============================================================================

/**
 * Layer 3: Trust Score + Human Review
 *
 * Computes trust score and generates final decision structure.
 * This function is 100% deterministic.
 *
 * @param report Deterministic report from Layer 1
 * @param verdict LLM verdict from Layer 2
 * @returns TrustScoredDecision with full audit trail
 */
export function layer3TrustScore(
  report: DeterministicReport,
  verdict: LLMVerdict
): TrustScoredDecision {
  const startTime = Date.now();
  log.info({ traceId: report.traceId }, "Computing trust score");

  // Step 1: Compute trust components
  const components = computeTrustComponents(report, verdict);

  // Step 2: Compute overall trust score
  const score = computeTrustScoreValue(components);

  // Step 3: Determine trust band
  const band = determineTrustBand(score, components.agreement);

  // Step 4: Generate human review state
  const humanReview = generateHumanReview(band, report.traceId);

  // Step 5: Generate reasons
  const reasons = generateTrustReasons(components, band);

  // Build trust score object
  const trust: TrustScore = {
    score,
    components,
    band,
    reasons,
  };

  // Step 6: Generate audit trail
  const auditTrail = generateAuditTrail(report, verdict, trust);

  // Step 7: Determine final status
  let finalStatus: TrustScoredDecision["finalStatus"];
  if (humanReview.status === "pending" && band === "require_human") {
    finalStatus = "Pending Human Review";
  } else {
    finalStatus = verdict.status;
  }

  const finalizedAt = new Date().toISOString();

  // Step 8: Build decision narrative and finalized audit event
  const decisionExplanation = buildDecisionNarrative(report, verdict, trust, finalStatus);

  auditTrail.push({
    timestamp: finalizedAt,
    stage: "final",
    event: "finalized",
    details: {
      finalStatus,
      decisionExplanation,
      trustScore: trust.score,
      trustBand: trust.band,
      humanReviewRequired: humanReview.required,
      trustReasons: trust.reasons,
    },
  });

  // Build final decision
  const decision: TrustScoredDecision = {
    traceId: report.traceId,
    deterministic: report,
    verdict,
    trust,
    humanReview,
    auditTrail,
    finalStatus,
    finalizedAt,
  };

  log.info({ traceId: report.traceId, ms: Date.now() - startTime, score, band, finalStatus }, "Trust score computed");

  return decision;
}

// ============================================================================
// Exports
// ============================================================================

export {
  TRUST_WEIGHTS,
  TRUST_THRESHOLDS,
};
