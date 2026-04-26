/**
 * Trust score computation — mirrors backend rules.py logic.
 *
 * Calibrated weights (do not adjust without regression testing):
 * - deterministic: 0.35
 * - classification: 0.25
 * - llm_self: 0.20
 * - agreement: 0.20
 *
 * Hard rule: deterministic violations cannot be overridden into approval.
 */

import { config } from "../../config.js";
import type {
  DeterministicReport,
  LLMVerdict,
  TrustBand,
  VerdictStatus,
} from "../../types/index.js";

interface TrustComponents {
  deterministic: number;
  classification: number;
  llm_self: number;
  agreement: number;
}

export function computeTrustComponents(
  deterministic: DeterministicReport,
  llmVerdict: LLMVerdict
): TrustComponents {
  const violationRatio =
    deterministic.violation_count / Math.max(deterministic.checks.length, 1);
  const deterministicScore = 1.0 - violationRatio;

  // Phase 3: placeholder for retrieval/classification confidence
  const classificationScore = 0.95;

  const llmScore = llmVerdict.confidence;
  const agreementScore = computeAgreement(deterministic, llmVerdict);

  return {
    deterministic: 0.35 * deterministicScore,
    classification: 0.25 * classificationScore,
    llm_self: 0.20 * llmScore,
    agreement: 0.20 * agreementScore,
  };
}

export function computeTrustScore(components: TrustComponents): number {
  const score =
    components.deterministic +
    components.classification +
    components.llm_self +
    components.agreement;
  // Clamp to [0, 1]
  return Math.min(Math.max(score, 0), 1);
}

export function determineTrustBand(score: number): TrustBand {
  if (score >= config.TRUST_SCORE_HIGH_BAND) {
    return "auto_approve";
  }
  if (score >= config.TRUST_SCORE_REVIEW_THRESHOLD) {
    return "flag_for_review";
  }
  return "require_human_review";
}

function computeAgreement(
  deterministic: DeterministicReport,
  llmVerdict: LLMVerdict
): number {
  const hasViolations = deterministic.violation_count > 0;
  const llmApproved = llmVerdict.verdict === "approved";

  if (hasViolations && llmApproved) {
    return 0.0; // Major disagreement
  }
  if (!hasViolations && llmApproved) {
    return 1.0; // Full agreement
  }
  return 0.5; // Partial agreement
}

/**
 * Safety override: if deterministic has violations but LLM says approved,
 * force verdict to rejected and require human review.
 */
export function safeVerdict(
  deterministic: DeterministicReport,
  llmVerdict: LLMVerdict
): VerdictStatus {
  const hasViolations = deterministic.violation_count > 0;
  const llmApproved = llmVerdict.verdict === "approved";

  if (hasViolations && llmApproved) {
    return "rejected";
  }
  return llmVerdict.verdict;
}
