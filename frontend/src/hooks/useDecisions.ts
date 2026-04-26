import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../utils/api-client.ts";
import type { DecisionSummary, TrustBand } from "../types/api.ts";

export function useDecisions(limit = 50, offset = 0, trustBand?: TrustBand) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (trustBand) params.append("trust_band", trustBand);

  return useQuery({
    queryKey: ["decisions", limit, offset, trustBand],
    queryFn: () =>
      apiClient.get<DecisionSummary[]>(`/api/decisions?${params.toString()}`),
  });
}
