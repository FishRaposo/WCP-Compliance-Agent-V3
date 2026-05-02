import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export interface KPICardProps {
  label: string;
  value: string | number;
  delta?: number;
  trend?: "up" | "down" | "flat";
  format?: "number" | "percent" | "currency";
  sparkline?: number[];
}

function formatValue(value: string | number, format?: string): string {
  if (typeof value === "string") return value;
  switch (format) {
    case "percent":
      return `${value.toFixed(1)}%`;
    case "currency":
      return `$${value.toFixed(2)}`;
    default:
      return value.toLocaleString();
  }
}

export function KPICard({ label, value, delta, trend, format, sparkline }: KPICardProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-muted-foreground";

  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground uppercase">{label}</p>
        <p className="mt-2 text-3xl font-bold">{formatValue(value, format)}</p>
        {delta !== undefined && (
          <div className={`mt-1 flex items-center gap-1 text-xs ${trendColor}`}>
            <TrendIcon className="h-3 w-3" />
            <span>
              {trend === "up" ? "+" : ""}{delta.toFixed(1)}% vs prev
            </span>
          </div>
        )}
        {sparkline && sparkline.length > 0 && (
          <div className="mt-2 h-8">
            <svg viewBox="0 0 100 20" className="h-full w-full">
              <polyline
                points={sparkline.map((v, i) => `${(i / (sparkline.length - 1)) * 100},${20 - (v / Math.max(...sparkline)) * 18}`).join(" ")}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-primary"
              />
            </svg>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
