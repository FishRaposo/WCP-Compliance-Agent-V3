import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ChartCard } from "./ChartCard";

export interface ActualVsRequired {
  locality: string;
  trade: string;
  required: number;
  actual_avg: number;
  compliant_pct: number;
  total: number;
}

interface ActualVsRequiredScatterProps {
  data?: ActualVsRequired[];
  loading?: boolean;
}

function ActualVsRequiredTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ActualVsRequired }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-background border rounded-md p-3 shadow-sm text-xs">
      <p className="font-medium mb-1">{d.trade} - {d.locality}</p>
      <p>Required: ${d.required.toFixed(2)}/hr</p>
      <p>Actual: ${d.actual_avg.toFixed(2)}/hr</p>
      <p>Compliance: {d.compliant_pct.toFixed(1)}%</p>
      <p>Decisions: {d.total}</p>
    </div>
  );
}

export function ActualVsRequiredScatter({ data = [], loading }: ActualVsRequiredScatterProps) {
  const minVal = data.length > 0 ? Math.min(...data.map((d) => Math.min(d.required, d.actual_avg))) : 0;
  const maxVal = data.length > 0 ? Math.max(...data.map((d) => Math.max(d.required, d.actual_avg))) : 100;

  return (
    <ChartCard title="Actual vs Required Wage" subtitle="Scatter plot with compliance coloring" loading={loading} className="md:col-span-2">
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis type="number" dataKey="required" name="Required Wage" unit="$/hr" domain={[minVal - 5, maxVal + 5]} tick={{ fontSize: 12 }} />
          <YAxis type="number" dataKey="actual_avg" name="Actual Wage" unit="$/hr" domain={[minVal - 5, maxVal + 5]} tick={{ fontSize: 12 }} />
          <Tooltip content={<ActualVsRequiredTooltip />} />
          <ReferenceLine slope={1} stroke="#666" strokeDasharray="3 3" label="Actual = Required" />
          <Scatter data={data} name="Wage Data">
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.compliant_pct >= 90 ? "#22c55e" : "#ef4444"}
                r={Math.sqrt(entry.total) * 2 + 4}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}