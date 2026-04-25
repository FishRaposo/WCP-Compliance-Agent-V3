import { httpClient } from "../../utils/http-client.js";
import type { TrustScoredDecision } from "../../types/index.js";

export async function persistTool(decision: TrustScoredDecision): Promise<{ decision_id: string }> {
  return httpClient.post<{ decision_id: string }>("/decisions", decision);
}
