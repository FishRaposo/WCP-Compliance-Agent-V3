import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/utils/api-client";
import type { PaginatedPayrolls, PayrollRecordSummary } from "@/types/v4";
import { Search, X, Upload, FileText, ChevronLeft, ChevronRight } from "lucide-react";

interface PayrollFilters {
  contract_id: string;
  trade_code: string;
  week_ending: string;
  employee_name: string;
  page: number;
}

function PayrollDetail({ record }: { record: PayrollRecordSummary }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Payroll Record</h2>
        </div>
        <div className="grid gap-3 text-sm">
          <div><span className="text-muted-foreground">Employee</span><p className="font-medium">{record.employee_name}</p></div>
          <div><span className="text-muted-foreground">Contract ID</span><p className="font-medium font-mono text-xs">{record.contract_id}</p></div>
          <div><span className="text-muted-foreground">Trade</span><p className="font-medium">{record.trade_code}</p></div>
          <div><span className="text-muted-foreground">Locality</span><p className="font-medium">{record.locality_code}</p></div>
          <div><span className="text-muted-foreground">Week Ending</span><p className="font-medium">{record.week_ending}</p></div>
          <div><span className="text-muted-foreground">Hours</span><p className="font-medium">{record.total_hours}</p></div>
          <div><span className="text-muted-foreground">Hourly Rate</span><p className="font-medium">${record.hourly_rate}</p></div>
          <div><span className="text-muted-foreground">Gross Pay</span><p className="font-medium">${record.gross_pay}</p></div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={() => window.history.back()}>Close</Button>
        </div>
      </div>
    </div>
  );
}

function CSVUploadDialog({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
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
      await apiClient.postForm<{ job_id: string }>("/api/payrolls/bulk", form);
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
          <h2 className="text-lg font-semibold">Upload Payrolls CSV</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <form onSubmit={handleUpload} className="grid gap-4">
          <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors">
            <input
              type="file"
              accept=".csv"
              id="payroll-csv-upload"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <label htmlFor="payroll-csv-upload" className="cursor-pointer flex flex-col items-center gap-2">
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

export default function Payrolls() {
  const [filters, setFilters] = useState<PayrollFilters>({
    contract_id: "",
    trade_code: "",
    week_ending: "",
    employee_name: "",
    page: 1,
  });
  const [showUpload, setShowUpload] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PayrollRecordSummary | null>(null);

  const { data, isLoading, error } = useQuery<PaginatedPayrolls>({
    queryKey: ["payrolls", filters],
    queryFn: () =>
      apiClient.get<PaginatedPayrolls>("/api/payrolls", {
        page: filters.page,
        contract_id: filters.contract_id || undefined,
        trade_code: filters.trade_code || undefined,
        week_ending: filters.week_ending || undefined,
        employee_name: filters.employee_name || undefined,
      }),
  });

  const handleFilterChange = useCallback((key: keyof PayrollFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  }, []);

  const handleUploaded = () => {
    setShowUpload(false);
  };

  const clearFilters = () => {
    setFilters({ contract_id: "", trade_code: "", week_ending: "", employee_name: "", page: 1 });
  };

  const hasActiveFilters = filters.contract_id || filters.trade_code || filters.week_ending || filters.employee_name;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Payrolls</h1>
          <p className="text-sm text-muted-foreground">Browse imported certified payroll records by contract, trade, and week.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowUpload(true)}>
            <Upload className="h-4 w-4 mr-1" /> CSV Upload
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Employee name..."
            value={filters.employee_name}
            onChange={(e) => handleFilterChange("employee_name", e.target.value)}
            className="pl-9"
          />
        </div>
        <Input
          placeholder="Contract ID"
          value={filters.contract_id}
          onChange={(e) => handleFilterChange("contract_id", e.target.value)}
          className="w-[150px]"
        />
        <Input
          placeholder="Trade code"
          value={filters.trade_code}
          onChange={(e) => handleFilterChange("trade_code", e.target.value)}
          className="w-[150px]"
        />
        <Input
          type="date"
          placeholder="Week ending"
          value={filters.week_ending}
          onChange={(e) => handleFilterChange("week_ending", e.target.value)}
          className="w-[160px]"
        />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Loading / Error */}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {isLoading && <Skeleton className="h-28 w-full" />}

      {/* Payroll Records */}
      {!isLoading && !error && (
        <>
          {data?.items.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No payroll records found.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data?.items.map((record) => (
                <Card
                  key={`${record.contract_id}-${record.id}`}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setSelectedRecord(record)}
                >
                  <CardContent className="grid gap-2 py-4 text-sm md:grid-cols-6">
                    <div className="md:col-span-2">
                      <span className="text-muted-foreground">Employee</span>
                      <p className="font-medium">{record.employee_name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Trade</span>
                      <p className="font-medium">{record.trade_code}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Week</span>
                      <p className="font-medium">{record.week_ending}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Hours</span>
                      <p className="font-medium">{record.total_hours}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Gross</span>
                      <p className="font-medium">${record.gross_pay}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Page {data.page} of {data.pages} — {data.total} records
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
      {showUpload && <CSVUploadDialog onClose={() => setShowUpload(false)} onUploaded={handleUploaded} />}
      {selectedRecord && <PayrollDetail record={selectedRecord} />}
    </div>
  );
}