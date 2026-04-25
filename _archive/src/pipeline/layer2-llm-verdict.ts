/**
 * Layer 2: LLM Verdict
 *
 * LLM reasoning over the deterministic report from Layer 1.
 * FORBIDDEN from recomputing values - must reference Layer 1 check IDs.
 *
 * Responsibilities:
 * - Accept DeterministicReport as input
 * - Generate LLM verdict with reasoning
 * - Enforce that verdict cites specific check IDs from report
 * - Capture full reasoning trace for audit
 *
 * @see docs/architecture/decision-architecture.md - Layer 2 documentation
 * @see docs/adrs/ADR-005-decision-architecture.md - Architectural decision
 */

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";
import {
  type DeterministicReport,
  type LLMVerdict,
  LLMVerdictSchema,
  DeterministicReportSchema,
  validateReferencedCheckIds,
} from "../types/decision-pipeline.js";
import { generateMockWcpDecision, isMockMode } from "../utils/mock-responses.js";
import { resolvePrompt, resolvePromptTemplate } from "../prompts/resolver.js";
import { childLogger } from "../utils/logger.js";

const log = childLogger("Layer2");

// ============================================================================
// LLM Agent Configuration
// ============================================================================

/**
 * WCP Verdict Agent
 *
 * Specialized agent for Layer 2 reasoning.
 * Instructions are loaded from the prompt registry at call time (see generateWcpVerdict).
 * A static fallback is provided here in case the registry hasn't bootstrapped.
 */
const STATIC_FALLBACK_INSTRUCTIONS = [
  "You are a Davis-Bacon Act compliance auditor reviewing a pre-computed WCP compliance report.",
  "CRITICAL CONSTRAINT: You MUST NOT recompute values. Review Layer 1 findings only.",
  "Decide: Approved / Revise / Reject. Cite specific check IDs from the report.",
].join("\n");

// ============================================================================
// Input/Output Schemas
// ============================================================================

/**
 * Input schema for Layer 2
 */
/**
 * Input schema for Layer 2 — derived from DeterministicReportSchema
 * to guarantee it never diverges from the Layer 1 output contract.
 */
const Layer2InputSchema = z.object({
  report: DeterministicReportSchema,
});

/**
 * Raw LLM output schema (before validation)
 */
const RawLLMOutputSchema = z.object({
  status: z.enum(["Approved", "Revise", "Reject"]),
  rationale: z.string(),
  referencedCheckIds: z.array(z.string()),
  citations: z.array(
    z.object({
      statute: z.string(),
      description: z.string(),
      dbwdId: z.string().optional(),
    })
  ),
  selfConfidence: z.number().min(0).max(1),
  reasoningTrace: z.string(),
});

// ============================================================================
// Prompt Construction
// ============================================================================

/**
 * Build the Layer 2 prompt from a DeterministicReport
 *
 * Includes all findings pre-formatted so LLM can reason over them.
 */
function buildLayer2Prompt(report: DeterministicReport): string {
  const checksList = report.checks
    .map(
      (check) => `
[${check.id}] ${check.type.toUpperCase()} - ${check.passed ? "PASS" : "FAIL"} (${check.severity})
Regulation: ${check.regulation}
${check.expected !== undefined ? `Expected: $${check.expected.toFixed(2)}` : ""}
${check.actual !== undefined ? `Actual: $${check.actual.toFixed(2)}` : ""}
${check.difference !== undefined ? `Difference: $${check.difference.toFixed(2)}` : ""}
Message: ${check.message}
`
    )
    .join("\n");

  return `
# WCP Compliance Report

## Worker Information
- Role: ${report.extracted.role}
- Hours: ${report.extracted.hours} (Regular: ${report.extracted.regularHours ?? 0}, OT: ${report.extracted.overtimeHours ?? 0})
- Wage: $${report.extracted.wage.toFixed(2)}/hr
- Fringe: $${(report.extracted.fringe ?? 0).toFixed(2)}/hr
- Classification Method: ${report.classificationMethod} (confidence: ${(report.classificationConfidence * 100).toFixed(0)}%)

## DBWD Rate Used
- Trade: ${report.dbwdRate.trade}
- DBWD ID: ${report.dbwdRate.dbwdId}
- Base Rate: $${report.dbwdRate.baseRate.toFixed(2)}
- Fringe Rate: $${report.dbwdRate.fringeRate.toFixed(2)}
- Version: ${report.dbwdRate.version}

## Compliance Checks Performed
${checksList}

## Deterministic Score
${(report.deterministicScore * 100).toFixed(0)}% of checks ran cleanly.

---

# Your Task

Based on the compliance report above, make a compliance decision.

**REMEMBER**: All calculations are already done. You are reviewing the findings, not doing math.

1. Review each check result
2. Decide: Approved (no violations), Revise (minor violations), or Reject (major violations)
3. Provide rationale citing specific check IDs
4. Rate your confidence (0.0-1.0)

Your output MUST include referencedCheckIds - list the [check_id] values you cite in your rationale.
`;
}

// ============================================================================
// Main Layer 2 Function
// ============================================================================

/**
 * Layer 2: LLM Verdict
 *
 * Produces an LLMVerdict by reasoning over the DeterministicReport.
 * Enforces that the verdict references check IDs from the report.
 *
 * @param report DeterministicReport from Layer 1
 * @returns LLMVerdict with reasoning and citations
 */
export async function layer2LLMVerdict(report: DeterministicReport): Promise<LLMVerdict> {
  const startTime = Date.now();
  log.info({ traceId: report.traceId }, "Starting LLM verdict");

  // Check mock mode
  if (isMockMode()) {
    log.info({ traceId: report.traceId }, "Mock mode active - using mock verdict");
    const mockDecision = generateMockWcpDecision(report.extracted.rawInput);

    // Convert mock decision to LLMVerdict format
    const verdict: LLMVerdict = {
      traceId: report.traceId,
      status: mockDecision.status as "Approved" | "Revise" | "Reject",
      rationale: mockDecision.explanation,
      referencedCheckIds: report.checks.map((c) => c.id), // Reference all checks in mock mode
      citations: [
        {
          statute: "40 U.S.C. § 3142",
          description: "Prevailing wage requirements",
        },
      ],
      selfConfidence: 0.95, // Mock is deterministic, high confidence
      reasoningTrace: "Mock mode - deterministic reasoning based on findings",
      tokenUsage: 0, // No tokens used in mock mode
      model: "mock",
      timestamp: new Date().toISOString(),
      promptVersion: 2,
      promptKey: "wcp_verdict",
    };

    log.info({ ms: Date.now() - startTime }, "Mock verdict completed");
    return verdict;
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  // Resolve active prompt from registry (falls back to static fallback if DB unavailable)
  const resolvedTemplate = await resolvePromptTemplate("wcp_verdict");
  const systemInstructions = resolvedTemplate?.content ?? STATIC_FALLBACK_INSTRUCTIONS;

  // Build prompt
  const prompt = buildLayer2Prompt(report);

  try {
    // Call LLM via generateText
    // NOTE: Type assertion needed due to ai v4 / @ai-sdk/openai v2 model interface mismatch.
    // In production, pin compatible versions of both packages.
    const maxSteps = parseInt(process.env.AGENT_MAX_STEPS ?? "3", 10);
    log.info({ maxSteps }, "LLM configuration");
    const response = await generateText({
      model: openai(model) as any,
      system: systemInstructions,
      messages: [{ role: "user", content: prompt }],
    });

    // Parse and validate output
    let rawOutput: z.infer<typeof RawLLMOutputSchema>;
    try {
      // Try to parse as JSON first (strip markdown code fences if present)
      const stripped = response.text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();
      const parsed = JSON.parse(stripped);
      rawOutput = RawLLMOutputSchema.parse(parsed);
    } catch {
      // Fallback: try to extract from text using simple heuristics
      log.warn({ traceId: report.traceId }, "Could not parse JSON response, using fallback text extraction");
      rawOutput = extractVerdictFromText(response.text, report);
    }

    // Validate referenced check IDs
    const validation = validateReferencedCheckIds(
      {
        ...rawOutput,
        traceId: report.traceId,
        tokenUsage: response.usage?.totalTokens ?? 0,
        model,
        timestamp: new Date().toISOString(),
      },
      report
    );

    if (!validation.valid) {
      log.warn({ missing: validation.missing }, "Invalid referencedCheckIds - falling back to failed checks");
      // Fallback: reference all failed checks
      rawOutput.referencedCheckIds = report.checks
        .filter((c) => !c.passed)
        .map((c) => c.id);
    }

    // Ensure at least one check is referenced
    if (rawOutput.referencedCheckIds.length === 0) {
      rawOutput.referencedCheckIds = [report.checks[0]?.id ?? "unknown"];
    }

    // Build final verdict
    const verdict: LLMVerdict = {
      traceId: report.traceId,
      status: rawOutput.status,
      rationale: rawOutput.rationale,
      referencedCheckIds: rawOutput.referencedCheckIds,
      citations: rawOutput.citations,
      selfConfidence: rawOutput.selfConfidence,
      reasoningTrace: rawOutput.reasoningTrace,
      tokenUsage: response.usage?.totalTokens ?? 0,
      model,
      timestamp: new Date().toISOString(),
      promptVersion: resolvedTemplate?.version,
      promptKey: resolvedTemplate?.key,
    };

    // Final schema validation
    LLMVerdictSchema.parse(verdict);

    log.info({ ms: Date.now() - startTime, status: verdict.status, selfConfidence: verdict.selfConfidence, promptVersion: verdict.promptVersion }, "Verdict completed");

    return verdict;
  } catch (error) {
    log.error({ traceId: report.traceId, err: error }, "Error generating verdict");

    // Fallback: create a conservative verdict that requires human review
    const fallbackVerdict: LLMVerdict = {
      traceId: report.traceId,
      status: "Reject",
      rationale: `LLM verdict generation failed: ${error instanceof Error ? error.message : "Unknown error"}. Conservatively rejecting pending human review.`,
      referencedCheckIds: report.checks.map((c) => c.id),
      citations: [
        {
          statute: "Error",
          description: "LLM generation failure",
        },
      ],
      selfConfidence: 0.0,
      reasoningTrace: "Fallback due to LLM error",
      tokenUsage: 0,
      model: "error-fallback",
      timestamp: new Date().toISOString(),
    };

    return fallbackVerdict;
  }
}

// ============================================================================
// Fallback Text Extraction
// ============================================================================

/**
 * Extract verdict from unstructured text (fallback when JSON parsing fails)
 *
 * Uses simple heuristics - not perfect but better than crashing.
 */
function extractVerdictFromText(
  text: string,
  report: DeterministicReport
): z.infer<typeof RawLLMOutputSchema> {
  const lowerText = text.toLowerCase();

  // Determine status from keywords — check negated forms first to avoid false Rejects
  const noViolation = lowerText.includes("no violation") || lowerText.includes("no critical") || lowerText.includes("all checks pass");
  let status: "Approved" | "Revise" | "Reject" = "Revise"; // Default conservative
  if (!noViolation && (lowerText.includes("reject") || lowerText.includes("violation"))) {
    status = "Reject";
  } else if (noViolation || lowerText.includes("approved") || lowerText.includes("compliant")) {
    status = "Approved";
  }

  // Extract confidence (look for patterns like "confidence: 0.85" or "85%")
  const confidenceMatch = text.match(/confidence[:\s]+(\d+\.?\d*)/i);
  const selfConfidence = confidenceMatch
    ? Math.min(1, Math.max(0, parseFloat(confidenceMatch[1])))
    : 0.5;

  // Find referenced check IDs (look for check IDs in text)
  // Check IDs follow pattern: {type}_check_{NNN} (e.g., base_wage_check_001, overtime_check_001)
  const checkIdPattern = /[a-z_]*check_\d{3}/gi;
  const foundIds = text.match(checkIdPattern) ?? [];
  const validIds = report.checks.map((c) => c.id.toLowerCase());
  const referencedCheckIds = foundIds
    .map((id) => id.toLowerCase())
    .filter((id) => validIds.includes(id));

  return {
    status,
    rationale: text.slice(0, 500), // First 500 chars as rationale
    referencedCheckIds: referencedCheckIds.length > 0 ? referencedCheckIds : [validIds[0] ?? "unknown"],
    citations: [
      {
        statute: "40 U.S.C. § 3142",
        description: "Prevailing wage requirements",
      },
    ],
    selfConfidence,
    reasoningTrace: text,
  };
}

// ============================================================================
// Exports
// ============================================================================

export { buildLayer2Prompt };
