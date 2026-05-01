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
