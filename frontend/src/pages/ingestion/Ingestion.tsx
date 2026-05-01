import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/utils/api-client";
import type { IngestionJobSummary } from "@/types/v4";

export default function Ingestion() {
  const [jobs, setJobs] = useState<IngestionJobSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<IngestionJobSummary[]>("/api/ingestion/jobs")
      .then(setJobs)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load ingestion jobs"));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ingestion</h1>
        <p className="text-sm text-muted-foreground">Track V4 contract and payroll import jobs with record-level progress.</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!jobs && !error && <Skeleton className="h-28 w-full" />}

      <div className="space-y-2">
        {jobs?.map((job) => (
          <Card key={job.job_id}>
            <CardContent className="grid gap-2 py-4 text-sm md:grid-cols-6">
              <div className="md:col-span-2"><span className="text-muted-foreground">Job</span><p className="font-mono text-xs font-medium">{job.job_id}</p></div>
              <div><span className="text-muted-foreground">Type</span><p className="font-medium">{job.type.replace(/_/g, " ")}</p></div>
              <div><span className="text-muted-foreground">Status</span><p><Badge variant={job.status === "completed" ? "default" : "secondary"}>{job.status}</Badge></p></div>
              <div><span className="text-muted-foreground">Progress</span><p className="font-medium">{job.processed_records}/{job.total_records}</p></div>
              <div><span className="text-muted-foreground">Failed</span><p className="font-medium">{job.failed_records}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
