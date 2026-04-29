import { useDecisionStream } from "../hooks/useDecisionStream.ts";
import { useDecisions } from "../hooks/useDecisions.ts";
import { useApprovalByTrade } from "../hooks/useAnalytics.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const VERDICT_STYLES: Record<string, string> = {
  approved: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
};

function getVerdictStyle(verdict: string): string {
  return VERDICT_STYLES[verdict] ?? "bg-yellow-50 text-yellow-700";
}

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
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Decisions</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingApproval ? <Skeleton className="h-8 w-16" /> : (
              <p className="text-2xl font-bold">{totalDecisions}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approval Rate</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingApproval ? <Skeleton className="h-8 w-16" /> : (
              <p className="text-2xl font-bold">{(approvalRate * 100).toFixed(1)}%</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Trust Score</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDecisions ? <Skeleton className="h-8 w-16" /> : (
              <p className="text-2xl font-bold">{(avgTrust * 100).toFixed(0)}%</p>
            )}
          </CardContent>
        </Card>
      </div>

      {latestDecision && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-5">
            <p className="text-xs font-semibold text-blue-700 uppercase">New Decision (SSE)</p>
            <p className="text-sm text-blue-900 mt-1">
              Job <span className="font-mono">{latestDecision.job_id.slice(0, 8)}</span>{" "}
              — {latestDecision.verdict.replace(/_/g, " ")} —{" "}
              {(latestDecision.trust_score * 100).toFixed(0)}% trust
            </p>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-medium mb-3">Recent Decisions</h2>
        {loadingDecisions && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        )}
        {!loadingDecisions && (!recentDecisions || recentDecisions.length === 0) && (
          <p className="text-sm text-muted-foreground">No decisions yet.</p>
        )}
        <div className="space-y-2">
          {recentDecisions?.map((d) => (
            <Card key={d.decision_id}>
              <CardContent className="py-3 px-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Badge variant={d.verdict === "approved" ? "default" : d.verdict === "rejected" ? "destructive" : "secondary"} className="capitalize">
                    {d.verdict.replace(/_/g, " ")}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">{d.job_id.slice(0, 8)}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{d.violation_count} violation{d.violation_count !== 1 ? "s" : ""}</span>
                  <span>{(d.trust_score * 100).toFixed(0)}% trust</span>
                  <span>{new Date(d.created_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
