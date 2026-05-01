import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { ChartCard } from "./ChartCard";

interface ApprovalRateData {
  approved: number;
  flagged: number;
  rejected: number;
  total: number;
}

interface ApprovalRateChartProps {
  data?: ApprovalRateData;
  loading?: boolean;
}

const COLORS = {
  approved: "#22c55e",
  flagged: "#f59e0b",
  rejected: "#ef4444",
};

export function ApprovalRateChart({ data, loading }: ApprovalRateChartProps) {
  if (!data) {
    return (
      <ChartCard title="Approval Rate" loading={loading}>
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data available</div>
      </ChartCard>
    );
  }

  const chartData = [
    { name: "Approved", value: data.approved },
    { name: "Flagged", value: data.flagged },
    { name: "Rejected", value: data.rejected },
  ].filter((d) => d.value > 0);

  return (
    <ChartCard title="Approval Rate" subtitle={`Total: ${data.total} decisions`} loading={loading}>
      <div className="relative">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={chartData}
              innerRadius={60}
              outerRadius={90}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.name === "Approved" ? COLORS.approved : entry.name === "Flagged" ? COLORS.flagged : COLORS.rejected} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => [`${v} (${((v as number) / data.total * 100).toFixed(1)}%)`, ""]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: "-20px" }}>
          <div className="text-center">
            <p className="text-2xl font-bold">{data.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
