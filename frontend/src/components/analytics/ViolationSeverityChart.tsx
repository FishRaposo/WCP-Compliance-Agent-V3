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

interface ViolationTrendItem {
  date: string;
  base_wage: number;
  overtime: number;
  fringe: number;
  signature: number;
}

interface ViolationSeverityChartProps {
  period: Period;
  data?: ViolationTrendItem[];
  loading?: boolean;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ViolationSeverityTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="bg-background border rounded-md p-3 shadow-sm text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export function ViolationSeverityChart({ period: _period, data = [], loading }: ViolationSeverityChartProps) {
  return (
    <ChartCard title="Violation Severity Trend" subtitle="Stacked by violation type over time" loading={loading} className="md:col-span-2">
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip content={<ViolationSeverityTooltip />} />
          <Legend />
          <Area type="monotone" dataKey="base_wage" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Base Wage" />
          <Area type="monotone" dataKey="overtime" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} name="Overtime" />
          <Area type="monotone" dataKey="fringe" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Fringe" />
          <Area type="monotone" dataKey="signature" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} name="Signature" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}