import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../utils/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface HealthResponse {
  status: string;
  version: string;
  phase: number;
  services?: Record<string, { status: string; message: string }>;
}

export default function SettingsPanel() {
  const { data: health, isLoading, error } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiClient.get<HealthResponse>("/health"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">LLM Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Model</label>
            <p className="text-sm text-muted-foreground mt-1">{import.meta.env.VITE_LLM_MODEL ?? "gpt-4o-mini"}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Prompt Version</label>
            <p className="text-sm text-muted-foreground mt-1">{import.meta.env.VITE_PROMPT_VERSION ?? "v2"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backend Status</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <Skeleton className="h-12 w-full" />}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              Failed to load health status. Please try again later.
            </div>
          )}
          {health && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={health.status === "ok" ? "default" : "secondary"}>
                  {health.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  v{health.version} &middot; Phase {health.phase}
                </span>
              </div>
              {health.services && Object.entries(health.services).map(([name, svc]) => (
                <div key={name} className="flex items-center gap-2 text-sm">
                  <span className={svc.status === "ok" ? "text-green-600" : "text-yellow-600"}>
                    ●
                  </span>
                  <span className="capitalize">{name}</span>
                  <span className="text-muted-foreground">{svc.message}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
