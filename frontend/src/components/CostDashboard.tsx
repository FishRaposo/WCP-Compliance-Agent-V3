import { useCostAnalytics } from "../hooks/useAnalytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CostDashboard() {
  const { data, isLoading, error } = useCostAnalytics();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Cost per Decision</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-16 w-full" />}
        {error && <p className="text-sm text-destructive">Failed to load cost data.</p>}
        {data && (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total Decisions</p>
              <p className="text-xl font-bold">{data.total_decisions}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">This Month</p>
              <p className="text-xl font-bold">{data.decisions_this_month}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Note</p>
              <p className="text-xs text-muted-foreground mt-1">{data.note}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
