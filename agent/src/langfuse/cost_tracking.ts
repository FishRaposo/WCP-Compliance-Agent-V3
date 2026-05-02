// Per-decision cost aggregation via Langfuse.

const MODEL_COST_PER_1K: Record<string, { input: number; output: number }> = {
  // OpenAI
  "gpt-4o": { input: 0.005, output: 0.015 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },

  // Anthropic
  "claude-sonnet-4-20250514": { input: 0.003, output: 0.015 },
  "claude-sonnet-3-5-20241022": { input: 0.003, output: 0.015 },
  "claude-3-5-haiku-20241022": { input: 0.001, output: 0.005 },
  // Ollama (free local inference)
  "llama3.2": { input: 0, output: 0 },
};

const DEFAULT_RATES = { input: 0.005, output: 0.015 };

export function computeCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const rates = MODEL_COST_PER_1K[model] ?? DEFAULT_RATES;
  return (promptTokens / 1000) * rates.input + (completionTokens / 1000) * rates.output;
}
