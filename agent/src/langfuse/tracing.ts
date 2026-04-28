import { getLangfuse } from "./client.js";

interface TraceHandle {
  id: string;
}

export async function createTrace(jobId: string, promptVersion: string): Promise<TraceHandle> {
  const langfuse = getLangfuse();
  if (!langfuse) {
    return { id: "" };
  }

  const trace = langfuse.trace({
    name: "wcp-verdict",
    id: jobId,
    metadata: { prompt_version: promptVersion },
  });

  return { id: trace.id };
}

export async function logGeneration(
  traceId: string,
  input: string,
  output: string,
  model: string,
  usage: { promptTokens: number; completionTokens: number }
) {
  const langfuse = getLangfuse();
  if (!langfuse || !traceId) {
    return;
  }

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
