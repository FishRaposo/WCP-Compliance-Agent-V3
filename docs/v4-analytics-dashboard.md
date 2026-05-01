# V4 Analytics Dashboard Specification

**Wireframe-level specification for V4 analytics dashboard pages, components, and data shapes.**

---

## Overview

V4 adds four analytics pages to the existing React frontend, built with Recharts. Each page contains multiple chart components fed by DuckDB analytical queries through the V4 API. Pages are accessible via a sidebar navigation item.

Current repository baseline still uses `frontend/src/pages/Analytics.tsx` and the existing `useAnalytics.ts` hooks. The file paths and component names below are the V4 target scaffold, not the current implementation.

**Design principles:**
- Consistent layout: page header with period selector + grid of chart cards
- All charts responsive: desktop 2-column grid, mobile single column
- Real-time updates via SSE on the overview page
- Consistent color palette aligned with trust band colors (green/amber/red)

---

## Shared Components

### `AnalyticsLayout`

**File:** `frontend/src/components/analytics/AnalyticsLayout.tsx`

**Purpose:** Shared page wrapper for all analytics pages. Contains period selector and breadcrumb navigation.

**Props:**
```typescript
interface AnalyticsLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
  showPeriodSelector?: boolean;
  defaultPeriod?: Period;
}

type Period = "7d" | "30d" | "90d" | "365d";
```

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  ← Back to Analytics   │   Period: [7d|30d|90d|1y]  │
│  Page Title             │   Last updated: 2m ago    │
│  Page description       │                           │
├─────────────────────────────────────────────────┤
│                                                 │
│  Children (chart grid)                          │
│                                                 │
└─────────────────────────────────────────────────┘
```

### `ChartCard`

**File:** `frontend/src/components/analytics/ChartCard.tsx`

**Purpose:** Reusable card wrapper for each chart. Title, optional subtitle, and the chart.

**Props:**
```typescript
interface ChartCardProps {
  title: string;
  subtitle?: string;
  loading?: boolean;
  children: React.ReactNode;
  className?: string;
}
```

### `PeriodSelector`

**File:** `frontend/src/components/analytics/PeriodSelector.tsx`

**Purpose:** Toggle button group for selecting time period.

**Props:**
```typescript
interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
}
```

**Rendering:** Horizontal button group: `[7D] [30D] [90D] [1Y]`. Active button uses primary color.

### `KPICard`

**File:** `frontend/src/components/analytics/KPICard.tsx`

**Purpose:** Single metric display with trend indicator.

**Props:**
```typescript
interface KPICardProps {
  label: string;
  value: string | number;
  delta?: number;          // Percentage change vs previous period
  trend?: "up" | "down" | "flat";
  format?: "number" | "percent" | "currency";
  sparkline?: number[];    // Mini trend data
}
```

**Rendering:**
```
┌──────────────────┐
│  Label            │
│  1,523            │
│  ▲ +8.3% vs prev │
│  [sparkline ~~~]  │
└──────────────────┘
```

---

## Page 1: Analytics Overview (`/analytics`)

**File:** `frontend/src/pages/analytics/index.tsx`

Current baseline: `frontend/src/pages/Analytics.tsx`.

**Data source:** `GET /api/analytics/overview` + `GET /api/analytics/decision-volume` + SSE real-time events

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Analytics Overview                    Period: [7d|30d|90d|1y]   │
│  Cross-contract compliance intelligence  Last updated: 2m ago   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ KPI:     │  │ KPI:     │  │ KPI:     │  │ KPI:     │        │
│  │ Total    │  │ Approval │  │ Avg      │  │ Cost per │        │
│  │ Decisions│  │ Rate     │  │ Trust    │  │ Decision │        │
│  │ 15,234   │  │ 86.3%    │  │ 0.87     │  │ $0.082   │        │
│  │ ▲+8.3%   │  │ ▲+3.1%   │  │ ▲+0.02   │  │ ▼-12.4%  │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  DecisionVolumeChart                                     │    │
│  │  ┌─────────────────────────────────────────────────────┐│    │
│  │  │  Line chart: daily decisions over period             ││    │
│  │  │  X-axis: dates                                      ││    │
│  │  │  Y-axis (left): decision count                      ││    │
│  │  │  Y-axis (right): approval rate %                    ││    │
│  │  │  Lines: decisions (blue), approval rate (green)      ││    │
│  │  │  Tooltip: date, count, approval rate, avg trust      ││    │
│  │  └─────────────────────────────────────────────────────┘│    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌───────────────────────────┐  ┌───────────────────────────┐  │
│  │  ApprovalRateChart         │  │  TopViolationsChart        │  │
│  │  ┌───────────────────────┐│  │  ┌───────────────────────┐│  │
│  │  │ Donut chart:          ││  │  │ Horizontal bar chart: ││  │
│  │  │ Approved: 86.3%       ││  │  │ Wage: 52.3% ████████ ││  │
│  │  │ Flagged: 10.2%        ││  │  │ Overtime: 25.6% ████  ││  │
│  │  │ Rejected: 3.5%        ││  │  │ Fringe: 16.3% ███     ││  │
│  │  │                       ││  │  │ Signature: 5.8% █      ││  │
│  │  │ Center text: 15,234   ││  │  │                       ││  │
│  │  └───────────────────────┘│  │  └───────────────────────┘│  │
│  └───────────────────────────┘  └───────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────┐  ┌───────────────────────────┐  │
│  │  TrustScoreTrend           │  │  LiveFeed                  │  │
│  │  ┌───────────────────────┐│  │  ┌───────────────────────┐│  │
│  │  │ Area chart:           ││  │  │ Real-time SSE stream: ││  │
│  │  │ X-axis: dates         ││  │  │ • Approved ELEC 0.94  ││  │
│  │  │ Y-axis: trust score   ││  │  │ • Revise PLMB 0.62    ││  │
│  │  │ Area fill: gradient   ││  │  │ • Approved CARP 0.88  ││  │
│  │  │ green (0.85+) to red  ││  │  │ Scrolling list, max   ││  │
│  │  │ Reference line: 0.60  ││  │  │ 50 items, SSE push    ││  │
│  │  └───────────────────────┘│  │  └───────────────────────┘│  │
│  └───────────────────────────┘  └───────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Component Specifications

#### `DecisionVolumeChart`

**File:** `frontend/src/components/analytics/DecisionVolumeChart.tsx`

**Props:**
```typescript
interface DecisionVolumeChartProps {
  period: Period;
  contractId?: string;
}
```

**Recharts config:**
```typescript
<ComposedChart data={data}>
  <XAxis dataKey="date" tickFormatter={formatDate} />
  <YAxis yAxisId="count" orientation="left" />
  <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
  <Tooltip content={<DecisionVolumeTooltip />} />
  <Legend />
  <Line yAxisId="count" type="monotone" dataKey="decisions" stroke="#3b82f6" strokeWidth={2} dot={false} />
  <Line yAxisId="rate" type="monotone" dataKey="approval_rate" stroke="#22c55e" strokeWidth={2} dot={false} />
</ComposedChart>
```

**Data shape (from API):**
```typescript
interface DecisionVolumeData {
  date: string;           // "2025-04-01"
  decisions: number;      // 45
  avg_trust: number;      // 0.87
  approval_rate: number;  // 84.4
}
```

**TanStack Query hook:**
```typescript
const { data, isLoading } = useQuery({
  queryKey: ["analytics", "decision-volume", period, contractId],
  queryFn: () => apiClient.get("/api/analytics/decision-volume", { params: { period, contract_id: contractId } }),
  staleTime: 60_000,
});
```

#### `ApprovalRateChart`

**File:** `frontend/src/components/analytics/ApprovalRateChart.tsx`

**Props:**
```typescript
interface ApprovalRateChartProps {
  period: Period;
  contractId?: string;
}
```

**Recharts config:**
```typescript
const data = [
  { name: "Approved", value: overview.approvalRate, fill: "#22c55e" },
  { name: "Flagged", value: overview.flaggedRate, fill: "#f59e0b" },
  { name: "Rejected", value: overview.rejectedRate, fill: "#ef4444" },
];

<PieChart>
  <Pie data={data} innerRadius={60} outerRadius={80} dataKey="value" label>
    {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
  </Pie>
  <Tooltip formatter={(v) => `${v}%`} />
</PieChart>
```

**Data shape:** Derived from `/api/analytics/overview` response.

#### `TopViolationsChart`

**File:** `frontend/src/components/analytics/TopViolationsChart.tsx`

**Props:**
```typescript
interface TopViolationsChartProps {
  period: Period;
  contractId?: string;
}
```

**Recharts config:**
```typescript
<BarChart data={violationTypes} layout="vertical">
  <XAxis type="number" tickFormatter={(v) => `${v}%`} />
  <YAxis dataKey="type" type="category" width={80} />
  <Tooltip formatter={(v) => `${v}%`} />
  <Bar dataKey="percentage" fill="#f59e0b" radius={[0, 4, 4, 0]} />
</BarChart>
```

**Data shape (from API):**
```typescript
interface ViolationType {
  type: string;       // "base_wage" | "overtime" | "fringe" | "signature"
  count: number;      // 45
  percentage: number; // 52.3
}
```

#### `TrustScoreTrend`

**File:** `frontend/src/components/analytics/TrustScoreTrend.tsx`

**Props:**
```typescript
interface TrustScoreTrendProps {
  period: Period;
  contractId?: string;
}
```

**Recharts config:**
```typescript
<AreaChart data={data}>
  <XAxis dataKey="date" tickFormatter={formatDate} />
  <YAxis domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)} />
  <Tooltip formatter={(v) => v.toFixed(3)} />
  <ReferenceLine y={0.60} stroke="#ef4444" strokeDasharray="5 5" label="Human review threshold" />
  <defs>
    <linearGradient id="trustGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
    </linearGradient>
  </defs>
  <Area type="monotone" dataKey="avg_trust" stroke="#3b82f6" fill="url(#trustGradient)" strokeWidth={2} />
</AreaChart>
```

**Data shape:** Same `DecisionVolumeData[]` from decision-volume endpoint.

#### `LiveFeed`

**File:** `frontend/src/components/analytics/LiveFeed.tsx`

**Props:**
```typescript
interface LiveFeedProps {
  maxItems?: number;  // default 50
}
```

**Implementation:**
```typescript
const [events, setEvents] = useState<DecisionEvent[]>([]);

useEffect(() => {
  const es = new EventSource("/api/events/subscribe");
  es.onmessage = (e) => {
    const event: DecisionEvent = JSON.parse(e.data);
    setEvents(prev => [event, ...prev].slice(0, maxItems));
  };
  return () => es.close();
}, [maxItems]);
```

**Data shape (from SSE):**
```typescript
interface DecisionEvent {
  decision_id: string;
  status: string;       // "Approved" | "Revise" | "Rejected"
  trust_score: number;
  trade: string;
  locality: string;
  model_used: string;
  timestamp: string;
}
```

**Rendering:** Scrollable list of events. Each item shows status badge (colored by verdict), trade, locality, trust score, and relative timestamp.

---

## Page 2: Compliance Analytics (`/analytics/compliance`)

**File:** `frontend/src/pages/analytics/compliance.tsx`

**Data source:** `GET /api/analytics/compliance`

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Analytics Overview       Period: [7d|30d|90d|1y]              │
│  Compliance Analytics                                            │
│  Approval rates, violation patterns, and regulatory coverage     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ApprovalRateByTradeChart                                │    │
│  │  ┌─────────────────────────────────────────────────────┐│    │
│  │  │  Grouped bar chart:                                  ││    │
│  │  │  X-axis: trades (Electrician, Plumber, Carpenter...) ││    │
│  │  │  Y-axis: count                                       ││    │
│  │  │  Bars per trade: Approved (green), Flagged (amber),  ││    │
│  │  │                    Rejected (red)                     ││    │
│  │  │  Sorted by total descending                          ││    │
│  │  │  Tooltip: trade name, counts, approval rate          ││    │
│  │  └─────────────────────────────────────────────────────┘│    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌───────────────────────────┐  ┌───────────────────────────┐  │
│  │  ApprovalRateByLocality    │  │  ViolationSeverityChart   │  │
│  │  ┌───────────────────────┐│  │  ┌───────────────────────┐│  │
│  │  │ Heatmap:              ││  │  │ Stacked area chart:   ││  │
│  │  │ X: locality           ││  │  │ X-axis: dates         ││  │
│  │  │ Y: (single row)       ││  │  │ Y-axis: count         ││  │
│  │  │ Color: approval %     ││  │  │ Areas stacked:        ││  │
│  │  │   green (>90%) →      ││  │  │  base_wage, overtime, ││  │
│  │  │   amber (70-90%) →    ││  │  │  fringe, signature    ││  │
│  │  │   red (<70%)          ││  │  │                       ││  │
│  │  └───────────────────────┘│  │  └───────────────────────┘│  │
│  └───────────────────────────┘  └───────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Component Specifications

#### `ApprovalRateByTradeChart`

**File:** `frontend/src/components/analytics/ApprovalRateByTradeChart.tsx`

**Props:**
```typescript
interface ApprovalRateByTradeChartProps {
  period: Period;
  contractId?: string;
}
```

**Recharts config:**
```typescript
<BarChart data={byTrade}>
  <XAxis dataKey="trade" angle={-45} textAnchor="end" height={100} />
  <YAxis />
  <Tooltip />
  <Legend />
  <Bar dataKey="approved" stackId="a" fill="#22c55e" />
  <Bar dataKey="flagged" stackId="a" fill="#f59e0b" />
  <Bar dataKey="rejected" stackId="a" fill="#ef4444" />
</BarChart>
```

**Data shape:**
```typescript
interface TradeCompliance {
  trade: string;         // "Electrician"
  total: number;         // 120
  approved: number;      // 102
  flagged: number;       // 15
  rejected: number;      // 3
  approval_rate: number; // 85.0
}
```

#### `ApprovalRateByLocality`

**File:** `frontend/src/components/analytics/ApprovalRateByLocality.tsx`

**Recharts config:** Horizontal bar chart with conditional fill color.

```typescript
<BarChart data={byLocality} layout="vertical">
  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
  <YAxis dataKey="locality" type="category" width={120} />
  <Tooltip formatter={(v) => `${v}%`} />
  <Bar dataKey="approval_rate">
    {data.map((entry, i) => (
      <Cell key={i} fill={entry.approval_rate > 90 ? "#22c55e" : entry.approval_rate > 70 ? "#f59e0b" : "#ef4444"} />
    ))}
  </Bar>
</BarChart>
```

**Data shape:**
```typescript
interface LocalityCompliance {
  locality: string;       // "Boston, MA"
  total: number;          // 200
  approval_rate: number;  // 87.5
}
```

#### `ViolationSeverityChart`

**File:** `frontend/src/components/analytics/ViolationSeverityChart.tsx`

**Recharts config:** Stacked area chart showing violation types over time.

```typescript
<AreaChart data={trendData}>
  <XAxis dataKey="date" />
  <YAxis />
  <Tooltip />
  <Legend />
  <Area type="monotone" dataKey="base_wage" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
  <Area type="monotone" dataKey="overtime" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} />
  <Area type="monotone" dataKey="fringe" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
  <Area type="monotone" dataKey="signature" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
</AreaChart>
```

**Data shape:** Derived from compliance endpoint's `violation_trend` with additional per-type breakdown.

---

## Page 3: Wage Analytics (`/analytics/wages`)

**File:** `frontend/src/pages/analytics/wages.tsx`

**Data source:** `GET /api/analytics/wages`

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Analytics Overview       Period: [7d|30d|90d|1y]              │
│  Wage Analytics                                                  │
│  Prevailing wage compliance, actual vs. required comparisons     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  WageViolationTrendChart                                 │    │
│  │  ┌─────────────────────────────────────────────────────┐│    │
│  │  │  Line chart:                                         ││    │
│  │  │  X-axis: dates                                       ││    │
│  │  │  Y-axis (left): violation count                      ││    │
│  │  │  Y-axis (right): violation rate %                    ││    │
│  │  │  Lines: violations (red), violation rate (amber)     ││    │
│  │  │  Target line at 15% (compliance goal)                ││    │
│  │  └─────────────────────────────────────────────────────┘│    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ActualVsRequiredScatter                                 │    │
│  │  ┌─────────────────────────────────────────────────────┐│    │
│  │  │  Scatter plot:                                       ││    │
│  │  │  X-axis: required wage ($/hr)                        ││    │
│  │  │  Y-axis: actual wage ($/hr)                          ││    │
│  │  │  Dots: one per trade/locality combo                  ││    │
│  │  │  Color: green (compliant), red (violation)           ││    │
│  │  │  Size: proportional to decision count                ││    │
│  │  │  Reference line: y=x (actual = required)             ││    │
│  │  │  Points above line = compliant, below = violation    ││    │
│  │  └─────────────────────────────────────────────────────┘│    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  FringeComplianceChart                                   │    │
│  │  ┌─────────────────────────────────────────────────────┐│    │
│  │  │  Line chart:                                         ││    │
│  │  │  X-axis: dates                                       ││    │
│  │  │  Y-axis: compliant %                                 ││    │
│  │  │  Line: fringe compliance rate (purple)               ││    │
│  │  │  Target line at 90%                                  ││    │
│  │  │  Area fill below line when below 90% (red warning)   ││    │
│  │  └─────────────────────────────────────────────────────┘│    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### Component Specifications

#### `WageViolationTrendChart`

**File:** `frontend/src/components/analytics/WageViolationTrendChart.tsx`

**Props:**
```typescript
interface WageViolationTrendChartProps {
  period: Period;
  trade?: string;
  contractId?: string;
}
```

**Recharts config:**
```typescript
<ComposedChart data={data}>
  <XAxis dataKey="date" tickFormatter={formatDate} />
  <YAxis yAxisId="count" orientation="left" />
  <YAxis yAxisId="rate" orientation="right" domain={[0, 30]} tickFormatter={(v) => `${v}%`} />
  <Tooltip />
  <Legend />
  <ReferenceLine yAxisId="rate" y={15} stroke="#ef4444" strokeDasharray="5 5" label="Target" />
  <Line yAxisId="count" type="monotone" dataKey="violations" stroke="#ef4444" strokeWidth={2} />
  <Line yAxisId="rate" type="monotone" dataKey="violation_rate" stroke="#f59e0b" strokeWidth={2} />
</ComposedChart>
```

**Data shape:**
```typescript
interface WageViolationTrend {
  date: string;          // "2025-04-01"
  violations: number;    // 5
  total_checked: number; // 45
  violation_rate: number; // 11.1
}
```

#### `ActualVsRequiredScatter`

**File:** `frontend/src/components/analytics/ActualVsRequiredScatter.tsx`

**Recharts config:**
```typescript
<ScatterChart>
  <XAxis type="number" dataKey="required" name="Required Wage" unit="$/hr" domain={["dataMin - 5", "dataMax + 5"]} />
  <YAxis type="number" dataKey="actual_avg" name="Actual Wage" unit="$/hr" domain={["dataMin - 5", "dataMax + 5"]} />
  <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<ScatterTooltip />} />
  <ReferenceLine slope={1} stroke="#666" strokeDasharray="3 3" label="Actual = Required" />
  <Scatter data={data}>
    {data.map((entry, i) => (
      <Cell key={i} fill={entry.compliant_pct >= 90 ? "#22c55e" : "#ef4444"} r={Math.sqrt(entry.total) * 2} />
    ))}
  </Scatter>
</ScatterChart>
```

**Data shape:**
```typescript
interface ActualVsRequired {
  locality: string;      // "Boston, MA"
  trade: string;         // "Electrician"
  required: number;      // 51.69
  actual_avg: number;    // 52.10
  compliant_pct: number; // 94.2
  total: number;         // number of decisions (drives dot size)
}
```

#### `FringeComplianceChart`

**File:** `frontend/src/components/analytics/FringeComplianceChart.tsx`

**Recharts config:** Line chart with threshold reference line.

```typescript
<LineChart data={fringeData}>
  <XAxis dataKey="date" tickFormatter={formatDate} />
  <YAxis domain={[70, 100]} tickFormatter={(v) => `${v}%`} />
  <Tooltip formatter={(v) => `${v}%`} />
  <ReferenceLine y={90} stroke="#22c55e" strokeDasharray="5 5" label="Target 90%" />
  <Line type="monotone" dataKey="compliant_pct" stroke="#8b5cf6" strokeWidth={2} dot={false} />
</LineChart>
```

**Data shape:**
```typescript
interface FringeCompliance {
  date: string;          // "2025-04-01"
  compliant_pct: number; // 92.5
}
```

---

## Page 4: LLM Analytics (`/analytics/llm`)

**File:** `frontend/src/pages/analytics/llm.tsx`

**Data source:** `GET /api/analytics/llm`

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Analytics Overview       Period: [7d|30d|90d|1y]              │
│  LLM Analytics                                                   │
│  Model performance, cost efficiency, and provider distribution   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ KPI:     │  │ KPI:     │  │ KPI:     │  │ KPI:     │        │
│  │ Total    │  │ Cost per │  │ Avg      │  │ Total    │        │
│  │ LLM Cost │  │ Decision │  │ Latency  │  │ Tokens   │        │
│  │ $1,245   │  │ $0.082   │  │ 2,100ms  │  │ 12.4M    │        │
│  │ ▲+15.2%  │  │ ▼-12.4%  │  │ ▼-8.1%   │  │ ▲+8.3%   │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  LLMCostChart                                            │    │
│  │  ┌─────────────────────────────────────────────────────┐│    │
│  │  │  Line chart:                                         ││    │
│  │  │  X-axis: dates                                       ││    │
│  │  │  Y-axis (left): cost in USD                          ││    │
│  │  │  Y-axis (right): cost per decision                   ││    │
│  │  │  Lines: total cost (blue), cost/decision (green)     ││    │
│  │  │  Tooltip: date, total cost, decisions, cost/decision ││    │
│  │  └─────────────────────────────────────────────────────┘│    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌───────────────────────────┐  ┌───────────────────────────┐  │
│  │  TokenUsageChart           │  │  ModelDistributionChart    │  │
│  │  ┌───────────────────────┐│  │  ┌───────────────────────┐│  │
│  │  │ Stacked area chart:   ││  │  │ Pie chart:            ││  │
│  │  │ X-axis: dates         ││  │  │ GPT-4o: 65%           ││  │
│  │  │ Y-axis: token count   ││  │  │ Claude: 25%           ││  │
│  │  │ Areas:                ││  │  │ GPT-4o-mini: 7.5%     ││  │
│  │  │   prompt (blue)       ││  │  │ Ollama: 2.5%          ││  │
│  │  │   completion (green)  ││  │  │                       ││  │
│  │  │ Tooltip: tokens, cost ││  │  │ Center: total count   ││  │
│  │  └───────────────────────┘│  │  └───────────────────────┘│  │
│  └───────────────────────────┘  └───────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  LatencyByModelChart                                     │    │
│  │  ┌─────────────────────────────────────────────────────┐│    │
│  │  │  Box plot (simulated with error bars):               ││    │
│  │  │  X-axis: models (GPT-4o, Claude, GPT-4o-mini,       ││    │
│  │  │          Ollama)                                     ││    │
│  │  │  Y-axis: latency in ms                               ││    │
│  │  │  Each model shows: P50 (bar), P95 (whisker), P99     ││    │
│  │  │  Color: green (<2s P99), amber (2-5s), red (>5s)     ││    │
│  │  └─────────────────────────────────────────────────────┘│    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### Component Specifications

#### `LLMCostChart`

**File:** `frontend/src/components/analytics/LLMCostChart.tsx`

**Props:**
```typescript
interface LLMCostChartProps {
  period: Period;
}
```

**Recharts config:**
```typescript
<ComposedChart data={data}>
  <XAxis dataKey="date" tickFormatter={formatDate} />
  <YAxis yAxisId="total" orientation="left" tickFormatter={(v) => `$${v}`} />
  <YAxis yAxisId="per_decision" orientation="right" tickFormatter={(v) => `$${v.toFixed(3)}`} />
  <Tooltip />
  <Legend />
  <Bar yAxisId="total" dataKey="total_cost" fill="#3b82f6" opacity={0.3} />
  <Line yAxisId="per_decision" type="monotone" dataKey="cost_usd" stroke="#22c55e" strokeWidth={2} dot={false} />
</ComposedChart>
```

**Data shape:**
```typescript
interface LLMCostData {
  date: string;          // "2025-04-01"
  cost_usd: number;      // 0.082 (per decision)
  decisions: number;     // 45
  total_cost: number;    // 3.69
}
```

#### `TokenUsageChart`

**File:** `frontend/src/components/analytics/TokenUsageChart.tsx`

**Recharts config:**
```typescript
<AreaChart data={data}>
  <XAxis dataKey="date" tickFormatter={formatDate} />
  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
  <Tooltip formatter={(v) => v.toLocaleString()} />
  <Legend />
  <Area type="monotone" dataKey="prompt_tokens" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
  <Area type="monotone" dataKey="completion_tokens" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} />
</AreaChart>
```

**Data shape:**
```typescript
interface TokenUsageData {
  date: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}
```

#### `ModelDistributionChart`

**File:** `frontend/src/components/analytics/ModelDistributionChart.tsx`

**Recharts config:**
```typescript
const COLORS = ["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b"];

<PieChart>
  <Pie data={data} innerRadius={60} outerRadius={80} dataKey="count" nameKey="model" label={({ model, percentage }) => `${model}: ${percentage}%`}>
    {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
  </Pie>
  <Tooltip formatter={(v, name) => [v.toLocaleString(), name]} />
</PieChart>
```

**Data shape:**
```typescript
interface ModelDistribution {
  model: string;        // "gpt-4o"
  count: number;        // 520
  percentage: number;   // 65.0
  avg_cost: number;     // 0.12
}
```

#### `LatencyByModelChart`

**File:** `frontend/src/components/analytics/LatencyByModelChart.tsx`

**Recharts config (error bar simulation):**
```typescript
<BarChart data={data}>
  <XAxis dataKey="model" />
  <YAxis tickFormatter={(v) => `${v}ms`} />
  <Tooltip formatter={(v) => `${v}ms`} />
  <Legend />
  <Bar dataKey="p50_ms" fill="#22c55e" name="P50" />
  <ErrorBar dataKey="p99_ms" width={4} strokeWidth={2} />
</BarChart>
```

**Data shape:**
```typescript
interface LatencyByModel {
  model: string;       // "gpt-4o"
  p50_ms: number;      // 1800
  p95_ms: number;      // 3200
  p99_ms: number;      // 4500
}
```

---

## Route Configuration

```typescript
// frontend/src/App.tsx — V4 routes added to existing React Router
import { lazy } from "react";

const AnalyticsOverview = lazy(() => import("./pages/analytics/index"));
const AnalyticsCompliance = lazy(() => import("./pages/analytics/compliance"));
const AnalyticsWages = lazy(() => import("./pages/analytics/wages"));
const AnalyticsLLM = lazy(() => import("./pages/analytics/llm"));

// In router:
<Route path="/analytics" element={<AnalyticsOverview />} />
<Route path="/analytics/compliance" element={<AnalyticsCompliance />} />
<Route path="/analytics/wages" element={<AnalyticsWages />} />
<Route path="/analytics/llm" element={<AnalyticsLLM />} />
```

---

## Dependencies

```json
{
  "dependencies": {
    "recharts": "^2.12.0"
  }
}
```

Recharts is the only new frontend dependency. It integrates natively with React and provides all required chart types: Line, Area, Bar, Pie, Scatter, Composed.

---

## Related Documentation

- [V4 API Contract](v4-api-contract.md) — Endpoints that feed these charts
- [V4 Data Flows](architecture/v4-data-flows.md) — Flow 3 (Analytics Query) details
- [V4 Data Model](architecture/v4-data-model.md) — DuckDB view definitions
- [V4 Plan](planning/V4_PLAN.md) — Original analytics dashboard concept

---

*Generated: 2026-04-30*
