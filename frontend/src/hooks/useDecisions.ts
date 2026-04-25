import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../utils/api-client.ts";
import type { DecisionSummary } from "../types/api.ts";

export function useDecisions(limit = 50, offset = 0) {
  return useQuery({
    queryKey: ["decisions", limit, offset],
    queryFn: () =>
      apiClient.get<DecisionSummary[]>(`/api/decisions?limit=${limit}&offset=${offset}`),
  });
}
