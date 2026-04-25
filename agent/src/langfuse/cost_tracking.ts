// Per-decision cost aggregation via Langfuse.

const MODEL_COST_PER_1K = {
  "gpt-4o": { input: 0.005, output: 0.015 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
} as const;

export function computeCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const rates = MODEL_COST_PER_1K[model as keyof typeof MODEL_COST_PER_1K];
  if (!rates) return 0;
  return (promptTokens / 1000) * rates.input + (completionTokens / 1000) * rates.output;
}
