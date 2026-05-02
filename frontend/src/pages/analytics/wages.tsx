import { useState, useMemo } from "react";
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
  violation_trend: WageViolationTrendData[];
  actual_vs_required: Array<
    ActualVsRequired | (Omit<ActualVsRequired, "required" | "total"> & { required_wage: number; total?: number })
  >;
  fringe_compliance: FringeComplianceData[];
}

export default function AnalyticsWages() {
  const [period, setPeriod] = useState<Period>("30d");

  const { data: summary, isLoading } = useQuery<WagesSummary>({
    queryKey: ["analytics", "v4", "wages", period],
    queryFn: () => apiClient.get(`/api/analytics/wages`, { period }),
  });
  const totalChecked = useMemo(() => {
    return summary?.violation_trend.reduce((total, point) => total + point.total_checked, 0) ?? 0;
  }, [summary]);

  const totalViolations = useMemo(() => {
    return summary?.violation_trend.reduce((total, point) => total + point.violations, 0) ?? 0;
  }, [summary]);

  const violationRate = useMemo(() => {
    return totalChecked > 0 ? (totalViolations / totalChecked) * 100 : 0;
  }, [totalChecked, totalViolations]);

  const actualVsRequired = useMemo(() => {
    return summary?.actual_vs_required.map((point) => ({
      ...point,
      required: "required" in point ? point.required : point.required_wage,
      total: "total" in point && point.total !== undefined ? point.total : 1,
    }));
  }, [summary]);

  const avgWageDelta = useMemo(() => {
    return actualVsRequired?.length
      ? actualVsRequired.reduce(
          (total, point) => total + (point.actual_avg - point.required),
          0
        ) / actualVsRequired.length
      : 0;
  }, [actualVsRequired]);

  const fringeCompliance = useMemo(() => {
    return summary?.fringe_compliance.length
      ? summary.fringe_compliance.reduce((total, point) => total + point.compliant_pct, 0) /
        summary.fringe_compliance.length
      : 0;
  }, [summary]);

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
          label="Payroll Checks"
          value={totalChecked}
        />
        <KPICard
          label="Violation Rate"
          value={violationRate}
          format="percent"
        />
        <KPICard
          label="Avg Wages Delta"
          value={avgWageDelta}
          format="currency"
        />
        <KPICard
          label="Fringe Compliance"
          value={fringeCompliance}
          format="percent"
        />
      </div>

      {/* Wage Violation Trend - full width */}
      <WageViolationTrendChart period={period} data={summary?.violation_trend} loading={isLoading} />

      {/* Actual vs Required Scatter - full width */}
      <ActualVsRequiredScatter data={actualVsRequired} loading={isLoading} />

      {/* Fringe Compliance */}
      <FringeComplianceChart period={period} data={summary?.fringe_compliance} loading={isLoading} />
    </AnalyticsLayout>
  );
}
