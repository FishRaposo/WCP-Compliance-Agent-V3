import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  loading?: boolean;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, loading, children, className = "" }: ChartCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
