/**
 * LLM-as-judge for automated verdict quality evaluation.
 *
 * Calls GPT-4o with a rubric to score:
 * - accuracy: does the verdict match expected?
 * - citation_completeness: are relevant regulations cited?
 * - reasoning_clarity: is the explanation clear and defensible?
 *
 * Development/CI only — remove mock path before launch.
 */

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

import { config, isMockMode } from "../../config.js";
import { logger } from "../../utils/logger.js";
import type { TrustScoredDecision } from "../../types/index.js";

const JudgeOutputSchema = z.object({
  accuracy: z.number().min(0).max(1),
  citation_completeness: z.number().min(0).max(1),
  reasoning_clarity: z.number().min(0).max(1),
  overall: z.number().min(0).max(1),
  feedback: z.string(),
});

export interface JudgeScore {
  accuracy: number;
  citation_completeness: number;
  reasoning_clarity: number;
  overall: number;
  feedback: string;
}

function mockJudge(
  decision: TrustScoredDecision,
  expectedVerdict: string
): JudgeScore {
  const correct = decision.verdict === expectedVerdict;
  const accuracy = correct ? 1.0 : 0.0;
  const citations = decision.citations.length;
  const citation_completeness = citations > 0 ? 0.8 : 0.3;
  const reasoning_clarity = decision.reasoning_summary.length > 20 ? 0.8 : 0.5;
  const overall = (accuracy + citation_completeness + reasoning_clarity) / 3;

  return {
    accuracy,
    citation_completeness,
    reasoning_clarity,
    overall,
    feedback: correct
      ? "Verdict matches expected outcome."
      : `Verdict mismatch: expected ${expectedVerdict}, got ${decision.verdict}.`,
  };
}

export async function judgeVerdict(
  decision: TrustScoredDecision,
  expectedVerdict: string,
  expectedChecks: string[] = []
): Promise<JudgeScore> {
  if (isMockMode) {
    return mockJudge(decision, expectedVerdict);
  }

  const prompt = `You are an expert compliance reviewer evaluating a Davis-Bacon Act payroll decision.

Expected verdict: ${expectedVerdict}
Expected checks: ${expectedChecks.join(", ") || "N/A"}

Decision to evaluate:
- Verdict: ${decision.verdict}
- Trust score: ${(decision.trust_score * 100).toFixed(1)}%
- Trust band: ${decision.trust_band}
- Reasoning: ${decision.reasoning_summary}
- Citations: ${decision.citations.map((c) => c.regulation).join(", ") || "None"}
- Violations: ${decision.violation_count}
- Warnings: ${decision.warning_count}

Score the decision on:
1. accuracy (0-1): Does the verdict correctly reflect the payroll data?
2. citation_completeness (0-1): Are all relevant regulations cited?
3. reasoning_clarity (0-1): Is the reasoning clear, specific, and legally defensible?
4. overall (0-1): Weighted average of the above.

Provide brief feedback explaining the scores.`;

  try {
    const result = await generateObject({
      model: openai(config.OPENAI_MODEL),
      schema: JudgeOutputSchema,
      prompt,
    });

    return result.object;
  } catch (err) {
    logger.error({ err }, "Judge generation failed, using mock fallback");
    return mockJudge(decision, expectedVerdict);
  }
}
