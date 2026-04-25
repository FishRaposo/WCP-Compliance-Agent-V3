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
  // TODO: implement — log generation to Langfuse trace for cost tracking
}
