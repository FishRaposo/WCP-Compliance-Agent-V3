import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KPICard } from "@/components/analytics/KPICard";
import { AnalyticsLayout } from "@/components/analytics/AnalyticsLayout";
import { WageViolationTrendChart } from "@/components/analytics/WageViolationTrendChart";
import { ActualVsRequiredScatter, type ActualVsRequired } from "@/components/analytics/ActualVsRequiredScatter";
import { FringeComplianceChart } from "@/components/analytics/FringeComplianceChart";
import type { Period } from "@/components/analytics/AnalyticsLayout";
import { apiClient } from "@/utils/api-client";

// V4 wages summary response
interface WageViolationTrendData {
  date: string;
  violations: number;
  total_checked: number;
  violation_rate: number;
}

interface FringeComplianceData {
  date: string;
  compliant_pct: number;
}

interface WagesSummary {
  total_decisions: number;
  violation_rate: number;
  avg_actual_vs_required_diff: number;
  fringe_compliance_rate: number;
  wage_trend: WageViolationTrendData[];
  actual_vs_required: ActualVsRequired[];
  fringe_compliance: FringeComplianceData[];
}

export default function AnalyticsWages() {
  const [period, setPeriod] = useState<Period>("30d");

  const { data: summary, isLoading } = useQuery<WagesSummary>({
    queryKey: ["analytics", "v4", "wages", period],
    queryFn: () => apiClient.get(`/api/analytics/wages`, { period }),
  });

  return (
    <AnalyticsLayout
      title="Wage Analytics"
      description="Prevailing wage compliance, actual vs. required comparisons"
      showPeriodSelector
      defaultPeriod="30d"
      currentPeriod={period}
      onPeriodChange={setPeriod}
    >
      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total Decisions"
          value={summary?.total_decisions ?? 0}
          trend="up"
          delta={8.3}
        />
        <KPICard
          label="Violation Rate"
          value={summary?.violation_rate ?? 0}
          format="percent"
          trend="down"
          delta={-2.1}
        />
        <KPICard
          label="Avg Wages Delta"
          value={summary?.avg_actual_vs_required_diff ?? 0}
          format="currency"
          trend="up"
          delta={1.5}
        />
        <KPICard
          label="Fringe Compliance"
          value={summary?.fringe_compliance_rate ?? 0}
          format="percent"
          trend="up"
          delta={0.8}
        />
      </div>

      {/* Wage Violation Trend - full width */}
      <WageViolationTrendChart period={period} data={summary?.wage_trend} loading={isLoading} />

      {/* Actual vs Required Scatter - full width */}
      <ActualVsRequiredScatter data={summary?.actual_vs_required} loading={isLoading} />

      {/* Fringe Compliance */}
      <FringeComplianceChart period={period} data={summary?.fringe_compliance} loading={isLoading} />
    </AnalyticsLayout>
  );
}