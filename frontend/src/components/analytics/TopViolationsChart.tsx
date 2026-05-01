import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ChartCard } from "./ChartCard";
import type { Period } from "./AnalyticsLayout";

interface ViolationType {
  type: string;
  count: number;
  percentage: number;
}

interface TopViolationsChartProps {
  period: Period;
  data?: ViolationType[];
  loading?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  base_wage: "Base Wage",
  overtime: "Overtime",
  fringe: "Fringe",
  signature: "Signature",
};

function TopViolationsTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ViolationType }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-background border rounded-md p-3 shadow-sm text-xs">
      <p className="font-medium">{TYPE_LABELS[d.type] || d.type}</p>
      <p>Count: {d.count}</p>
      <p>Percentage: {d.percentage.toFixed(1)}%</p>
    </div>
  );
}

export function TopViolationsChart({ data = [], loading }: TopViolationsChartProps) {
  const sorted = [...data].sort((a, b) => b.percentage - a.percentage);
  return (
    <ChartCard title="Top Violations" subtitle="Violation types by frequency" loading={loading}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={sorted} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
          <YAxis dataKey="type" type="category" width={80} tick={{ fontSize: 12 }} tickFormatter={(v) => TYPE_LABELS[v] || v} />
          <Tooltip content={<TopViolationsTooltip />} />
          <Bar dataKey="percentage" radius={[0, 4, 4, 0]} name="Percentage">
            {sorted.map((_entry, i) => (
              <Cell key={i} fill="#f59e0b" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
