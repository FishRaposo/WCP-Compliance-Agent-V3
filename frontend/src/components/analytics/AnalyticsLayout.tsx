import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { analyticsPageRoute } from "./index";

export type Period = "7d" | "30d" | "90d" | "365d";

export interface AnalyticsLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
  showPeriodSelector?: boolean;
  defaultPeriod?: Period;
  onPeriodChange?: (period: Period) => void;
  currentPeriod?: Period;
}

export function AnalyticsLayout({
  title,
  description,
  children,
  showPeriodSelector = true,
  defaultPeriod = "30d",
  onPeriodChange,
  currentPeriod = defaultPeriod,
}: AnalyticsLayoutProps) {
  const periods: Period[] = ["7d", "30d", "90d", "365d"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link to={analyticsPageRoute}>
              <Button variant="ghost" size="sm" className="gap-1 px-0 hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Analytics Overview
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {showPeriodSelector && onPeriodChange && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Period:</span>
            <div className="flex rounded-md border bg-background">
              {periods.map((p) => (
                <button
                  key={p}
                  onClick={() => onPeriodChange(p)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-md last:rounded-r-md ${
                    currentPeriod === p
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {p === "365d" ? "1Y" : p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
