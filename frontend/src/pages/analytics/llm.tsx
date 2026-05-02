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

interface LLMAnalytics {
  cost_per_decision: LLMCostData[];
  token_usage: TokenUsageData[];
  model_distribution: ModelDistribution[];
  latency_by_model: LatencyByModel[];
}

export default function AnalyticsLLM() {
  const [period, setPeriod] = useState<Period>("30d");

  const { data: analytics, isLoading, error } = useQuery<LLMAnalytics>({
    queryKey: ["analytics", "v4", "llm", period],
    queryFn: () => apiClient.get(`/api/v4/analytics/llm`, { period }),
  });

  const summary: LLMSummary = {
    total_cost: analytics?.cost_per_decision.reduce((total, point) => total + point.total_cost, 0) ?? 0,
    cost_per_decision:
      analytics?.cost_per_decision.length
        ? analytics.cost_per_decision.reduce((total, point) => total + point.cost_usd, 0) /
          analytics.cost_per_decision.length
        : 0,
    avg_latency_ms:
      analytics?.latency_by_model.length && analytics?.model_distribution.length
        ? analytics.latency_by_model.reduce((total, point) => {
            const modelCount = analytics.model_distribution.find(m => m.model === point.model)?.count ?? 1;
            return total + point.p50_ms * modelCount;
          }, 0) /
          analytics.model_distribution.reduce((total, m) => total + m.count, 0)
        : 0,
    total_tokens: analytics?.token_usage.reduce((total, point) => total + point.total_tokens, 0) ?? 0,
    decisions: analytics?.cost_per_decision.reduce((total, point) => total + point.decisions, 0) ?? 0,
  };

  return (
    <AnalyticsLayout
      title="LLM Analytics"
      description="Model performance, cost efficiency, and provider distribution"
      showPeriodSelector
      defaultPeriod="30d"
      currentPeriod={period}
      onPeriodChange={setPeriod}
    >
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          Failed to load analytics data. Please try again later.
        </div>
      )}

      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total LLM Cost"
          value={summary.total_cost}
          format="currency"
        />
        <KPICard
          label="Cost per Decision"
          value={summary.cost_per_decision}
          format="currency"
        />
        <KPICard
          label="Avg Latency"
          value={summary.avg_latency_ms}
        />
        <KPICard
          label="Total Tokens"
          value={summary.total_tokens}
        />
      </div>

      {/* Cost Chart - full width */}
      <LLMCostChart period={period} data={analytics?.cost_per_decision} loading={isLoading} />

      {/* Token and Model Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <TokenUsageChart period={period} data={analytics?.token_usage} loading={isLoading} />
        <ModelDistributionChart data={analytics?.model_distribution} loading={isLoading} />
      </div>

      {/* Latency by Model - full width */}
      <LatencyByModelChart period={period} data={analytics?.latency_by_model} loading={isLoading} />
    </AnalyticsLayout>
  );
}
