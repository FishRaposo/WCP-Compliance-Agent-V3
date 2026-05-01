import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KPICard } from "@/components/analytics/KPICard";
import { AnalyticsLayout } from "@/components/analytics/AnalyticsLayout";
import { LLMCostChart } from "@/components/analytics/LLMCostChart";
import { TokenUsageChart } from "@/components/analytics/TokenUsageChart";
import { ModelDistributionChart, type ModelDistribution } from "@/components/analytics/ModelDistributionChart";
import { LatencyByModelChart, type LatencyByModel } from "@/components/analytics/LatencyByModelChart";
import type { Period } from "@/components/analytics/AnalyticsLayout";
import { apiClient } from "@/utils/api-client";

interface LLMSummary {
  total_cost: number;
  cost_per_decision: number;
  avg_latency_ms: number;
  total_tokens: number;
  decisions: number;
}

interface LLMCostData {
  date: string;
  cost_usd: number;
  decisions: number;
  total_cost: number;
}

interface TokenUsageData {
  date: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// V4 LLM summary endpoint returns all data in one call
interface LLMAnalytics {
  summary: LLMSummary;
  cost: LLMCostData[];
  tokens: TokenUsageData[];
  model_distribution: ModelDistribution[];
  latency: LatencyByModel[];
}

export default function AnalyticsLLM() {
  const [period, setPeriod] = useState<Period>("30d");

  const { data: analytics, isLoading } = useQuery<LLMAnalytics>({
    queryKey: ["analytics", "v4", "llm", period],
    queryFn: () => apiClient.get(`/api/analytics/llm`, { period }),
  });

  const summary = analytics?.summary;

  return (
    <AnalyticsLayout
      title="LLM Analytics"
      description="Model performance, cost efficiency, and provider distribution"
      showPeriodSelector
      defaultPeriod="30d"
      currentPeriod={period}
      onPeriodChange={setPeriod}
    >
      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total LLM Cost"
          value={summary?.total_cost ?? 0}
          format="currency"
          trend="up"
          delta={15.2}
        />
        <KPICard
          label="Cost per Decision"
          value={summary?.cost_per_decision ?? 0}
          format="currency"
          trend="down"
          delta={-12.4}
        />
        <KPICard
          label="Avg Latency"
          value={summary?.avg_latency_ms ?? 0}
          trend="down"
          delta={-8.1}
        />
        <KPICard
          label="Total Tokens"
          value={summary?.total_tokens ?? 0}
          trend="up"
          delta={8.3}
        />
      </div>

      {/* Cost Chart - full width */}
      <LLMCostChart period={period} data={analytics?.cost} loading={isLoading} />

      {/* Token and Model Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <TokenUsageChart period={period} data={analytics?.tokens} loading={isLoading} />
        <ModelDistributionChart data={analytics?.model_distribution} loading={isLoading} />
      </div>

      {/* Latency by Model - full width */}
      <LatencyByModelChart period={period} data={analytics?.latency} loading={isLoading} />
    </AnalyticsLayout>
  );
}