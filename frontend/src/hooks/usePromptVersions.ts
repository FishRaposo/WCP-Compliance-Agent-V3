import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../utils/api-client.ts";

export function usePromptVersions() {
  return useQuery({
    queryKey: ["prompt-versions"],
    queryFn: () => apiClient.get<string[]>("/api/prompt-versions"),
    staleTime: 60_000,
  });
}
