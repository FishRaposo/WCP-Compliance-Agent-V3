import { useState } from "react";
import { useDecisions } from "../hooks/useDecisions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TrustBand } from "../types/api";

export default function Decisions() {
  const [trustBandFilter, setTrustBandFilter] = useState<TrustBand | undefined>(undefined);
  const [search, setSearch] = useState("");
  const { data, isLoading, error } = useDecisions(50, 0, trustBandFilter);

  const filtered = data?.filter((d) =>
    !search || d.job_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Decision History</h1>

      <div className="flex gap-3">
        <Input
          placeholder="Search by job ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Select
          value={trustBandFilter ?? "all"}
          onValueChange={(v) => setTrustBandFilter(v === "all" ? undefined : v as TrustBand)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Trust Band" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Bands</SelectItem>
            <SelectItem value="auto_approve">Auto Approve</SelectItem>
            <SelectItem value="flag_for_review">Flag for Review</SelectItem>
            <SelectItem value="require_human_review">Requires Review</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      )}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-700 font-medium">Failed to load decisions</p>
            <p className="text-sm text-red-600 mt-1">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </CardContent>
        </Card>
      )}
      {!isLoading && !error && filtered?.length === 0 && (
        <p className="text-sm text-muted-foreground">No decisions found.</p>
      )}
      <div className="space-y-2">
        {filtered?.map((d) => (
          <Card key={d.decision_id}>
            <CardContent className="py-3 px-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Badge variant={d.verdict === "approved" ? "default" : d.verdict === "rejected" ? "destructive" : "secondary"} className="capitalize">
                  {d.verdict.replace(/_/g, " ")}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground">{d.job_id}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{d.violation_count} violation{d.violation_count !== 1 ? "s" : ""}</span>
                <span>{(d.trust_score * 100).toFixed(0)}% trust</span>
                <span>{new Date(d.created_at).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
