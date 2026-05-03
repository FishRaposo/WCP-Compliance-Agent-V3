import { Link } from "react-router-dom";
import CostDashboard from "../components/CostDashboard.tsx";
import {
  useAnalyticsOverview,
  useDecisionVolume,
  useApprovalByTrade,
  useTrustBandDistribution,
} from "../hooks/useAnalytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Analytics() {
  const { data: overview, isLoading: loadingOverview, error: overviewError } = useAnalyticsOverview(30);
  const { data: volume, isLoading: loadingVolume, error: volumeError } = useDecisionVolume(30);
  const { data: approval, isLoading: loadingApproval, error: approvalError } = useApprovalByTrade();
  const { data: distribution, isLoading: loadingDistribution, error: distributionError } = useTrustBandDistribution();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          V4 summary metrics are now driven from the backend overview endpoint while the
          existing breakdown views remain available below.
        </p>
      </div>

      {(overviewError || volumeError || approvalError || distributionError) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          Failed to load analytics data. Please try again later.
        </div>
      )}

      <section>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loadingOverview && <Skeleton className="h-28 w-full md:col-span-2 xl:col-span-3" />}
          {overview && (
            <>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground uppercase">Total Decisions</p>
                  <p className="mt-2 text-3xl font-bold">{overview.total_decisions}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground uppercase">Approval Rate</p>
                  <p className="mt-2 text-3xl font-bold">{(overview.overall_approval_rate * 100).toFixed(1)}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground uppercase">Avg Trust</p>
                  <p className="mt-2 text-3xl font-bold">{overview.avg_trust_score.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground uppercase">Human Review Queue</p>
                  <p className="mt-2 text-3xl font-bold">{overview.human_review_queue_depth}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground uppercase">Contracts</p>
                  <p className="mt-2 text-3xl font-bold">{overview.total_contracts}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground uppercase">This Period</p>
                  <p className="mt-2 text-3xl font-bold">{overview.decisions_this_month}</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
        {overview && <p className="mt-3 text-xs text-muted-foreground">{overview.note}</p>}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Approval Rate</h2>
        {loadingApproval && <Skeleton className="h-32 w-full" />}
        {approval && (
          <Card>
            <CardContent className="pt-5">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">{approval.overall.total}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Approved</p>
                  <p className="text-xl font-bold text-green-700">{approval.overall.approved}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rate</p>
                  <p className="text-xl font-bold">{(approval.overall.rate * 100).toFixed(1)}%</p>
                </div>
              </div>
              {approval.by_trust_band.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">By Trust Band</p>
                  {approval.by_trust_band.map((band) => (
                    <div key={band.trust_band} className="flex justify-between text-sm">
                      <span className="capitalize">{band.trust_band.replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground">{band.approved}/{band.total} ({(band.rate * 100).toFixed(1)}%)</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Trust Band Distribution</h2>
        {loadingDistribution && <Skeleton className="h-24 w-full" />}
        {distribution && distribution.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {distribution.map((band) => {
              const colors: Record<string, string> = {
                auto_approve: "border-green-200 bg-green-50",
                flag_for_review: "border-yellow-200 bg-yellow-50",
                require_human_review: "border-red-200 bg-red-50",
              };
              return (
                <Card key={band.trust_band} className={colors[band.trust_band]}>
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground capitalize">{band.trust_band.replace(/_/g, " ")}</p>
                    <p className="text-2xl font-bold mt-1">{band.count}</p>
                    <p className="text-xs text-muted-foreground mt-1">{band.percentage.toFixed(1)}%</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        {!loadingDistribution && (!distribution || distribution.length === 0) && (
          <p className="text-sm text-muted-foreground">No distribution data.</p>
        )}
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Decision Volume (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingVolume && <Skeleton className="h-48 w-full" />}
            {volume && volume.length > 0 && (
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Date</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Decisions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {volume.map((row) => (
                      <tr key={row.date} className="border-b last:border-0">
                        <td className="px-4 py-2">{new Date(row.date).toLocaleDateString()}</td>
                        <td className="px-4 py-2 text-right font-mono">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!loadingVolume && (!volume || volume.length === 0) && (
              <p className="text-sm text-muted-foreground">No volume data.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">Detailed Analytics</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Link to="/analytics/overview" className="block rounded-lg border p-4 hover:bg-accent transition-colors">
            <p className="font-medium">Overview</p>
            <p className="text-sm text-muted-foreground">Cross-contract compliance intelligence</p>
          </Link>
          <Link to="/analytics/compliance" className="block rounded-lg border p-4 hover:bg-accent transition-colors">
            <p className="font-medium">Compliance</p>
            <p className="text-sm text-muted-foreground">Approval rates and violation patterns</p>
          </Link>
          <Link to="/analytics/wages" className="block rounded-lg border p-4 hover:bg-accent transition-colors">
            <p className="font-medium">Wages</p>
            <p className="text-sm text-muted-foreground">Prevailing wage compliance analysis</p>
          </Link>
          <Link to="/analytics/llm" className="block rounded-lg border p-4 hover:bg-accent transition-colors">
            <p className="font-medium">LLM Performance</p>
            <p className="text-sm text-muted-foreground">Model performance and cost efficiency</p>
          </Link>
        </div>
      </div>

      <CostDashboard />
    </div>
  );
}
