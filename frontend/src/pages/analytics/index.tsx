import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KPICard } from "@/components/analytics/KPICard";
import { AnalyticsLayout } from "@/components/analytics/AnalyticsLayout";
import { DecisionVolumeChart } from "@/components/analytics/DecisionVolumeChart";
import { ApprovalRateChart } from "@/components/analytics/ApprovalRateChart";
import { TrustScoreTrend } from "@/components/analytics/TrustScoreTrend";
import { LiveFeed } from "@/components/analytics/LiveFeed";
import type { Period } from "@/components/analytics/AnalyticsLayout";
import { apiClient } from "@/utils/api-client";
import type { ApprovalRateResponse } from "@/types/api";

// V4 Overview response shape
interface OverviewData {
  total_decisions: number;
  total_contracts: number;
  avg_trust_score: number;
  overall_approval_rate: number;
  human_review_queue_depth: number;
  decisions_this_month: number;
  note?: string;
}

// V4 DecisionVolume response shape (same as V3 DecisionVolume)
interface DecisionVolumeData {
  date: string;
  count: number;
  avg_trust?: number;
}

// Derived approval breakdown for chart
interface ApprovalBreakdown {
  approved: number;
  flagged: number;
  rejected: number;
  total: number;
}

export default function AnalyticsIndex() {
  const [period, setPeriod] = useState<Period>("30d");

  const { data: overview, error: overviewError } = useQuery<OverviewData>({
    queryKey: ["analytics", "v4", "overview", period],
    queryFn: () => apiClient.get(`/api/v4/analytics/overview`, { period }),
  });

  const { data: volume, isLoading: loadingVolume, error: volumeError } = useQuery<DecisionVolumeData[]>({
    queryKey: ["analytics", "v4", "decision-volume", period],
    queryFn: () => apiClient.get(`/api/v4/analytics/decision-volume`, { period }),
  });

  const { data: approvalData, isLoading: loadingApproval, error: approvalError } = useQuery<ApprovalRateResponse>({
    queryKey: ["analytics", "v4", "approval", period],
    queryFn: () => apiClient.get(`/api/v4/analytics/approval`, { period }),
  });

  const approvalBreakdown: ApprovalBreakdown | undefined = approvalData
    ? {
        approved: approvalData.overall.approved,
        flagged: approvalData.by_trust_band.find((b) => b.trust_band === "flag_for_review")?.total ?? 0,
        // NOTE: Backend doesn't expose a "rejected" trust band. This count includes
        // both genuinely rejected items and those flagged for human review.
        rejected:
          approvalData.by_trust_band.find((b) => b.trust_band === "rejected")?.total ??
          approvalData.overall.total - approvalData.overall.approved,
        total: approvalData.overall.total,
      }
    : undefined;

  return (
    <AnalyticsLayout
      title="Analytics Overview"
      description="Cross-contract compliance intelligence"
      showPeriodSelector
      defaultPeriod="30d"
      currentPeriod={period}
      onPeriodChange={setPeriod}
    >
      {(overviewError || volumeError || approvalError) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          Failed to load analytics data. Please try again later.
        </div>
      )}

      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total Decisions"
          value={overview?.total_decisions ?? 0}
        />
        <KPICard
          label="Approval Rate"
          value={overview?.overall_approval_rate ?? 0}
          format="percent"
        />
        <KPICard
          label="Avg Trust Score"
          value={overview?.avg_trust_score ?? 0}
        />
        <KPICard
          label="Human Review Queue"
          value={overview?.human_review_queue_depth ?? 0}
        />
      </div>

      {/* Decision Volume Chart */}
      <DecisionVolumeChart period={period} data={volume} loading={loadingVolume} />

      {/* Second Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <ApprovalRateChart data={approvalBreakdown} loading={loadingApproval} />
        <TrustScoreTrend period={period} data={volume} loading={loadingVolume} />
      </div>

      {/* Live Feed - full width */}
      <LiveFeed maxItems={50} />
    </AnalyticsLayout>
  );
}
