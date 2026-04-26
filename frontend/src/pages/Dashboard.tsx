import { useDecisionStream } from "../hooks/useDecisionStream.ts";
import { useDecisions } from "../hooks/useDecisions.ts";
import { useApprovalByTrade } from "../hooks/useAnalytics.ts";

export default function Dashboard() {
  const { latestDecision } = useDecisionStream();
  const { data: recentDecisions, isLoading: loadingDecisions } = useDecisions(10);
  const { data: approvalData, isLoading: loadingApproval } = useApprovalByTrade();

  const totalDecisions = approvalData?.overall.total ?? 0;
  const approvalRate = approvalData?.overall.rate ?? 0;

  const avgTrust =
    recentDecisions && recentDecisions.length > 0
      ? recentDecisions.reduce((sum, d) => sum + d.trust_score, 0) / recentDecisions.length
      : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Decisions</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {loadingApproval ? "…" : totalDecisions}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Approval Rate</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {loadingApproval ? "…" : `${(approvalRate * 100).toFixed(1)}%`}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Avg. Trust Score</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {loadingDecisions ? "…" : `${(avgTrust * 100).toFixed(0)}%`}
          </p>
        </div>
      </div>

      {latestDecision && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-blue-700 uppercase">New Decision</p>
          <p className="text-sm text-blue-900 mt-1">
            Job <span className="font-mono">{latestDecision.job_id.slice(0, 8)}</span>{" "}
            — {latestDecision.verdict.replace(/_/g, " ")} —{" "}
            {(latestDecision.trust_score * 100).toFixed(0)}% trust
          </p>
        </div>
      )}

      <div>
        <h2 className="text-lg font-medium text-gray-800 mb-3">Recent Decisions</h2>
        {loadingDecisions && <p className="text-sm text-gray-400">Loading...</p>}
        {!loadingDecisions && (!recentDecisions || recentDecisions.length === 0) && (
          <p className="text-sm text-gray-400">No decisions yet.</p>
        )}
        <div className="space-y-2">
          {recentDecisions?.map((d) => (
            <div
              key={d.decision_id}
              className="bg-white rounded-lg border border-gray-200 p-4 flex justify-between items-center"
            >
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                  d.verdict === "approved" ? "bg-green-50 text-green-700" :
                  d.verdict === "rejected" ? "bg-red-50 text-red-700" :
                  "bg-yellow-50 text-yellow-700"
                }`}>
                  {d.verdict.replace(/_/g, " ")}
                </span>
                <span className="font-mono text-xs text-gray-500">{d.job_id.slice(0, 8)}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>{d.violation_count} violation{d.violation_count !== 1 ? "s" : ""}</span>
                <span>{(d.trust_score * 100).toFixed(0)}% trust</span>
                <span>{new Date(d.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
