import { useMutation } from "@tanstack/react-query";
import { apiClient } from "../utils/api-client.ts";
import type { TrustScoredDecision } from "../types/api.ts";

export function useAnalyze() {
  return useMutation({
    mutationFn: (text: string) =>
      apiClient.post<TrustScoredDecision>("/api/analyze", { text }),
  });
}

export function useAnalyzePdf() {
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiClient.postForm<TrustScoredDecision>("/api/analyze-pdf", form);
    },
  });
}
