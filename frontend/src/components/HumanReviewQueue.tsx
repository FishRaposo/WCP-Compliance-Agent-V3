import { useDecisions } from "../hooks/useDecisions.ts";
import TrustScoreBadge from "./TrustScoreBadge.tsx";

export default function HumanReviewQueue() {
  const { data, isLoading, error } = useDecisions(50, 0, "require_human_review");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-400">Loading review queue...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 border border-red-200">
        <p className="text-sm text-red-700">Failed to load review queue.</p>
        <p className="text-xs text-red-500 mt-1">{error instanceof Error ? error.message : "Unknown error"}</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-500">No items pending review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{data.length} decision{data.length !== 1 ? "s" : ""} requiring review.</p>
      {data.map((d) => (
        <div key={d.decision_id} className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-gray-500">{d.job_id}</span>
            <TrustScoreBadge score={d.trust_score} band={d.trust_band} />
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
              d.verdict === "approved" ? "bg-green-50 text-green-700" :
              d.verdict === "rejected" ? "bg-red-50 text-red-700" :
              "bg-yellow-50 text-yellow-700"
            }`}>
              {d.verdict.replace(/_/g, " ")}
            </span>
            <span className="text-gray-500">{d.violation_count} violation{d.violation_count !== 1 ? "s" : ""}</span>
            <span className="text-gray-500">{d.warning_count} warning{d.warning_count !== 1 ? "s" : ""}</span>
          </div>
          <p className="text-xs text-gray-400">{new Date(d.created_at).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
