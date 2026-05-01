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

export interface LocalityCompliance {
  locality: string;
  total: number;
  approval_rate: number;
}

interface ApprovalRateByLocalityProps {
  period: Period;
  data?: LocalityCompliance[];
  loading?: boolean;
}

function ApprovalRateByLocalityTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: LocalityCompliance }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-background border rounded-md p-3 shadow-sm text-xs">
      <p className="font-medium mb-1">{d.locality}</p>
      <p>Total: {d.total}</p>
      <p>Approval Rate: {d.approval_rate.toFixed(1)}%</p>
    </div>
  );
}

function getApprovalColor(rate: number): string {
  if (rate > 90) return "#22c55e";
  if (rate > 70) return "#f59e0b";
  return "#ef4444";
}

export function ApprovalRateByLocality({ data = [], loading }: ApprovalRateByLocalityProps) {
  const sorted = [...data].sort((a, b) => b.approval_rate - a.approval_rate);
  return (
    <ChartCard title="Approval Rate by Locality" subtitle="Horizontal bars colored by rate" loading={loading}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={sorted} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
          <YAxis dataKey="locality" type="category" width={120} tick={{ fontSize: 12 }} />
          <Tooltip content={<ApprovalRateByLocalityTooltip />} />
          <Bar dataKey="approval_rate" name="Approval Rate" radius={[0, 4, 4, 0]}>
            {sorted.map((entry, i) => (
              <Cell key={i} fill={getApprovalColor(entry.approval_rate)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
