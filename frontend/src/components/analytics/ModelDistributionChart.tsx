import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { ChartCard } from "./ChartCard";

export interface ModelDistribution {
  model: string;
  count: number;
  percentage: number;
  avg_cost: number;
}

interface ModelDistributionChartProps {
  data?: ModelDistribution[];
  loading?: boolean;
}

const COLORS = ["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b"];

function ModelDistributionTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ModelDistribution }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-background border rounded-md p-3 shadow-sm text-xs">
      <p className="font-medium mb-1">{d.model}</p>
      <p>Count: {d.count.toLocaleString()}</p>
      <p>Percentage: {d.percentage.toFixed(1)}%</p>
      <p>Avg Cost: ${d.avg_cost.toFixed(3)}</p>
    </div>
  );
}

export function ModelDistributionChart({ data = [], loading }: ModelDistributionChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <ChartCard title="Model Distribution" subtitle="Usage by LLM provider/model" loading={loading}>
      <div className="relative">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              innerRadius={60}
              outerRadius={90}
              dataKey="count"
              nameKey="model"
              label={({ model, percentage }) => `${model}: ${percentage.toFixed(0)}%`}
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ModelDistributionTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: "-20px" }}>
          <div className="text-center">
            <p className="text-2xl font-bold">{(total / 1000).toFixed(1)}K</p>
            <p className="text-xs text-muted-foreground">Total Calls</p>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
