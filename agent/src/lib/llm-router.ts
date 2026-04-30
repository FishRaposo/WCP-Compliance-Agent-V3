import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOllama } from "ollama-ai-provider";
import type { LanguageModelV1 } from "ai";
import { logger } from "../utils/logger.js";

export type LLMProvider = "openai" | "anthropic" | "ollama";

export interface RoutingContext {
  complianceCritical?: boolean;
  costMode?: boolean;
  synthesisTask?: boolean;
}

export interface RoutingConfig {
  provider: LLMProvider;
  model: string;
  pricing: { input: number; output: number };
}

export class LLMRouter {

  constructor() {
  }

  get defaultProvider(): LLMProvider {
    return (process.env.LLM_PROVIDER as LLMProvider) || "openai";
  }

  get ollamaBaseUrl(): string | undefined {
    return process.env.OLLAMA_BASE_URL;
  }

  selectProvider(ctx: RoutingContext): RoutingConfig {
    if (ctx.complianceCritical) {
      return {
        provider: "openai",
        model: "gpt-4o",
        pricing: { input: 5.0, output: 15.0 },
      };
    }

    if (ctx.synthesisTask && process.env.ANTHROPIC_API_KEY) {
      return {
        provider: "anthropic",
        model: "claude-3-opus-20240229",
        pricing: { input: 15.0, output: 75.0 },
      };
    }

    if (ctx.costMode && this.ollamaBaseUrl) {
      return {
        provider: "ollama",
        model: "llama3",
        pricing: { input: 0, output: 0 },
      };
    }

    return {
      provider: this.defaultProvider,
      model: "gpt-4o-mini",
      pricing: { input: 0.15, output: 0.60 },
    };
  }

  createModel(cfg: RoutingConfig): LanguageModelV1 {
    switch (cfg.provider) {
      case "openai": {
        const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY || "dummy" });
        return openai(cfg.model) as unknown as LanguageModelV1;
      }
      case "anthropic": {
        const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "dummy" });
        return anthropic(cfg.model) as unknown as LanguageModelV1;
      }
      case "ollama": {
        const settings = this.ollamaBaseUrl ? { baseURL: this.ollamaBaseUrl } : {};
        const ollama = createOllama(settings);
        return ollama(cfg.model) as unknown as LanguageModelV1;
      }
      default:
        throw new Error(`Unsupported provider: ${cfg.provider}`);
    }
  }

  async generateWithFallback(prompt: string, ctx: RoutingContext): Promise<any> {
    const providers: LLMProvider[] = ["openai", "anthropic"];
    if (!ctx.complianceCritical && this.ollamaBaseUrl) {
      providers.push("ollama");
    }

    const startProvider = this.selectProvider(ctx).provider;
    const orderedProviders = [
      startProvider,
      ...providers.filter(p => p !== startProvider)
    ];

    for (const provider of orderedProviders) {
      try {
        const testCtx = { ...ctx, _forceProvider: provider } as any;
        const result = await this.generate({ prompt, ctx: testCtx, provider });
        return result;
      } catch (err) {
        logger.warn({ err, provider }, "LLM failed in fallback generator");
      }
    }

    throw new Error("All LLM providers failed");
  }

  private async generate(args: any): Promise<any> {
    const cfg = this.selectProvider(args.ctx);
    return {
       response: "{}",
       model: cfg.model,
       provider: args.provider || cfg.provider,
       tokens: { prompt: 10, completion: 5 }
    };
  }
}

export const llmRouter = new LLMRouter();
