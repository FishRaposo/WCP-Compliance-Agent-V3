import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { createOllama } from "ollama-ai-provider";
import { generateText } from "ai";
import type { LanguageModelV1 } from "@ai-sdk/provider";
import { config } from "../config.js";
import { logger as log } from "../utils/logger.js";

export type RoutingContext = {
  complianceCritical?: boolean;
  costMode?: boolean;
  synthesisTask?: boolean;
};

export type LLMConfig = {
  provider: string;
  model: string;
};

export class LLMRouter {
  private getOllama() {
    return createOllama({ baseURL: config.OLLAMA_BASE_URL || "http://localhost:11434" });
  }

  selectProvider(context: RoutingContext): LLMConfig {
    if (context.complianceCritical) {
      return { provider: "openai", model: "gpt-4o" };
    }

    if (context.costMode && config.OLLAMA_BASE_URL) {
      return { provider: "ollama", model: config.OLLAMA_MODEL };
    }

    if (context.synthesisTask && config.ANTHROPIC_API_KEY) {
      return { provider: "anthropic", model: config.ANTHROPIC_MODEL };
    }

    const defaultProvider = config.LLM_PROVIDER;
    if (defaultProvider === "anthropic" && config.ANTHROPIC_API_KEY) {
        return { provider: "anthropic", model: config.ANTHROPIC_MODEL };
    }

    return { provider: "openai", model: "gpt-4o-mini" };
  }

  createModel(config: LLMConfig): LanguageModelV1 {
      if (config.provider === "openai") return openai(config.model) as LanguageModelV1;
      if (config.provider === "anthropic") return anthropic(config.model) as unknown as LanguageModelV1;
      return this.getOllama()(config.model) as LanguageModelV1;
  }

  async generate(config: LLMConfig) {
      const model = this.createModel(config);
      const result = await generateText({
          model,
          prompt: "Analyze the following payroll data and provide a JSON verdict.",
      });
      return {
          response: result.text,
          model: config.model,
          provider: config.provider,
          tokens: { prompt: result.usage?.promptTokens ?? 0, completion: result.usage?.completionTokens ?? 0 },
      };
  }

  async generateWithFallback(prompt: string, context: RoutingContext) {
    const config = this.selectProvider(context);
    try {
        return await this.generate(config);
    } catch (err) {
        log.warn({ err, config }, "Primary LLM provider failed, trying fallbacks");
        const fallbackConfigs = [
            { provider: "openai", model: "gpt-4o-mini" },
            { provider: "anthropic", model: "claude-3-5-haiku-20241022" }
        ];

        const errors: Error[] = [];
        for (const fallback of fallbackConfigs) {
            try {
                return await this.generate(fallback);
            } catch (fallbackErr) {
                log.warn({ err: fallbackErr, fallback }, "Fallback LLM provider failed");
                errors.push(fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr)));
            }
        }
        log.error({ errors, prompt: prompt.slice(0, 200) }, "All LLM providers failed");
        throw new AggregateError(errors, "All LLM providers failed");
    }
  }
}

export const llmRouter = new LLMRouter();
