import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectValue, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/utils/api-client";
import type { ContractStatus, ContractSummary, CreateContractPayload, PaginatedContracts } from "@/types/v4";
import { Plus, Upload, Trash2, ChevronLeft, ChevronRight, Search, X, FileText } from "lucide-react";

interface ContractFilters {
  search: string;
  status: ContractStatus | "";
  page: number;
}

const CONTRACT_STATUSES: ContractStatus[] = ["active", "completed", "terminated", "suspended"];

function ContractDetail({ contract, onClose }: { contract: ContractSummary; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Contract Details</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="grid gap-3 text-sm">
          <div><span className="text-muted-foreground">Contract Number</span><p className="font-medium">{contract.contract_number}</p></div>
          <div><span className="text-muted-foreground">Project Name</span><p className="font-medium">{contract.project_name}</p></div>
          <div><span className="text-muted-foreground">Contractor</span><p className="font-medium">{contract.contractor_name}</p></div>
          <div><span className="text-muted-foreground">Locality</span><p className="font-medium">{contract.locality}</p></div>
          <div><span className="text-muted-foreground">Status</span><p><Badge variant={contract.status === "active" ? "default" : "secondary"}>{contract.status}</Badge></p></div>
          <div><span className="text-muted-foreground">Decisions</span><p className="font-medium">{contract.decision_count}</p></div>
          <div><span className="text-muted-foreground">Payroll Records</span><p className="font-medium">{contract.payroll_record_count}</p></div>
          <div><span className="text-muted-foreground">Created</span><p className="font-medium">{new Date(contract.created_at).toLocaleDateString()}</p></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

function CreateContractDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<CreateContractPayload>({
    contract_number: "",
    project_name: "",
    contractor_name: "",
    locality: "",
    start_date: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CreateContractPayload, string>>>({});
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (payload: CreateContractPayload) =>
      apiClient.post<ContractSummary>("/api/contracts", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      onCreated();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Partial<Record<keyof CreateContractPayload, string>> = {};
    if (!form.contract_number.trim()) errors.contract_number = "Contract number is required";
    if (!form.project_name.trim()) errors.project_name = "Project name is required";
    if (!form.contractor_name.trim()) errors.contractor_name = "Contractor name is required";
    if (!form.locality.trim()) errors.locality = "Locality is required";
    if (!form.start_date) errors.start_date = "Start date is required";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    createMutation.mutate(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">New Contract</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div>
            <label className="text-sm font-medium" htmlFor="contract-number">Contract Number</label>
            <Input
              id="contract-number"
              value={form.contract_number}
              onChange={(e) => setForm({ ...form, contract_number: e.target.value })}
              placeholder="DBA-2026-003"
              required
            />
            {fieldErrors.contract_number && <p className="text-sm text-destructive mt-1">{fieldErrors.contract_number}</p>}
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="project-name">Project Name</label>
            <Input
              id="project-name"
              value={form.project_name}
              onChange={(e) => setForm({ ...form, project_name: e.target.value })}
              placeholder="Federal Building Renovation"
              required
            />
            {fieldErrors.project_name && <p className="text-sm text-destructive mt-1">{fieldErrors.project_name}</p>}
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="contractor-name">Contractor Name</label>
            <Input
              id="contractor-name"
              value={form.contractor_name}
              onChange={(e) => setForm({ ...form, contractor_name: e.target.value })}
              placeholder="Acme Construction"
              required
            />
            {fieldErrors.contractor_name && <p className="text-sm text-destructive mt-1">{fieldErrors.contractor_name}</p>}
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="locality">Locality</label>
            <Input
              id="locality"
              value={form.locality}
              onChange={(e) => setForm({ ...form, locality: e.target.value })}
              placeholder="Washington, DC"
              required
            />
            {fieldErrors.locality && <p className="text-sm text-destructive mt-1">{fieldErrors.locality}</p>}
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="start-date">Start Date</label>
            <Input
              id="start-date"
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              required
            />
            {fieldErrors.start_date && <p className="text-sm text-destructive mt-1">{fieldErrors.start_date}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Contract"}
            </Button>
          </div>
          {createMutation.isError && (
            <p className="text-sm text-destructive">
              Failed to create contract. Please check your input and try again.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

function CSVUploadDialog({ uploadType, onClose, onUploaded }: { uploadType: "contracts" | "ingestion"; onClose: () => void; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint = uploadType === "contracts" ? "/api/contracts/bulk" : "/api/ingestion/bulk-upload";
  const label = uploadType === "contracts" ? "Contracts" : "General Ingestion";

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
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
          <h2 className="text-lg font-semibold">Upload {label} CSV</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <form onSubmit={handleUpload} className="grid gap-4">
          <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors">
            <input
              type="file"
              accept=".csv"
              id="csv-upload"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center gap-2">
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

export default function Contracts() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ContractFilters>({ search: "", status: "", page: 1 });
  const [showCreate, setShowCreate] = useState(false);
  const [showUploadContracts, setShowUploadContracts] = useState(false);
  const [showUploadIngestion, setShowUploadIngestion] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ContractSummary | null>(null);

  const { data, isLoading, error } = useQuery<PaginatedContracts>({
    queryKey: ["contracts", filters],
    queryFn: () =>
      apiClient.get<PaginatedContracts>("/api/contracts", {
        page: filters.page,
        search: filters.search || undefined,
        status: filters.status || undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/api/contracts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
  });

  const handleFilterChange = useCallback((key: keyof ContractFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  }, []);

  const handleContractCreated = () => {
    setShowCreate(false);
    queryClient.invalidateQueries({ queryKey: ["contracts"] });
  };

  const handleUploaded = () => {
    setShowUploadContracts(false);
    setShowUploadIngestion(false);
    queryClient.invalidateQueries({ queryKey: ["contracts"] });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Contracts</h1>
          <p className="text-sm text-muted-foreground">Manage V4 contract records and linked compliance activity.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowUploadContracts(true)}>
            <Upload className="h-4 w-4 mr-1" /> CSV Upload
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowUploadIngestion(true)}>
            <Upload className="h-4 w-4 mr-1" /> Bulk Import
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Contract
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contracts..."
            value={filters.search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={filters.status}
          onValueChange={(val) => handleFilterChange("status", val === "all" ? "" : val)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {CONTRACT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filters.search || filters.status) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters({ search: "", status: "", page: 1 })}
          >
            <X className="h-4 w-4 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Loading / Error */}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {isLoading && <Skeleton className="h-28 w-full" />}

      {/* Contract List */}
      {!isLoading && !error && (
        <>
          {data?.items.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No contracts found.</p>
              <Button variant="link" onClick={() => setShowCreate(true)}>Create your first contract</Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {data?.items.map((contract: ContractSummary) => (
                <Card
                  key={contract.id}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setSelectedContract(contract)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-base">{contract.project_name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant={contract.status === "active" ? "default" : "secondary"}>{contract.status}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Terminate this contract? This action cannot be undone.")) {
                              deleteMutation.mutate(contract.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-2 text-sm md:grid-cols-4">
                    <div><span className="text-muted-foreground">Contract</span><p className="font-medium">{contract.contract_number}</p></div>
                    <div><span className="text-muted-foreground">Contractor</span><p className="font-medium">{contract.contractor_name}</p></div>
                    <div><span className="text-muted-foreground">Locality</span><p className="font-medium">{contract.locality}</p></div>
                    <div><span className="text-muted-foreground">Activity</span><p className="font-medium">{contract.decision_count} decisions · {contract.payroll_record_count} payrolls</p></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Page {data.page} of {data.pages} — {data.total} contracts
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page <= 1}
                  onClick={() => handlePageChange(data.page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page >= data.pages}
                  onClick={() => handlePageChange(data.page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      {showCreate && <CreateContractDialog onClose={() => setShowCreate(false)} onCreated={handleContractCreated} />}
      {showUploadContracts && <CSVUploadDialog uploadType="contracts" onClose={() => setShowUploadContracts(false)} onUploaded={handleUploaded} />}
      {showUploadIngestion && <CSVUploadDialog uploadType="ingestion" onClose={() => setShowUploadIngestion(false)} onUploaded={handleUploaded} />}
      {selectedContract && <ContractDetail contract={selectedContract} onClose={() => setSelectedContract(null)} />}
    </div>
  );
}