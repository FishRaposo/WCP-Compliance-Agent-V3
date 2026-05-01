import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { ChartCard } from "./ChartCard";
import type { Period } from "./AnalyticsLayout";

interface WageViolationTrendData {
  date: string;
  violations: number;
  total_checked: number;
  violation_rate: number;
}

interface WageViolationTrendChartProps {
  period: Period;
  data?: WageViolationTrendData[];
  loading?: boolean;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function WageViolationTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="bg-background border rounded-md p-3 shadow-sm text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.name === "violation_rate" ? `${entry.value.toFixed(1)}%` : entry.value}
        </p>
      ))}
    </div>
  );
}

export function WageViolationTrendChart({ period: _period, data = [], loading }: WageViolationTrendChartProps) {
  return (
    <ChartCard title="Wage Violation Trend" subtitle="Violation count and rate over period" loading={loading}>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} />
          <YAxis yAxisId="count" orientation="left" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="rate" orientation="right" domain={[0, 30]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
          <Tooltip content={<WageViolationTooltip />} />
          <Legend />
          <ReferenceLine yAxisId="rate" y={15} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "Target", position: "right", fontSize: 10 }} />
          <Line yAxisId="count" type="monotone" dataKey="violations" stroke="#ef4444" strokeWidth={2} dot={false} name="Violations" />
          <Line yAxisId="rate" type="monotone" dataKey="violation_rate" stroke="#f59e0b" strokeWidth={2} dot={false} name="Violation Rate" />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}