import { memo } from "react";
import { useDecisions } from "../hooks/useDecisions.ts";
import TrustScoreBadge from "./TrustScoreBadge.tsx";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { DecisionSummary } from "../types/api.ts";

const DecisionCardMemo = memo(function DecisionCardMemo({ d }: { d: DecisionSummary }) {
  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-muted-foreground">{d.job_id}</span>
          <TrustScoreBadge score={d.trust_score} band={d.trust_band} />
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Badge variant={d.verdict === "approved" ? "default" : d.verdict === "rejected" ? "destructive" : "secondary"} className="capitalize">
            {d.verdict.replace(/_/g, " ")}
          </Badge>
          <span className="text-muted-foreground">{d.violation_count} violation{d.violation_count !== 1 ? "s" : ""}</span>
          <span className="text-muted-foreground">{d.warning_count} warning{d.warning_count !== 1 ? "s" : ""}</span>
        </div>
        <p className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</p>
      </CardContent>
    </Card>
  );
});

export default function HumanReviewQueue() {
  const { data, isLoading, error } = useDecisions(50, 0, "require_human_review");

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <p className="text-sm text-red-700">Failed to load review queue.</p>
          <p className="text-xs text-red-500 mt-1">{error instanceof Error ? error.message : "Unknown error"}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground">No items pending review.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{data.length} decision{data.length !== 1 ? "s" : ""} requiring review.</p>
      {data.map((d) => (
        <DecisionCardMemo key={d.decision_id} d={d} />
      ))}
    </div>
  );
}
