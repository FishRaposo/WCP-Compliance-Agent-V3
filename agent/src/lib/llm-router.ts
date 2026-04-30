import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { createOllama } from "ollama-ai-provider";
import { type LanguageModel, generateText } from "ai";
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
      if (process.env.ANTHROPIC_API_KEY) {
        return anthropicConfig;
      }
    }

    // Default: env var or OpenAI
    return getProviderConfig();
  }

  async generateWithFallback(
    prompt: string,
    context: RoutingContext
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
          const config = getProviderConfig(fallbackProvider as Provider);
          return await this.generate(config, prompt);
        } catch (fallbackError) {
          logger.warn({ error: fallbackError, provider: fallbackProvider }, "Fallback failed");
          continue;
        }
      }

      // All providers failed
      throw new Error("All LLM providers failed", { cause: error });
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
        prompt: usage?.promptTokens || 0,
        completion: usage?.completionTokens || 0
      }
    };
  }

  createModel(config: ModelConfig): LanguageModel {
    if (config.provider === "openai") return openai(config.model) as unknown as LanguageModel;
    if (config.provider === "anthropic") return anthropic(config.model) as unknown as LanguageModel;

    const baseURL = process.env.OLLAMA_BASE_URL;
    const ollama = baseURL ? createOllama({ baseURL }) : createOllama();
    return ollama(config.model) as unknown as LanguageModel;
  }
}

export const llmRouter = new LLMRouter();
