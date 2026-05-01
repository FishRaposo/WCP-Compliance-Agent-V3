import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/utils/api-client";
import type { PaginatedContracts } from "@/types/v4";

export default function Contracts() {
  const [data, setData] = useState<PaginatedContracts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<PaginatedContracts>("/api/contracts")
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load contracts"));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Contracts</h1>
        <p className="text-sm text-muted-foreground">Manage V4 contract records and linked compliance activity.</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!data && !error && <Skeleton className="h-28 w-full" />}

      <div className="grid gap-3">
        {data?.items.map((contract) => (
          <Card key={contract.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">{contract.project_name}</CardTitle>
                <Badge variant={contract.status === "active" ? "default" : "secondary"}>{contract.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm md:grid-cols-4">
              <div><span className="text-muted-foreground">Contract</span><p className="font-medium">{contract.contract_number}</p></div>
              <div><span className="text-muted-foreground">Contractor</span><p className="font-medium">{contract.contractor_name}</p></div>
              <div><span className="text-muted-foreground">Locality</span><p className="font-medium">{contract.locality}</p></div>
              <div><span className="text-muted-foreground">Activity</span><p className="font-medium">{contract.decision_count} decisions · {contract.payroll_record_count} payrolls</p></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
