/**
 * Three-layer orchestration pipeline:
 *   Step 1: extract (Python /extract)  — skipped if pre-extracted
 *   Step 2: validate (Python /validate) → deterministic checks
 *   Step 3: verdict (Mastra LLM agent) → LLMVerdict
 *   Step 4: trust score (computed in TS)
 *   Step 5: persist (Python /decisions)
 */

import { extractTool } from "../tools/extract.js";
import { validateTool } from "../tools/validate.js";
import { persistTool } from "../tools/persist.js";
import { runVerdictAgent } from "../agents/wcp-verdict.js";
import {
  computeTrustComponents,
  computeTrustScore,
  determineTrustBand,
  safeVerdict,
} from "../agents/trust-score.js";
import { logger } from "../../utils/logger.js";
import type { ExtractedWCP, TrustScoredDecision } from "../../types/index.js";

export async function runWCPPipeline(
  text: string,
  promptVersion?: string
): Promise<TrustScoredDecision> {
  const extracted = await extractTool(text);
  return runPipelineFromExtracted(extracted, promptVersion);
}

export async function runPipelineFromExtracted(
  extracted: ExtractedWCP,
  promptVersion?: string
): Promise<TrustScoredDecision> {
  const pipelineStart = Date.now();
  const jobId = extracted.job_id;

  // Step 2: Validate (deterministic)
  const deterministic = await validateTool(extracted);
  logger.info(
    { jobId, status: deterministic.overall_status },
    "Pipeline: validate complete"
  );

  // Step 3: LLM Verdict
  const llmVerdict = await runVerdictAgent(extracted, deterministic, promptVersion);
  logger.info(
    { jobId, verdict: llmVerdict.verdict, confidence: llmVerdict.confidence },
    "Pipeline: verdict complete"
  );

  // Step 4: Trust Score
  const components = computeTrustComponents(deterministic, llmVerdict);
  const trustScore = computeTrustScore(components);
  const trustBand = determineTrustBand(trustScore);
  const finalVerdict = safeVerdict(deterministic, llmVerdict);
  const requiresHumanReview = trustBand === "require_human_review";

  logger.info(
    {
      jobId,
      trustScore: trustScore.toFixed(3),
      trustBand,
      finalVerdict,
      components,
    },
    "Pipeline: trust score computed"
  );

  // Build reasoning summary
  const violationCount = deterministic.violation_count;
  const warningCount = deterministic.warning_count;
  const reasoningSummary =
    violationCount === 0 && warningCount === 0
      ? llmVerdict.reasoning
      : `${llmVerdict.reasoning} (Deterministic: ${violationCount} violation(s), ${warningCount} warning(s))`;

  const costUsd = llmVerdict.token_usage
    ? computeCostUsd(
        llmVerdict.model || "gpt-4o-mini",
        llmVerdict.token_usage.prompt_tokens,
        llmVerdict.token_usage.completion_tokens
      )
    : 0;

  const decision: TrustScoredDecision = {
    job_id: jobId,
    verdict: finalVerdict,
    trust_score: trustScore,
    trust_band: trustBand,
    requires_human_review: requiresHumanReview,
    violation_count: violationCount,
    warning_count: warningCount,
    llm_confidence: llmVerdict.confidence,
    reasoning_summary: reasoningSummary,
    citations: llmVerdict.citations,
    cost_usd: costUsd,
    latency_ms: Date.now() - pipelineStart,
    phoenix_trace_id: llmVerdict.langfuse_trace_id,
    created_at: new Date().toISOString(),
  };

  // Step 5: Persist
  await persistTool(decision);
  logger.info({ jobId }, "Pipeline: persist complete");

  return decision;
}

function computeCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const rates: Record<string, { input: number; output: number }> = {
    "gpt-4o": { input: 0.005, output: 0.015 },
    "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  };
  const rate = rates[model];
  if (!rate) return 0;
  return (
    (promptTokens / 1000) * rate.input +
    (completionTokens / 1000) * rate.output
  );
}
