import CostDashboard from "../components/CostDashboard.tsx";

// TODO: implement full analytics page with decision volume charts.
export default function Analytics() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
      <CostDashboard />
    </div>
  );
}
