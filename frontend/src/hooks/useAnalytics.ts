import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../utils/api-client.ts";
import type {
  DecisionVolume,
  ApprovalRateResponse,
  TrustBandDistribution,
  CostAnalytics,
} from "../types/api.ts";

export function useDecisionVolume(days = 30) {
  return useQuery({
    queryKey: ["analytics", "volume", days],
    queryFn: () =>
      apiClient.get<DecisionVolume[]>(`/api/analytics/volume?days=${days}`),
  });
}

export function useApprovalByTrade() {
  return useQuery({
    queryKey: ["analytics", "approval-by-trade"],
    queryFn: () =>
      apiClient.get<ApprovalRateResponse>("/api/analytics/approval-by-trade"),
  });
}

export function useTrustBandDistribution() {
  return useQuery({
    queryKey: ["analytics", "trust-band-distribution"],
    queryFn: () =>
      apiClient.get<TrustBandDistribution[]>("/api/analytics/trust-band-distribution"),
  });
}

export function useCostAnalytics() {
  return useQuery({
    queryKey: ["analytics", "cost"],
    queryFn: () =>
      apiClient.get<CostAnalytics>("/api/analytics/cost"),
  });
}
