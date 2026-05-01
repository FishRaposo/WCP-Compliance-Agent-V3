import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ChartCard } from "./ChartCard";
import type { Period } from "./AnalyticsLayout";

export interface LatencyByModel {
  model: string;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
}

interface LatencyByModelChartProps {
  period: Period;
  data?: LatencyByModel[];
  loading?: boolean;
}

function LatencyByModelTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: LatencyByModel }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-background border rounded-md p-3 shadow-sm text-xs">
      <p className="font-medium mb-1">{d.model}</p>
      <p>P50: {d.p50_ms.toLocaleString()}ms</p>
      <p>P95: {d.p95_ms.toLocaleString()}ms</p>
      <p>P99: {d.p99_ms.toLocaleString()}ms</p>
    </div>
  );
}

function getLatencyColor(p99: number): string {
  if (p99 < 2000) return "#22c55e";
  if (p99 < 5000) return "#f59e0b";
  return "#ef4444";
}

export function LatencyByModelChart({ period: _period, data = [], loading }: LatencyByModelChartProps) {
  return (
    <ChartCard title="Latency by Model" subtitle="P50, P95, P99 latency in milliseconds" loading={loading} className="md:col-span-2">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="model" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => `${v}ms`} tick={{ fontSize: 12 }} />
          <Tooltip content={<LatencyByModelTooltip />} />
          <Legend />
          <Bar dataKey="p50_ms" name="P50" barSize={20}>
            {data.map((entry, i) => (
              <Cell key={i} fill={getLatencyColor(entry.p99_ms)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}