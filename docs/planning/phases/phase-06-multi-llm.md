# Phase 6 — V3.1: Multi-LLM Routing

**Goal:** Make the LLM layer model-agnostic. A routing layer selects provider based on cost mode (Ollama), compliance-critical path (GPT-4o), synthesis/drafting (Claude Sonnet). Provider failure triggers automatic fallback chain. Provider can be changed via environment variable without code changes.

---

## Exit Criteria (Hard Gate)

```bash
cd agent
npm ci
npm run typecheck  # 0 errors
npm test           # 0 failures

# GPT-4o default:
OPENAI_API_KEY=real_key npm run dev &
curl -X POST http://localhost:3000/api/analyze \
  -d '{"text":"Role: Electrician, Hours: 40, Wage: 51.69"}' | jq '.model'
# → "gpt-4o"

# Force Claude:
LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=real_key npm run dev &
curl -X POST http://localhost:3000/api/analyze \
  -d '{"text":"Role: Electrician, Hours: 40, Wage: 51.69"}' | jq '.model'
# → "claude-sonnet-3-5"

# Local Ollama:
LLM_PROVIDER=ollama OLLAMA_BASE_URL=http://localhost:11434 npm run dev &
curl -X POST http://localhost:3000/api/analyze \
  -d '{"text":"Role: Electrician, Hours: 40, Wage: 51.69"}' | jq '.model'
# → "llama3.2"

# Fallback test (Ollama unavailable):
LLM_PROVIDER=ollama OLLAMA_BASE_URL=http://fake:11434 npm run dev &
curl -X POST http://localhost:3000/api/analyze \
  -d '{"text":"Role: Electrician, Hours: 40, Wage: 51.69"}'
# → Should succeed with fallback to GPT-4o-mini
```

**Do not declare Phase 6 complete until all provider switches work via env var and fallback activates correctly.**

---

## Goals

1. Provider configuration system
2. Routing logic with context awareness
3. Wire router into Mastra agent
4. Add Anthropic + Ollama dependencies
5. Update Langfuse cost tracking
6. Add V3.1 routing tests
7. Run full golden set regression

---

## Task Breakdown

### 6.1 — Provider Configuration

**Destination:** `agent/src/lib/provider-config.ts`

```typescript
export type Provider = "openai" | "anthropic" | "ollama";

export interface ModelConfig {
  provider: Provider;
  model: string;
  baseUrl?: string;
  apiKey: string;
  maxTokens: number;
  temperature: number;
  // Pricing per 1K tokens (for cost tracking)
  pricing: {
    input: number;
    output: number;
  };
}

export const PROVIDER_CONFIGS: Record<Provider, ModelConfig> = {
  openai: {
    provider: "openai",
    model: process.env.OPENAI_MODEL || "gpt-4o",
    apiKey: process.env.OPENAI_API_KEY || "",
    maxTokens: 4000,
    temperature: 0.1,  // Low temp for deterministic compliance
    pricing: { input: 0.005, output: 0.015 }  // GPT-4o
  },
  anthropic: {
    provider: "anthropic",
    model: "claude-sonnet-3-5-20241022",
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    maxTokens: 4000,
    temperature: 0.1,
    pricing: { input: 0.003, output: 0.015 }
  },
  ollama: {
    provider: "ollama",
    model: process.env.OLLAMA_MODEL || "llama3.2",
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    apiKey: "ollama",  // Ollama doesn't require auth
    maxTokens: 4000,
    temperature: 0.1,
    pricing: { input: 0, output: 0 }  // Free local inference
  }
};

export function getProviderConfig(provider?: Provider): ModelConfig {
  const selected = provider || (process.env.LLM_PROVIDER as Provider) || "openai";
  
  if (selected === "ollama" && !process.env.OLLAMA_BASE_URL) {
    throw new Error("OLLAMA_BASE_URL required for Ollama provider");
  }
  
  return PROVIDER_CONFIGS[selected];
}
```

---

### 6.2 — Routing Logic

**Destination:** `agent/src/lib/llm-router.ts`

```typescript
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { createOllama } from "ollama-ai-provider";
import { type LanguageModel } from "ai";
import { getProviderConfig, type Provider, type ModelConfig } from "./provider-config.js";
import { logger } from "../utils/logger.js";

export interface RoutingContext {
  /** If true, use cheapest available (Ollama) */
  costMode?: boolean;
  /** If true, use highest accuracy (GPT-4o, never Ollama) */
  complianceCritical?: boolean;
  /** If true, use Claude (good synthesis quality) */
  synthesisTask?: boolean;
}

export class LLMRouter {
  private fallbackChain: Provider[] = ["openai", "anthropic", "ollama"];
  
  selectProvider(context: RoutingContext): ModelConfig {
    // Hard constraint: compliance-critical never uses Ollama
    if (context.complianceCritical) {
      return getProviderConfig("openai");
    }
    
    // Cost mode: use Ollama if available
    if (context.costMode) {
      try {
        return getProviderConfig("ollama");
      } catch {
        logger.warn("Ollama not configured, falling back to OpenAI");
      }
    }
    
    // Synthesis tasks: prefer Claude
    if (context.synthesisTask) {
      const anthropicConfig = getProviderConfig("anthropic");
      if (anthropicConfig.apiKey) {
        return anthropicConfig;
      }
    }
    
    // Default: env var or OpenAI
    return getProviderConfig();
  }
  
  async generateWithFallback(
    prompt: string,
    context: RoutingContext,
    maxRetries: number = 2
  ): Promise<{ response: string; model: string; tokens: { prompt: number; completion: number } }> {
    const primary = this.selectProvider(context);
    
    try {
      return await this.generate(primary, prompt);
    } catch (error) {
      logger.warn({ error, provider: primary.provider }, "Primary LLM failed, trying fallback");
      
      // Try fallback chain (never fall back to Ollama for compliance-critical)
      const fallbacks = context.complianceCritical 
        ? ["openai", "anthropic"]  // Never Ollama
        : this.fallbackChain;
      
      for (const fallbackProvider of fallbacks) {
        if (fallbackProvider === primary.provider) continue;
        
        try {
          const config = getProviderConfig(fallbackProvider);
          return await this.generate(config, prompt);
        } catch (fallbackError) {
          logger.warn({ error: fallbackError, provider: fallbackProvider }, "Fallback failed");
          continue;
        }
      }
      
      // All providers failed
      throw new Error("All LLM providers failed");
    }
  }
  
  private async generate(
    config: ModelConfig,
    prompt: string
  ): Promise<{ response: string; model: string; tokens: { prompt: number; completion: number } }> {
    const model = this.createModel(config);
    
    // Use Vercel AI SDK's generateText
    const { text, usage } = await generateText({
      model,
      prompt,
      maxTokens: config.maxTokens,
      temperature: config.temperature
    });
    
    return {
      response: text,
      model: config.model,
      tokens: {
        prompt: usage.promptTokens,
        completion: usage.completionTokens
      }
    };
  }
  
  private createModel(config: ModelConfig): LanguageModel {
    switch (config.provider) {
      case "openai":
        return openai(config.model, { apiKey: config.apiKey });
      case "anthropic":
        return anthropic(config.model, { apiKey: config.apiKey });
      case "ollama":
        const ollama = createOllama({ baseURL: config.baseUrl });
        return ollama(config.model);
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }
}

// Singleton instance
export const llmRouter = new LLMRouter();
```

---

### 6.3 — Wire Router Into Mastra Agent

**Update `agent/src/mastra/agents/wcp-verdict.ts`:**

```typescript
import { llmRouter, type RoutingContext } from "../../lib/llm-router.js";
import { type DeterministicReport } from "../../types/index.js";

export async function runVerdictAgent(
  extracted: ExtractedWCP,
  deterministicReport: DeterministicReport
): Promise<LLMVerdict> {
  if (config.isMockMode) {
    return generateMockVerdict(extracted, deterministicReport);
  }

  const prompt = getPrompt("wcp-verdict")
    .replace("{{extractedWcp}}", JSON.stringify(extracted, null, 2))
    .replace("{{deterministicReport}}", JSON.stringify(deterministicReport, null, 2));

  // Determine routing context from deterministic report
  const routingContext: RoutingContext = {
    complianceCritical: deterministicReport.violationCount > 0,
    // Could add synthesisTask flag based on input complexity
  };

  try {
    const { response, model, tokens } = await llmRouter.generateWithFallback(
      prompt,
      routingContext
    );
    
    // Parse response (same as before, but now with model info)
    const parsed = LLMVerdictOutputSchema.parse(JSON.parse(response));
    
    return {
      jobId: extracted.jobId,
      verdict: parsed.verdict as LLMVerdict["verdict"],
      reasoning: parsed.reasoning,
      citations: parsed.citations,
      confidence: parsed.confidence,
      referencedCheckIds: parsed.referencedCheckIds,
      ragContextUsed: false,  // Tools would set this
      model,  // Now dynamic based on provider
      promptVersion: "v2",
      langfuseTraceId: "",
      tokenUsage: {
        promptTokens: tokens.prompt,
        completionTokens: tokens.completion,
        totalTokens: tokens.prompt + tokens.completion
      }
    };
  } catch (error) {
    return _fallbackParse(error, extracted, deterministicReport);
  }
}
```

---

### 6.4 — Add Anthropic + Ollama Dependencies

```bash
cd agent

# Add providers
npm install @ai-sdk/anthropic ollama-ai-provider

# Verify package.json has:
# "@ai-sdk/anthropic": "^0.x.x",
# "ollama-ai-provider": "^0.x.x"
```

Update `tsconfig.json` if needed (usually not required for these packages).

---

### 6.5 — Update Langfuse Cost Tracking

**Update `agent/src/langfuse/cost_tracking.ts`:**

```typescript
const PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  "gpt-4o": { input: 0.005, output: 0.015 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  
  // Anthropic
  "claude-sonnet-3-5-20241022": { input: 0.003, output: 0.015 },
  "claude-opus-20240229": { input: 0.015, output: 0.075 },
  
  // Ollama (free local inference)
  "llama3.2": { input: 0, output: 0 },
  "mistral": { input: 0, output: 0 }
};

export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = PRICING[model] || PRICING["gpt-4o"];
  return (promptTokens * pricing.input + completionTokens * pricing.output) / 1000;
}

export function logProviderCost(
  langfuse: Langfuse | null,
  traceId: string,
  provider: string,
  model: string,
  tokens: { prompt: number; completion: number }
) {
  const cost = calculateCost(model, tokens.prompt, tokens.completion);
  
  if (langfuse) {
    langfuse.trace({
      id: traceId,
      metadata: {
        provider,
        model,
        costUsd: cost,
        promptTokens: tokens.prompt,
        completionTokens: tokens.completion
      }
    });
  }
  
  return cost;
}
```

---

### 6.6 — Add V3.1 Routing Tests

**Destination:** `agent/src/tests/unit/llm-router.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LLMRouter, type RoutingContext } from "../../lib/llm-router.js";

describe("LLMRouter", () => {
  let router: LLMRouter;
  
  beforeEach(() => {
    router = new LLMRouter();
    vi.resetModules();
  });
  
  describe("selectProvider", () => {
    it("selects OpenAI for compliance-critical contexts", () => {
      const context: RoutingContext = { complianceCritical: true };
      const config = router.selectProvider(context);
      
      expect(config.provider).toBe("openai");
    });
    
    it("selects Ollama for cost mode when configured", () => {
      process.env.OLLAMA_BASE_URL = "http://localhost:11434";
      process.env.LLM_PROVIDER = "ollama";
      
      const context: RoutingContext = { costMode: true };
      const config = router.selectProvider(context);
      
      expect(config.provider).toBe("ollama");
      expect(config.pricing.input).toBe(0);
      
      delete process.env.OLLAMA_BASE_URL;
      delete process.env.LLM_PROVIDER;
    });
    
    it("falls back to OpenAI when Ollama not configured", () => {
      delete process.env.OLLAMA_BASE_URL;
      const context: RoutingContext = { costMode: true };
      
      // Should not throw, should fallback
      expect(() => router.selectProvider(context)).not.toThrow();
    });
    
    it("never selects Ollama for compliance-critical", () => {
      process.env.OLLAMA_BASE_URL = "http://localhost:11434";
      
      const context: RoutingContext = { 
        complianceCritical: true,
        costMode: true  // Even with cost mode
      };
      const config = router.selectProvider(context);
      
      expect(config.provider).not.toBe("ollama");
      
      delete process.env.OLLAMA_BASE_URL;
    });
  });
  
  describe("generateWithFallback", () => {
    it("activates fallback on primary failure", async () => {
      // Mock primary to fail
      vi.spyOn(router as any, "generate")
        .mockRejectedValueOnce(new Error("Primary failed"))
        .mockResolvedValueOnce({
          response: '{"verdict": "APPROVED"}',
          model: "gpt-4o-fallback",
          tokens: { prompt: 100, completion: 50 }
        });
      
      const result = await router.generateWithFallback(
        "test prompt",
        { costMode: true }
      );
      
      expect(result.model).toBe("gpt-4o-fallback");
    });
    
    it("throws after all providers fail", async () => {
      vi.spyOn(router as any, "generate").mockRejectedValue(new Error("All failed"));
      
      await expect(
        router.generateWithFallback("test", {})
      ).rejects.toThrow("All LLM providers failed");
    });
  });
});
```

**Minimum: 8 routing tests**

---

### 6.7 — Golden Set Regression

Run the full golden set to ensure V3.1 changes don't break anything:

```bash
cd backend

# Ensure all services running
docker-compose up -d

# Run migrations and seed
poetry run alembic upgrade head
poetry run python scripts/seed_dbwd.py

# Run golden set with real LLM (uses whatever provider is configured)
OPENAI_API_KEY=real_key poetry run pytest tests/eval/ --benchmark-only -v

# Regression check
poetry run python tests/eval/regression_test.py
```

**Expected:** 0 regressions. If any example drifts, investigate the routing decision — the LLM verdict is the most likely cause.

---

## Architecture Notes

### Compliance-Critical = Never Local
`REQUIRE_HUMAN_REVIEW` decisions (violation count > 0) must use a cloud model. This is hardcoded in `selectProvider()` — not a configuration option. This ensures federal compliance decisions never rely on local inference that might be hallucinated.

### Ollama Is For Development, Not Production
The Docker Compose does not include Ollama. Developers install it locally. Document setup in `docs/local-dev.md`:

```bash
# Install Ollama
brew install ollama  # macOS
ollama pull llama3.2

# Run with Ollama
LLM_PROVIDER=ollama npm run dev
```

### Vercel AI SDK Abstracts Provider Differences
All three providers use the same `generateText()` interface. The router only needs to swap the model instance. This is the key architectural benefit — provider switching without code changes.

### This Is A Capability Demonstration, Not Cost Optimization
V3.1 shows model-agnostic architecture. Real cost optimization (contract-level model selection, batch pricing) is V4 scope.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Anthropic returns different JSON structure than OpenAI | Medium | High | Zod output validation catches schema mismatches. Add provider-specific normalization if needed. |
| Ollama model produces hallucinated check IDs | High | Medium | Post-call validation rejects verdicts with non-existent check IDs. Log to Phoenix for analysis. |
| Fallback loop (OpenAI also fails) | Low | High | After 2 fallback attempts, return `low-confidence verdict` with `requiresHumanReview: true`. Never throw to caller. |
| Ollama not installed on developer machine | Medium | Low | Document Ollama setup. Fallback to OpenAI automatically if Ollama unreachable. |

---

## Command Reference

```bash
# Install new dependencies
cd agent && npm install

# Type check
npm run typecheck

# Test routing
npm test -- src/tests/unit/llm-router.test.ts

# Test with different providers
LLM_PROVIDER=openai npm run dev
LLM_PROVIDER=anthropic npm run dev  
LLM_PROVIDER=ollama OLLAMA_BASE_URL=http://localhost:11434 npm run dev

# Golden set regression
cd backend && poetry run pytest tests/eval/ --benchmark-only
```

---

*Phase 6 document version: 2026-04-22*
*Blocked by: Phase 5 CI green + eval passing*
