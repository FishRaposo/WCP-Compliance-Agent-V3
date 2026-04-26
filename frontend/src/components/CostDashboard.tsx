import { useCostAnalytics } from "../hooks/useAnalytics.ts";

export default function CostDashboard() {
  const { data, isLoading, error } = useCostAnalytics();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Cost per Decision</h3>
      {isLoading && <p className="text-gray-400 text-sm">Loading cost data...</p>}
      {error && (
        <p className="text-sm text-red-600">Failed to load cost data.</p>
      )}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500">Total Decisions</p>
            <p className="text-xl font-bold text-gray-900">{data.total_decisions}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">This Month</p>
            <p className="text-xl font-bold text-gray-900">{data.decisions_this_month}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Note</p>
            <p className="text-xs text-gray-500 mt-1">{data.note}</p>
          </div>
        </div>
      )}
    </div>
  );
}
