import { useDecisions } from "../hooks/useDecisions.ts";

export default function Decisions() {
  const { data, isLoading, error } = useDecisions();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Decision History</h1>
      {isLoading && <p className="text-gray-400 text-sm">Loading...</p>}
      {error && (
        <div className="rounded-md bg-red-50 p-4 border border-red-200">
          <p className="text-sm text-red-700 font-medium">Failed to load decisions</p>
          <p className="text-sm text-red-600 mt-1">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      )}
      {!isLoading && !error && data?.length === 0 && (
        <p className="text-gray-400 text-sm">No decisions yet.</p>
      )}
      <div className="space-y-2">
        {data?.map((d) => (
          <div key={d.decision_id} className="bg-white rounded-lg border border-gray-200 p-4 flex justify-between items-center">
            <span className="font-mono text-xs text-gray-500">{d.job_id}</span>
            <span className="text-sm capitalize text-gray-700">{d.verdict.replace(/_/g, " ")}</span>
            <span className="text-xs text-gray-400">{(d.trust_score * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
