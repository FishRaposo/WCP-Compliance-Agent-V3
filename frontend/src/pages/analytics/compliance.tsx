import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KPICard } from "@/components/analytics/KPICard";
import { AnalyticsLayout } from "@/components/analytics/AnalyticsLayout";
import { ApprovalRateByTradeChart, type TradeCompliance } from "@/components/analytics/ApprovalRateByTradeChart";
import { ApprovalRateByLocality, type LocalityCompliance } from "@/components/analytics/ApprovalRateByLocality";
import type { Period } from "@/components/analytics/AnalyticsLayout";
import { apiClient } from "@/utils/api-client";

// V4 compliance summary response
interface ComplianceSummary {
  by_trade: TradeCompliance[];
  by_locality: LocalityCompliance[];
  violation_types: { type: string; count: number; percentage: number }[];
}

export default function AnalyticsCompliance() {
  const [period, setPeriod] = useState<Period>("30d");

  const { data: summary, isLoading } = useQuery<ComplianceSummary>({
    queryKey: ["analytics", "v4", "compliance", period],
    queryFn: () => apiClient.get(`/api/analytics/compliance`, { period }),
  });
  const totalDecisions =
    summary?.by_locality.reduce((total, locality) => total + locality.total, 0) ??
    summary?.by_trade.reduce((total, trade) => total + trade.total, 0) ??
    0;
  const approvalRate =
    summary?.by_locality.length && totalDecisions > 0
      ? summary.by_locality.reduce(
          (weighted, locality) => weighted + locality.approval_rate * locality.total,
          0
        ) / totalDecisions
      : 0;

  return (
    <AnalyticsLayout
      title="Compliance Analytics"
      description="Approval rates, violation patterns, and regulatory coverage"
      showPeriodSelector
      defaultPeriod="30d"
      currentPeriod={period}
      onPeriodChange={setPeriod}
    >
      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total Decisions"
          value={totalDecisions}
        />
        <KPICard
          label="Approval Rate"
          value={approvalRate}
          format="percent"
        />
        <KPICard
          label="Trades Covered"
          value={summary?.by_trade.length ?? 0}
        />
        <KPICard
          label="Localities"
          value={summary?.by_locality.length ?? 0}
        />
      </div>

      {/* Approval Rate by Trade - full width */}
      <ApprovalRateByTradeChart period={period} data={summary?.by_trade} loading={isLoading} />

      {/* Second Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <ApprovalRateByLocality period={period} data={summary?.by_locality} loading={isLoading} />
      </div>
    </AnalyticsLayout>
  );
}
