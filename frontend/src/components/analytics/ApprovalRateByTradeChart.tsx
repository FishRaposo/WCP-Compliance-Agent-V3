import {
  BarChart,
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

export interface TradeCompliance {
  trade: string;
  total: number;
  approved: number;
  flagged: number;
  rejected: number;
  approval_rate: number;
}

interface ApprovalRateByTradeChartProps {
  period: Period;
  data?: TradeCompliance[];
  loading?: boolean;
}

function ApprovalRateByTradeTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TradeCompliance }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-background border rounded-md p-3 shadow-sm text-xs">
      <p className="font-medium mb-1">{d.trade}</p>
      <p>Total: {d.total}</p>
      <p>Approved: {d.approved}</p>
      <p>Flagged: {d.flagged}</p>
      <p>Rejected: {d.rejected}</p>
      <p>Approval Rate: {d.approval_rate.toFixed(1)}%</p>
    </div>
  );
}

export function ApprovalRateByTradeChart({ data = [], loading }: ApprovalRateByTradeChartProps) {
  const sorted = [...data].sort((a, b) => b.total - a.total);
  return (
    <ChartCard title="Approval Rate by Trade" subtitle="Grouped by trade with status breakdown" loading={loading} className="md:col-span-2">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={sorted}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="trade" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip content={<ApprovalRateByTradeTooltip />} />
          <Legend />
          <Bar dataKey="approved" stackId="a" fill="#22c55e" name="Approved" />
          <Bar dataKey="flagged" stackId="a" fill="#f59e0b" name="Flagged" />
          <Bar dataKey="rejected" stackId="a" fill="#ef4444" name="Rejected" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
