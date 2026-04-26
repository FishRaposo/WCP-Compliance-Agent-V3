import type { TrustScoredDecision } from "../types/api.ts";
import TrustScoreBadge from "./TrustScoreBadge.tsx";
import AuditTrail from "./AuditTrail.tsx";

interface Props {
  decision: TrustScoredDecision;
}

const verdictColors: Record<string, string> = {
  approved: "text-green-700 bg-green-50",
  rejected: "text-red-700 bg-red-50",
  requires_review: "text-yellow-700 bg-yellow-50",
};

export default function DecisionCard({ decision }: Props) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <span className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${verdictColors[decision.verdict] ?? "text-gray-700 bg-gray-50"}`}>
          {decision.verdict.replace(/_/g, " ")}
        </span>
        <TrustScoreBadge score={decision.trust_score} band={decision.trust_band} />
      </div>
      <p className="text-sm text-gray-700">{decision.reasoning_summary}</p>
      <AuditTrail citations={decision.citations} traceId={decision.phoenix_trace_id} />
      {decision.cost_usd != null && (
        <p className="text-xs text-gray-400">Cost: ${decision.cost_usd.toFixed(4)}</p>
      )}
    </div>
  );
}
