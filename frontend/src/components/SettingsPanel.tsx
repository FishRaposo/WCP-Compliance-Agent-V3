import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../utils/api-client.ts";

interface HealthResponse {
  status: string;
  version: string;
  phase: number;
  services?: Record<string, { status: string; message: string }>;
}

export default function SettingsPanel() {
  const { data: health, isLoading } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiClient.get<HealthResponse>("/health"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium text-gray-700">Prompt Version</label>
        <p className="text-xs text-gray-400 mt-1">Prompt versioning requires Langfuse (Phase 3+).</p>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Model</label>
        <p className="text-xs text-gray-400 mt-1">gpt-4o-mini (default)</p>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Backend Status</label>
        {isLoading && <p className="text-xs text-gray-400 mt-1">Checking...</p>}
        {health && (
          <div className="mt-2 space-y-1">
            <p className="text-xs text-gray-600">
              Version {health.version} &middot; Phase {health.phase} &middot;{" "}
              <span className={health.status === "ok" ? "text-green-600" : "text-yellow-600"}>
                {health.status}
              </span>
            </p>
            {health.services && Object.entries(health.services).map(([name, svc]) => (
              <p key={name} className="text-xs text-gray-500">
                <span className={svc.status === "ok" ? "text-green-600" : "text-yellow-600"}>
                  ●
                </span>{" "}
                {name}: {svc.message}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
