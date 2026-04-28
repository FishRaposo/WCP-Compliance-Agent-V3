import type { TrustScoredDecision } from "../types/api.ts";
import TrustScoreBadge from "./TrustScoreBadge.tsx";
import AuditTrail from "./AuditTrail.tsx";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  decision: TrustScoredDecision;
}

const verdictVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  approved: "default",
  rejected: "destructive",
  requires_review: "secondary",
};

export default function DecisionCard({ decision }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <Badge variant={verdictVariant[decision.verdict] ?? "outline"} className="capitalize text-sm">
          {decision.verdict.replace(/_/g, " ")}
        </Badge>
        <TrustScoreBadge score={decision.trust_score} band={decision.trust_band} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Violations</p>
            <p className="font-semibold text-red-600">{decision.violation_count}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Warnings</p>
            <p className="font-semibold text-yellow-600">{decision.warning_count}</p>
          </div>
          <div>
            <p className="text-muted-foreground">LLM Confidence</p>
            <p className="font-semibold">{(decision.llm_confidence * 100).toFixed(0)}%</p>
          </div>
        </div>
        {decision.reasoning_summary && (
          <div className="rounded-md bg-muted p-4">
            <h4 className="text-sm font-medium mb-1">Reasoning</h4>
            <p className="text-sm text-muted-foreground">{decision.reasoning_summary}</p>
          </div>
        )}
        <AuditTrail citations={decision.citations} traceId={decision.phoenix_trace_id} />
        {decision.cost_usd != null && (
          <p className="text-xs text-muted-foreground">Cost: ${decision.cost_usd.toFixed(4)} &middot; Latency: {decision.latency_ms}ms</p>
        )}
      </CardContent>
    </Card>
  );
}
