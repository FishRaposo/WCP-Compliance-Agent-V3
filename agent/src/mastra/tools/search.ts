import { httpClient } from "../../utils/http-client.js";

export async function searchTool(query: string, trade?: string, locality?: string) {
  return httpClient.post("/search", { query, trade, locality, top_k: 5 });
}
