import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartCard } from "./ChartCard";
import type { Period } from "./AnalyticsLayout";

// V4 API returns { date: string, count: number }[]
// Chart also supports enriched shape with decisions + approval_rate
interface DecisionVolumeData {
  date: string;
  decisions?: number;
  avg_trust?: number;
  approval_rate?: number;
  // V4 flat shape
  count?: number;
}

interface DecisionVolumeChartProps {
  period: Period;
  data?: DecisionVolumeData[];
  loading?: boolean;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function DecisionVolumeTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="bg-background border rounded-md p-3 shadow-sm text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name === "approval_rate" ? `${entry.name}: ${entry.value.toFixed(1)}%` : `${entry.name}: ${entry.value}`}
        </p>
      ))}
    </div>
  );
}

export function DecisionVolumeChart({ data = [], loading }: DecisionVolumeChartProps) {
  // Normalize V4 flat shape { date, count } to chart shape { date, decisions }
  const normalized = data.map((d) => ({
    date: d.date,
    decisions: d.decisions ?? d.count ?? 0,
    approval_rate: d.approval_rate,
  }));

  return (
    <ChartCard title="Decision Volume" subtitle="Daily decisions over period" loading={loading}>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={normalized}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} />
          <YAxis yAxisId="count" orientation="left" tick={{ fontSize: 12 }} />
          <Tooltip content={<DecisionVolumeTooltip />} />
          <Legend />
          <Bar yAxisId="count" dataKey="decisions" fill="#3b82f6" name="Decisions" />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
