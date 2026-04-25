import { httpClient } from "../../utils/http-client.js";
import type { ExtractedWCP } from "../../types/index.js";

export async function validateTool(extracted: ExtractedWCP): Promise<object> {
  return httpClient.post<object>("/validate", extracted);
}
