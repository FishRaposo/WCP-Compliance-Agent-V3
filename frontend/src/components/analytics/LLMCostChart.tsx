import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartCard } from "./ChartCard";
import type { Period } from "./AnalyticsLayout";

interface LLMCostData {
  date: string;
  cost_usd: number;
  decisions: number;
  total_cost: number;
}

interface LLMCostChartProps {
  period: Period;
  data?: LLMCostData[];
  loading?: boolean;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function LLMCostTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="bg-background border rounded-md p-3 shadow-sm text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.name.includes("cost") ? `$${entry.value.toFixed(3)}` : entry.value}
        </p>
      ))}
    </div>
  );
}

export function LLMCostChart({ period: _period, data = [], loading }: LLMCostChartProps) {
  return (
    <ChartCard title="LLM Cost Trend" subtitle="Total cost and cost per decision over period" loading={loading}>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} />
          <YAxis yAxisId="total" orientation="left" tickFormatter={(v) => `$${v.toFixed(2)}`} tick={{ fontSize: 12 }} />
          <YAxis yAxisId="per_decision" orientation="right" tickFormatter={(v) => `$${v.toFixed(3)}`} tick={{ fontSize: 12 }} />
          <Tooltip content={<LLMCostTooltip />} />
          <Legend />
          <Bar yAxisId="total" dataKey="total_cost" fill="#3b82f6" opacity={0.3} name="Total Cost" />
          <Line yAxisId="per_decision" type="monotone" dataKey="cost_usd" stroke="#22c55e" strokeWidth={2} dot={false} name="Cost/Decision" />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}