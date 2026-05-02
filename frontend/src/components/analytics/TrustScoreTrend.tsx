import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { ChartCard } from "./ChartCard";
import type { Period } from "./AnalyticsLayout";

interface TrustScoreData {
  date: string;
  avg_trust?: number;
  // V4 flat shape may carry these instead
  decisions?: number;
  count?: number;
}

interface TrustScoreTrendProps {
  period: Period;
  data?: TrustScoreData[];
  loading?: boolean;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function TrustScoreTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="bg-background border rounded-md p-3 shadow-sm text-xs">
      <p className="font-medium mb-1">{label}</p>
      <p>Avg Trust: {payload[0].value.toFixed(3)}</p>
    </div>
  );
}

export function TrustScoreTrend({ data = [], loading }: TrustScoreTrendProps) {
  if (!loading && data.length === 0) {
    return (
      <ChartCard title="Trust Score Trend" subtitle="Average trust score over period" loading={loading}>
        <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">
          No trust score data available
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Trust Score Trend" subtitle="Average trust score over period" loading={loading}>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="trustGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)} tick={{ fontSize: 12 }} />
          <Tooltip content={<TrustScoreTooltip />} />
          <ReferenceLine y={0.6} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "Human review threshold", position: "right", fontSize: 10 }} />
          <Area type="monotone" dataKey="avg_trust" stroke="#3b82f6" fill="url(#trustGradient)" strokeWidth={2} name="Avg Trust" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
