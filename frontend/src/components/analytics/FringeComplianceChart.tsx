import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { ChartCard } from "./ChartCard";
import type { Period } from "./AnalyticsLayout";

interface FringeComplianceData {
  date: string;
  compliant_pct: number;
}

interface FringeComplianceChartProps {
  period: Period;
  data?: FringeComplianceData[];
  loading?: boolean;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function FringeComplianceTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="bg-background border rounded-md p-3 shadow-sm text-xs">
      <p className="font-medium mb-1">{label}</p>
      <p>Compliance: {payload[0].value.toFixed(1)}%</p>
    </div>
  );
}

export function FringeComplianceChart({ data = [], loading }: FringeComplianceChartProps) {
  return (
    <ChartCard title="Fringe Compliance Rate" subtitle="Fringe benefit compliance over period" loading={loading}>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} />
          <YAxis domain={[70, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
          <Tooltip content={<FringeComplianceTooltip />} />
          <ReferenceLine y={90} stroke="#22c55e" strokeDasharray="5 5" label={{ value: "Target 90%", position: "right", fontSize: 10 }} />
          <Line type="monotone" dataKey="compliant_pct" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Fringe Compliance" />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
