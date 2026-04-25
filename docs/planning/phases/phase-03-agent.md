# Phase 3 — Agent: LLM Orchestration + Observability

**Goal:** Implement the complete TypeScript agent pipeline. Mastra agent receives `ExtractedWCP` + `DeterministicReport`, reasons over findings using the calibrated V2 prompt, calls Python tools, computes trust score, persists decision. Langfuse tracks all prompts and costs. **Mock mode must work without any OpenAI key.**

---

## Exit Criteria (Hard Gate)

```bash
cd agent
npm ci
npm run typecheck  # 0 errors
npm test           # 0 failures

# Mock mode E2E (no OpenAI key required):
OPENAI_API_KEY=mock npm run dev &
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Role: Electrician, Hours: 40, Wage: 51.69, Fringe: 34.63"}'
# → Must return TrustScoredDecision JSON with trust_score, trust_band, verdict, citations
```

**Do not proceed to Phase 4 until mock-mode E2E returns a valid `TrustScoredDecision`.**

---

## Goals

1. Implement Mastra tools (Python API callers)
2. Port and implement the verdict prompt
3. Implement the Mastra verdict agent
4. Implement mock mode
5. Implement the full pipeline workflow
6. Implement Langfuse integration
7. Wire the API routes
8. Write agent tests

---

## Task Breakdown

### 3.1 — Mastra Tools (Python API Callers)

**Destination:** `agent/src/mastra/tools/`

All tools call the Python backend via typed HTTP client.

**`extract.ts`:**
```typescript
import { createTool } from "@mastra/core";
import { z } from "zod";
import { httpClient } from "../../utils/http-client.js";
import { ExtractedWCPSchema } from "../../types/index.js";

export const extractTool = createTool({
  id: "extract-wcp",
  description: "Extract structured data from WH-347 text or PDF",
  inputSchema: z.object({
    text: z.string().optional(),
    pdfBase64: z.string().optional()
  }),
  outputSchema: ExtractedWCPSchema,
  execute: async ({ context }) => {
    if (context.text) {
      return await httpClient.post("/extract", { text: context.text });
    }
    // Handle PDF case...
    throw new Error("Either text or pdfBase64 required");
  }
});
```

**`validate.ts`:**
```typescript
export const validateTool = createTool({
  id: "validate-wcp",
  description: "Run deterministic compliance checks on extracted WCP data",
  inputSchema: ExtractedWCPSchema,
  outputSchema: DeterministicReportSchema,
  execute: async ({ context }) => {
    return await httpClient.post("/validate", context);
  }
});
```

**`dbwd_lookup.ts`:**
```typescript
export const dbwdLookupTool = createTool({
  id: "lookup-dbwd-rate",
  description: "Get Davis-Bacon Wage Determination rate for a trade and locality",
  inputSchema: z.object({
    trade: z.string(),
    locality: z.string(),
    effectiveDate: z.string()  // YYYY-MM-DD
  }),
  outputSchema: DBWDRateRecordSchema,
  execute: async ({ context }) => {
    const { trade, locality, effectiveDate } = context;
    return await httpClient.get(`/dbwd/${encodeURIComponent(trade)}/${encodeURIComponent(locality)}/${effectiveDate}`);
  }
});
```

**`search.ts`:**
```typescript
export const searchTool = createTool({
  id: "search-regulations",
  description: "Search DBWD regulations using hybrid RAG (BM25 + vector + reranking)",
  inputSchema: z.object({
    query: z.string(),
    trade: z.string().optional(),
    locality: z.string().optional(),
    topK: z.number().default(5)
  }),
  outputSchema: z.array(RegulationChunkSchema),
  execute: async ({ context }) => {
    return await httpClient.post("/search", context);
  }
});
```

**`persist.ts`:**
```typescript
export const persistTool = createTool({
  id: "persist-decision",
  description: "Persist a TrustScoredDecision to the audit database",
  inputSchema: TrustScoredDecisionSchema,
  outputSchema: z.object({ status: z.string(), jobId: z.string() }),
  execute: async ({ context }) => {
    return await httpClient.post("/decisions", context);
  }
});
```

**`job_status.ts`:**
```typescript
export const jobStatusTool = createTool({
  id: "get-job-status",
  description: "Get the status of an async batch processing job",
  inputSchema: z.object({ jobId: z.string() }),
  outputSchema: JobStatusSchema,
  execute: async ({ context }) => {
    return await httpClient.get(`/jobs/${context.jobId}`);
  }
});
```

**Error handling:** Each tool must catch Python API errors and wrap in typed `AgentError`:
```typescript
import { AgentError } from "../../utils/errors.js";

try {
  return await httpClient.post("/extract", { text });
} catch (err) {
  throw new AgentError(`Extraction failed: ${err.message}`, "EXTRACTION_FAILED", { cause: err });
}
```

---

### 3.2 — Port Verdict Prompt

**Source:** `_archive/src/prompts/versions/wcp-verdict-v2.ts`
**Destination:** `agent/src/prompts/versions/wcp-verdict-v2.ts`

Copy the V2 prompt **without modification**. The prompt must contain:

```typescript
export const WCP_VERDICT_V2 = `
You are a Davis-Bacon Act compliance expert analyzing a Weekly Certified Payroll (WH-347 form).

## Input
- ExtractedWCP: Structured data extracted from the form
- DeterministicReport: Compliance check results from deterministic validation

## Your Task
Review the deterministic findings and produce a final compliance verdict.

## Constraints
1. You MUST NOT recompute any findings. Use only the provided DeterministicReport.
2. You MUST reference specific check IDs from DeterministicReport.checks in your reasoning.
3. Your verdict must be one of: APPROVED, REJECTED, REVISE

## Output Format
{
  "verdict": "APPROVED|REJECTED|REVISE",
  "reasoning": "string explaining your decision, citing specific check IDs",
  "citations": [
    {"regulation": "40 U.S.C. § 3142", "section": "", "text": "relevant text"}
  ],
  "confidence": 0.0-1.0,
  "referencedCheckIds": ["check_id_1", "check_id_2"]
}

## ExtractedWCP
{{extractedWcp}}

## DeterministicReport
{{deterministicReport}}
`;
```

**Register in `agent/src/prompts/registry.ts`:**
```typescript
import { WCP_VERDICT_V2 } from "./versions/wcp-verdict-v2.js";

export const PROMPT_REGISTRY = {
  "wcp-verdict": {
    versions: {
      "v2": WCP_VERDICT_V2
    },
    defaultVersion: "v2"
  }
};

export function getPrompt(name: string, version?: string): string {
  const prompt = PROMPT_REGISTRY[name];
  if (!prompt) throw new Error(`Unknown prompt: ${name}`);
  const v = version || prompt.defaultVersion;
  return prompt.versions[v];
}
```

---

### 3.3 — Mastra Verdict Agent

**Destination:** `agent/src/mastra/agents/wcp-verdict.ts`

```typescript
import { Agent } from "@mastra/core";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { getPrompt } from "../../prompts/registry.js";
import { validateTool, dbwdLookupTool, searchTool } from "../tools/index.js";
import { LLMVerdictSchema, type LLMVerdict, type DeterministicReport, type ExtractedWCP } from "../../types/index.js";
import { config } from "../../config.js";
import { generateMockVerdict } from "./mock-verdict.js";

const LLMVerdictOutputSchema = z.object({
  verdict: z.enum(["APPROVED", "REJECTED", "REVISE"]),
  reasoning: z.string(),
  citations: z.array(z.object({
    regulation: z.string(),
    section: z.string().optional(),
    text: z.string()
  })),
  confidence: z.number().min(0).max(1),
  referencedCheckIds: z.array(z.string())
});

export async function runVerdictAgent(
  extracted: ExtractedWCP,
  deterministicReport: DeterministicReport
): Promise<LLMVerdict> {
  // Mock mode: skip LLM call
  if (config.isMockMode) {
    return generateMockVerdict(extracted, deterministicReport);
  }

  const prompt = getPrompt("wcp-verdict")
    .replace("{{extractedWcp}}", JSON.stringify(extracted, null, 2))
    .replace("{{deterministicReport}}", JSON.stringify(deterministicReport, null, 2));

  const agent = new Agent({
    name: "WCP Verdict Agent",
    instructions: prompt,
    model: openai(config.openaiModel),
    tools: { validateTool, dbwdLookupTool, searchTool }
  });

  try {
    const result = await agent.generate(prompt, {
      output: LLMVerdictOutputSchema
    });
    
    return {
      jobId: extracted.jobId,
      verdict: result.object.verdict as LLMVerdict["verdict"],
      reasoning: result.object.reasoning,
      citations: result.object.citations,
      confidence: result.object.confidence,
      referencedCheckIds: result.object.referencedCheckIds,
      ragContextUsed: result.toolCalls && result.toolCalls.length > 0,
      model: config.openaiModel,
      promptVersion: "v2",
      langfuseTraceId: "",  // set by Langfuse wrapper
      tokenUsage: {
        promptTokens: result.usage?.promptTokens || 0,
        completionTokens: result.usage?.completionTokens || 0,
        totalTokens: result.usage?.totalTokens || 0
      }
    };
  } catch (err) {
    // Fallback: parse text output if JSON parsing fails
    return _fallbackParse(err, extracted, deterministicReport);
  }
}

function _fallbackParse(error: unknown, extracted: ExtractedWCP, report: DeterministicReport): LLMVerdict {
  // Port from _archive/src/pipeline/layer2-llm-verdict.ts
  // Return low-confidence verdict requiring human review
  return {
    jobId: extracted.jobId,
    verdict: "REVISE",
    reasoning: `LLM output parsing failed: ${error}. Deterministic report shows ${report.violationCount} violations. Human review required.`,
    citations: [],
    confidence: 0.3,
    referencedCheckIds: [],
    ragContextUsed: false,
    model: config.openaiModel,
    promptVersion: "v2",
    langfuseTraceId: "",
    tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  };
}
```

---

### 3.4 — Mock Mode

**Destination:** `agent/src/config.ts` + `agent/src/mastra/agents/mock-verdict.ts`

**Update `config.ts`:**
```typescript
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const configSchema = z.object({
  PORT: z.string().default("3000"),
  BACKEND_URL: z.string().default("http://localhost:8000"),
  OPENAI_API_KEY: z.string(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_HOST: z.string().default("https://cloud.langfuse.com"),
  PHOENIX_COLLECTOR_ENDPOINT: z.string().optional()
});

export const config = {
  ...configSchema.parse(process.env),
  get isMockMode(): boolean {
    return process.env.OPENAI_API_KEY === "mock";
  }
};
```

**Implement `mock-verdict.ts`:**
```typescript
import type { LLMVerdict, ExtractedWCP, DeterministicReport } from "../../types/index.js";

export function generateMockVerdict(
  extracted: ExtractedWCP,
  deterministicReport: DeterministicReport
): LLMVerdict {
  const hasViolations = deterministicReport.violationCount > 0;
  
  return {
    jobId: extracted.jobId,
    verdict: hasViolations ? "REJECTED" : "APPROVED",
    reasoning: hasViolations 
      ? `Deterministic validation found ${deterministicReport.violationCount} violation(s). Mock verdict: REJECTED.`
      : "All deterministic checks passed. Mock verdict: APPROVED.",
    citations: hasViolations 
      ? [{ regulation: "40 U.S.C. § 3142", text: "Prevailing wage requirement" }]
      : [],
    confidence: hasViolations ? 0.9 : 0.95,
    referencedCheckIds: deterministicReport.checks.map(c => c.checkId),
    ragContextUsed: false,
    model: "mock",
    promptVersion: "v2",
    langfuseTraceId: "mock-trace",
    tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  };
}
```

---

### 3.5 — Full Pipeline Workflow

**Destination:** `agent/src/mastra/workflows/wcp-pipeline.ts`

```typescript
import { extractTool, validateTool, persistTool } from "../tools/index.js";
import { runVerdictAgent } from "../agents/wcp-verdict.js";
import { computeTrustScore, determineTrustBand } from "../lib/trust-score.js";
import { trace, context as otelContext } from "@opentelemetry/api";
import type { TrustScoredDecision, ExtractedWCP, DeterministicReport, LLMVerdict } from "../../types/index.js";

export async function runWCPPipeline(text: string): Promise<TrustScoredDecision> {
  const tracer = trace.getTracer("wcp-agent");
  const span = tracer.startSpan("wcp-pipeline");
  
  try {
    // Step 1: Extract
    span.setAttribute("step", "extract");
    const extracted: ExtractedWCP = await extractTool.execute({ context: { text } });
    
    // Step 2: Validate (deterministic)
    span.setAttribute("step", "validate");
    const deterministicReport: DeterministicReport = await validateTool.execute({ context: extracted });
    
    // Step 3: LLM Verdict
    span.setAttribute("step", "verdict");
    const llmVerdict: LLMVerdict = await runVerdictAgent(extracted, deterministicReport);
    
    // Step 4: Trust Score
    span.setAttribute("step", "trust-score");
    const trustScore = computeTrustScore(deterministicReport, llmVerdict);
    const trustBand = determineTrustBand(trustScore);
    
    // Step 5: Build Decision
    const decision: TrustScoredDecision = {
      jobId: extracted.jobId,
      verdict: llmVerdict.verdict,
      trustScore,
      trustBand,
      requiresHumanReview: trustBand === "REQUIRE_HUMAN_REVIEW" || trustBand === "FLAG_FOR_REVIEW",
      violationCount: deterministicReport.violationCount,
      warningCount: deterministicReport.warningCount,
      llmConfidence: llmVerdict.confidence,
      reasoningSummary: llmVerdict.reasoning.slice(0, 500),  // truncate
      citations: llmVerdict.citations,
      costUsd: null,  // set by Langfuse
      latencyMs: Date.now() - startTime,
      phoenixTraceId: span.spanContext().traceId,
      createdAt: new Date()
    };
    
    // Step 6: Persist
    span.setAttribute("step", "persist");
    await persistTool.execute({ context: decision });
    
    span.setStatus({ code: 0 });  // OK
    return decision;
    
  } catch (err) {
    span.recordException(err);
    span.setStatus({ code: 2, message: err.message });  // ERROR
    throw err;
  } finally {
    span.end();
  }
}
```

**Port trust score to TypeScript (`agent/src/lib/trust-score.ts`):**
```typescript
import type { DeterministicReport, LLMVerdict } from "../types/index.js";

export function computeTrustScore(deterministic: DeterministicReport, llmVerdict: LLMVerdict): number {
  const violationRatio = deterministic.violationCount / Math.max(deterministic.checks.length, 1);
  const deterministicScore = 1.0 - violationRatio;
  
  // Phase 1: hardcode classification confidence
  const classificationScore = 0.95;
  
  const components = {
    deterministic: 0.35 * deterministicScore,
    classification: 0.25 * classificationScore,
    llmSelf: 0.20 * llmVerdict.confidence,
    agreement: 0.20 * computeAgreement(deterministic, llmVerdict)
  };
  
  return Object.values(components).reduce((a, b) => a + b, 0);
}

function computeAgreement(deterministic: DeterministicReport, llmVerdict: LLMVerdict): number {
  const hasViolations = deterministic.violationCount > 0;
  const llmApproved = llmVerdict.verdict === "APPROVED";
  
  if (hasViolations && llmApproved) return 0.0;
  if (!hasViolations && llmApproved) return 1.0;
  return 0.5;
}

export function determineTrustBand(score: number): "AUTO_APPROVE" | "FLAG_FOR_REVIEW" | "REQUIRE_HUMAN_REVIEW" {
  if (score >= 0.85) return "AUTO_APPROVE";
  if (score >= 0.60) return "FLAG_FOR_REVIEW";
  return "REQUIRE_HUMAN_REVIEW";
}
```

---

### 3.6 — Langfuse Integration

**Destination:** `agent/src/langfuse/`

**`client.ts`:**
```typescript
import { Langfuse } from "langfuse";
import { config } from "../config.js";

let client: Langfuse | null = null;

export function getLangfuse(): Langfuse | null {
  if (!config.LANGFUSE_PUBLIC_KEY) return null;
  if (!client) {
    client = new Langfuse({
      publicKey: config.LANGFUSE_PUBLIC_KEY,
      secretKey: config.LANGFUSE_SECRET_KEY!,
      baseUrl: config.LANGFUSE_HOST
    });
  }
  return client;
}
```

**`tracing.ts`:**
```typescript
import { getLangfuse } from "./client.js";

export function createTrace(jobId: string, metadata: object) {
  const langfuse = getLangfuse();
  if (!langfuse) return null;
  
  return langfuse.trace({
    id: jobId,
    name: "wcp-analysis",
    metadata
  });
}

export function logGeneration(trace: any, model: string, prompt: string, output: string, tokens: object) {
  const langfuse = getLangfuse();
  if (!langfuse || !trace) return;
  
  trace.generation({
    name: "wcp-verdict",
    model,
    input: prompt,
    output,
    usage: tokens
  });
}
```

**`cost_tracking.ts`:**
```typescript
const PRICING = {
  "gpt-4o": { input: 0.005, output: 0.015 },  // per 1K tokens
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "claude-sonnet-3-5": { input: 0.003, output: 0.015 },
  "mock": { input: 0, output: 0 }
};

export function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = PRICING[model] || PRICING["gpt-4o"];
  return (promptTokens * pricing.input + completionTokens * pricing.output) / 1000;
}
```

---

### 3.7 — Wire API Routes

**Update `agent/src/api/analyze.ts`:**
```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { runWCPPipeline } from "../mastra/workflows/wcp-pipeline.js";

const router = new Hono();

const analyzeSchema = z.object({
  text: z.string().min(1)
});

router.post("/", zValidator("json", analyzeSchema), async (c) => {
  const { text } = c.req.valid("json");
  const decision = await runWCPPipeline(text);
  return c.json(decision);
});

export { router as analyze };
```

**Update `analyze-pdf.ts`:**
```typescript
router.post("/", async (c) => {
  const body = await c.req.parseBody();
  const file = body.file as File;
  
  if (!file) return c.json({ error: "No file uploaded" }, 400);
  
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  
  // Send to Python backend for extraction
  const extracted = await httpClient.post("/extract", { pdfBase64: base64 });
  
  // Continue with pipeline...
  const decision = await runWCPPipelineFromExtracted(extracted);
  return c.json(decision);
});
```

---

### 3.8 — Agent Tests

**Destination:** `agent/src/tests/`

**`unit/tools.test.ts`:**
```typescript
import { describe, it, expect, vi } from "vitest";
import { extractTool } from "../../mastra/tools/extract.js";
import { httpClient } from "../../utils/http-client.js";

vi.mock("../../utils/http-client.js");

describe("extractTool", () => {
  it("calls backend /extract endpoint with text", async () => {
    const mockResponse = { jobId: "test-123", employees: [] };
    vi.mocked(httpClient.post).mockResolvedValue(mockResponse);
    
    const result = await extractTool.execute({ context: { text: "Role: Electrician" } });
    
    expect(result.jobId).toBe("test-123");
  });
});
```

**`unit/prompts.test.ts`:**
```typescript
describe("wcp-verdict-v2 prompt", () => {
  it("contains referencedCheckIds constraint", () => {
    const prompt = getPrompt("wcp-verdict", "v2");
    expect(prompt).toContain("referencedCheckIds");
    expect(prompt).toContain("MUST NOT recompute");
  });
});
```

**`integration/pipeline.test.ts`:**
```typescript
describe("runWCPPipeline mock mode", () => {
  it("returns TrustScoredDecision without OpenAI call", async () => {
    process.env.OPENAI_API_KEY = "mock";
    
    const decision = await runWCPPipeline("Role: Electrician, Hours: 40, Wage: 51.69");
    
    expect(decision.jobId).toBeDefined();
    expect(decision.trustScore).toBeGreaterThan(0);
    expect(decision.trustBand).toMatch(/AUTO_APPROVE|FLAG_FOR_REVIEW|REQUIRE_HUMAN_REVIEW/);
  });
});
```

**Minimum: 15 tests**

---

## Architecture Notes

### The LLM Must NOT Recompute Findings
The prompt constraint `referencedCheckIds` is enforced by Zod schema validation. If the LLM returns a verdict without referencing any check IDs, the response is rejected.

### Trust Score Computed in TypeScript
The formula uses both Python outputs (deterministic report) and LLM outputs (verdict confidence). It lives in the agent to avoid a round-trip to Python.

### Langfuse Is Optional Infrastructure
If `LANGFUSE_PUBLIC_KEY` is not set, the client no-ops. The pipeline continues without tracing. Never throw on missing Langfuse config.

### Mastra Tool Descriptions Must Be Precise
The LLM uses the `description` field to decide when to call each tool. Vague descriptions cause incorrect tool invocations.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Mastra version API changes | Medium | High | Pin `mastra` version in `package.json`. Use `npm ci`. |
| LLM returns non-JSON output | Medium | Medium | Implement fallback text extraction. Log failures to Phoenix. Return low-confidence verdict with `requiresHumanReview: true`. |
| Langfuse cloud rate limiting in CI | Low | Low | Disable Langfuse in CI with empty `LANGFUSE_PUBLIC_KEY`. |
| Python backend not running during tests | Medium | Medium | Use mock Python server in integration tests. |

---

## Command Reference

```bash
# Install dependencies
cd agent && npm ci

# Type check
npm run typecheck

# Run tests
npm test

# Start in mock mode
OPENAI_API_KEY=mock npm run dev

# Test mock endpoint
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Role: Electrician, Hours: 40, Wage: 51.69"}'

# Start with real LLM (requires OPENAI_API_KEY)
npm run dev
```

---

*Phase 3 document version: 2026-04-22*
*Blocked by: Phase 2 integration tests passing*
