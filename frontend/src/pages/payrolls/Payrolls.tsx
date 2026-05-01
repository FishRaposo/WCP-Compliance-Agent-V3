import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/utils/api-client";
import type { PaginatedPayrolls } from "@/types/v4";

export default function Payrolls() {
  const [data, setData] = useState<PaginatedPayrolls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<PaginatedPayrolls>("/api/payrolls")
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load payrolls"));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Payrolls</h1>
        <p className="text-sm text-muted-foreground">Browse imported certified payroll records by contract, trade, and week.</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!data && !error && <Skeleton className="h-28 w-full" />}

      <div className="space-y-2">
        {data?.items.map((record) => (
          <Card key={`${record.contract_id}-${record.id}`}>
            <CardContent className="grid gap-2 py-4 text-sm md:grid-cols-6">
              <div className="md:col-span-2"><span className="text-muted-foreground">Employee</span><p className="font-medium">{record.employee_name}</p></div>
              <div><span className="text-muted-foreground">Trade</span><p className="font-medium">{record.trade_code}</p></div>
              <div><span className="text-muted-foreground">Week</span><p className="font-medium">{record.week_ending}</p></div>
              <div><span className="text-muted-foreground">Hours</span><p className="font-medium">{record.total_hours}</p></div>
              <div><span className="text-muted-foreground">Gross</span><p className="font-medium">${record.gross_pay}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
