import { httpClient } from "../../utils/http-client.js";
import type { DeterministicReport, ExtractedWCP } from "../../types/index.js";

export async function validateTool(
  extracted: ExtractedWCP
): Promise<DeterministicReport> {
  return httpClient.post<DeterministicReport>("/validate", extracted);
}
