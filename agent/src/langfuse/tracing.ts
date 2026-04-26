import { langfuse } from "./client.js";

export async function createTrace(jobId: string, promptVersion: string) {
  return langfuse.trace({
    name: "wcp-verdict",
    id: jobId,
    metadata: { prompt_version: promptVersion },
  });
}

export async function logGeneration(
  traceId: string,
  input: string,
  output: string,
  model: string,
  usage: { promptTokens: number; completionTokens: number }
) {
  const trace = langfuse.trace({ id: traceId });
  trace.generation({
    name: "wcp-verdict-generation",
    input,
    output,
    model,
    modelParameters: {
      temperature: 0.2,
      max_tokens: 2048,
    },
    usage: {
      input: usage.promptTokens,
      output: usage.completionTokens,
      total: usage.promptTokens + usage.completionTokens,
      unit: "TOKENS",
    },
  });
}
