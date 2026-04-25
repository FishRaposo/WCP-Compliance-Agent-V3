import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../utils/api-client.ts";
import type { JobStatus } from "../types/api.ts";

export function useJobPolling(jobId: string | null) {
  return useQuery({
    queryKey: ["job", jobId],
    queryFn: () => apiClient.get<JobStatus>(`/api/jobs/${jobId}`),
    enabled: jobId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "processing" ? 2000 : false;
    },
  });
}
