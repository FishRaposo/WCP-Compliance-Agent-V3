import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartCard } from "./ChartCard";
import type { Period } from "./AnalyticsLayout";

interface TokenUsageData {
  date: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface TokenUsageChartProps {
  period: Period;
  data?: TokenUsageData[];
  loading?: boolean;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function TokenUsageTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="bg-background border rounded-md p-3 shadow-sm text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

export function TokenUsageChart({ period: _period, data = [], loading }: TokenUsageChartProps) {
  return (
    <ChartCard title="Token Usage" subtitle="Prompt and completion tokens over period" loading={loading}>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 12 }} />
          <Tooltip content={<TokenUsageTooltip />} />
          <Legend />
          <Area type="monotone" dataKey="prompt_tokens" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Prompt Tokens" />
          <Area type="monotone" dataKey="completion_tokens" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} name="Completion Tokens" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}