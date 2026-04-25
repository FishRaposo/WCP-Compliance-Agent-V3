// Per-decision token cost display. Data sourced from Langfuse via backend.
// TODO: implement with Recharts LineChart for cost trends.

export default function CostDashboard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Cost per Decision</h3>
      <p className="text-gray-400 text-sm">Cost data will appear once decisions are processed.</p>
    </div>
  );
}
