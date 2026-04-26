import CostDashboard from "../components/CostDashboard.tsx";
import { useDecisionVolume, useApprovalByTrade, useTrustBandDistribution } from "../hooks/useAnalytics.ts";

export default function Analytics() {
  const { data: volume, isLoading: loadingVolume } = useDecisionVolume(30);
  const { data: approval, isLoading: loadingApproval } = useApprovalByTrade();
  const { data: distribution, isLoading: loadingDistribution } = useTrustBandDistribution();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>

      {/* Approval Rate Summary */}
      <section>
        <h2 className="text-lg font-medium text-gray-800 mb-3">Approval Rate</h2>
        {loadingApproval && <p className="text-sm text-gray-400">Loading...</p>}
        {approval && (
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-xl font-bold text-gray-900">{approval.overall.total}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Approved</p>
                <p className="text-xl font-bold text-green-700">{approval.overall.approved}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Rate</p>
                <p className="text-xl font-bold text-gray-900">{(approval.overall.rate * 100).toFixed(1)}%</p>
              </div>
            </div>
            {approval.by_trust_band.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase">By Trust Band</p>
                {approval.by_trust_band.map((band) => (
                  <div key={band.trust_band} className="flex justify-between text-sm">
                    <span className="text-gray-700 capitalize">{band.trust_band.replace(/_/g, " ")}</span>
                    <span className="text-gray-500">{band.approved}/{band.total} ({(band.rate * 100).toFixed(1)}%)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Trust Band Distribution */}
      <section>
        <h2 className="text-lg font-medium text-gray-800 mb-3">Trust Band Distribution</h2>
        {loadingDistribution && <p className="text-sm text-gray-400">Loading...</p>}
        {distribution && distribution.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {distribution.map((band) => {
              const colors: Record<string, string> = {
                auto_approve: "bg-green-50 border-green-200",
                flag_for_review: "bg-yellow-50 border-yellow-200",
                require_human_review: "bg-red-50 border-red-200",
              };
              return (
                <div key={band.trust_band} className={`rounded-lg border p-5 ${colors[band.trust_band] ?? "bg-gray-50 border-gray-200"}`}>
                  <p className="text-xs text-gray-500 capitalize">{band.trust_band.replace(/_/g, " ")}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{band.count}</p>
                  <p className="text-xs text-gray-500 mt-1">{band.percentage.toFixed(1)}%</p>
                </div>
              );
            })}
          </div>
        )}
        {!loadingDistribution && (!distribution || distribution.length === 0) && (
          <p className="text-sm text-gray-400">No distribution data.</p>
        )}
      </section>

      {/* Decision Volume */}
      <section>
        <h2 className="text-lg font-medium text-gray-800 mb-3">Decision Volume (Last 30 Days)</h2>
        {loadingVolume && <p className="text-sm text-gray-400">Loading...</p>}
        {volume && volume.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Decisions</th>
                </tr>
              </thead>
              <tbody>
                {volume.map((row) => (
                  <tr key={row.date} className="border-b border-gray-50">
                    <td className="px-4 py-2 text-gray-700">{new Date(row.date).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-700">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loadingVolume && (!volume || volume.length === 0) && (
          <p className="text-sm text-gray-400">No volume data.</p>
        )}
      </section>

      {/* Cost */}
      <CostDashboard />
    </div>
  );
}
