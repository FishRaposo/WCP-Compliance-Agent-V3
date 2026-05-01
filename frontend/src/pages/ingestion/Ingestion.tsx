import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectValue, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/utils/api-client";
import type { IngestionJobSummary } from "@/types/v4";
import { Upload, FileText, RefreshCw, AlertCircle, CheckCircle2, Clock, XCircle, X, Plus } from "lucide-react";

type IngestionType = "contracts" | "payrolls" | "general";

interface IngestionFilters {
  type: string;
  status: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  pending: { label: "Pending", icon: Clock, color: "text-muted-foreground" },
  running: { label: "Running", icon: RefreshCw, color: "text-blue-500" },
  completed: { label: "Completed", icon: CheckCircle2, color: "text-green-500" },
  failed: { label: "Failed", icon: XCircle, color: "text-red-500" },
  partial: { label: "Partial", icon: AlertCircle, color: "text-yellow-500" },
};

const INGESTION_TYPES: Record<IngestionType, { label: string; description: string }> = {
  contracts: { label: "Contracts CSV", description: "Bulk import contracts from CSV file" },
  payrolls: { label: "Payrolls CSV", description: "Bulk import certified payroll records from CSV" },
  general: { label: "General Ingestion", description: "Generic bulk upload for any data type" },
};

function JobDetailDialog({ job, onClose }: { job: IngestionJobSummary; onClose: () => void }) {
  const progress = job.total_records > 0 ? (job.processed_records / job.total_records) * 100 : 0;
  const failRate = job.total_records > 0 ? (job.failed_records / job.total_records) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Job Details</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-4">
          <div className="grid gap-3 text-sm">
            <div><span className="text-muted-foreground">Job ID</span><p className="font-mono text-xs font-medium">{job.job_id}</p></div>
            <div><span className="text-muted-foreground">Type</span><p className="font-medium">{job.type.replace(/_/g, " ")}</p></div>
            <div><span className="text-muted-foreground">Source</span><p className="font-medium">{job.source_type}</p></div>
            <div><span className="text-muted-foreground">Status</span><p>
              <Badge variant={job.status === "completed" ? "default" : job.status === "failed" ? "destructive" : "secondary"}>
                {job.status}
              </Badge>
            </p></div>
            <div><span className="text-muted-foreground">Created</span><p className="font-medium">{new Date(job.created_at).toLocaleString()}</p></div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span>{job.processed_records} / {job.total_records}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div className="bg-primary h-2 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {job.failed_records > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Failed Records</span>
                <span className="text-red-500">{job.failed_records} ({failRate.toFixed(1)}%)</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div className="bg-red-500 h-2 transition-all" style={{ width: `${100 - failRate}%` }} />
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

function BulkUploadDialog({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const [ingestionType, setIngestionType] = useState<IngestionType>("contracts");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const endpoint = ingestionType === "general" ? "/api/ingestion/bulk-upload" : `/api/${ingestionType}/bulk`;
      await apiClient.postForm<{ job_id: string }>(endpoint, form);
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Bulk Upload</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <form onSubmit={handleUpload} className="grid gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Upload Type</label>
            <div className="grid gap-2">
              {(Object.keys(INGESTION_TYPES) as IngestionType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setIngestionType(type)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    ingestionType === type ? "border-primary bg-primary/5" : "hover:bg-muted"
                  }`}
                >
                  <p className="font-medium text-sm">{INGESTION_TYPES[type].label}</p>
                  <p className="text-xs text-muted-foreground">{INGESTION_TYPES[type].description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors">
            <input
              type="file"
              accept=".csv"
              id="ingestion-csv-upload"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <label htmlFor="ingestion-csv-upload" className="cursor-pointer flex flex-col items-center gap-2">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {file ? file.name : "Click to select CSV file"}
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!file || uploading}>
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      </div>
    </div>
  );
}

export default function Ingestion() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<IngestionFilters>({ type: "", status: "" });
  const [showUpload, setShowUpload] = useState(false);
  const [selectedJob, setSelectedJob] = useState<IngestionJobSummary | null>(null);

  const { data: jobs, isLoading, error, refetch } = useQuery<IngestionJobSummary[]>({
    queryKey: ["ingestion", "jobs", filters],
    queryFn: () =>
      apiClient.get<IngestionJobSummary[]>("/api/ingestion/jobs", {
        type: filters.type || undefined,
        status: filters.status || undefined,
      }),
    refetchInterval: 10000, // Poll every 10 seconds for running jobs
  });

  const handleFilterChange = useCallback((key: keyof IngestionFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleUploaded = () => {
    setShowUpload(false);
    queryClient.invalidateQueries({ queryKey: ["ingestion", "jobs"] });
    refetch();
  };

  const clearFilters = () => {
    setFilters({ type: "", status: "" });
  };

  const hasActiveFilters = filters.type || filters.status;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ingestion</h1>
          <p className="text-sm text-muted-foreground">Track V4 contract and payroll import jobs with record-level progress.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowUpload(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Upload
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={filters.type}
          onValueChange={(val) => handleFilterChange("type", val === "all" ? "" : val)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Upload type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="contract_import">Contract Import</SelectItem>
            <SelectItem value="payroll_import">Payroll Import</SelectItem>
            <SelectItem value="general">General</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.status}
          onValueChange={(val) => handleFilterChange("status", val === "all" ? "" : val)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Loading / Error */}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {isLoading && <Skeleton className="h-28 w-full" />}

      {/* Jobs Grid */}
      {!isLoading && !error && (
        <>
          {jobs?.length === 0 ? (
            <div className="text-center py-12">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No ingestion jobs found.</p>
              <Button variant="link" onClick={() => setShowUpload(true)}>Start a new upload</Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {jobs?.map((job) => {
                const progress = job.total_records > 0 ? (job.processed_records / job.total_records) * 100 : 0;
                const statusCfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pending;
                const StatusIcon = statusCfg.icon;

                return (
                  <Card
                    key={job.job_id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setSelectedJob(job)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-sm font-mono truncate">{job.job_id.slice(0, 12)}...</CardTitle>
                        <StatusIcon className={`h-4 w-4 ${statusCfg.color}`} />
                      </div>
                      <CardDescription className="text-xs">
                        {job.type.replace(/_/g, " ")} · {job.source_type}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{job.processed_records}/{job.total_records}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div className="bg-primary h-1.5 transition-all" style={{ width: `${progress}%` }} />
                          </div>
                      </div>
                      {job.failed_records > 0 && (
                        <div className="flex items-center gap-1 text-xs text-red-500">
                          <AlertCircle className="h-3 w-3" />
                          <span>{job.failed_records} failed</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(job.created_at).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      {showUpload && <BulkUploadDialog onClose={() => setShowUpload(false)} onUploaded={handleUploaded} />}
      {selectedJob && <JobDetailDialog job={selectedJob} onClose={() => setSelectedJob(null)} />}
    </div>
  );
}