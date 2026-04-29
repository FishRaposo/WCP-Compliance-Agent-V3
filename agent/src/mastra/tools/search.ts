import { httpClient } from "../../utils/http-client.js";

interface SearchResult {
  chunk_id: string;
  text: string;
  score?: number;
  rerank_score?: number;
  metadata?: Record<string, unknown>;
}

export async function searchTool(
  query: string,
  trade?: string,
  locality?: string
): Promise<SearchResult[]> {
  return await httpClient.post<SearchResult[]>("/search", {
    query,
    trade,
    locality,
    top_k: 5,
  });
}
