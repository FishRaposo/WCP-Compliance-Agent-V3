import { httpClient } from "../../utils/http-client.js";
import type { ExtractedWCP } from "../../types/index.js";

export async function extractTool(text: string): Promise<ExtractedWCP> {
  return httpClient.post<ExtractedWCP>("/extract", { text });
}
