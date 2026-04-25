# Phase 4 — Frontend: Product UI

**Goal:** Implement a fully functional React frontend. Users can upload a PDF or enter text, see the analysis pipeline run, and view the full three-layer decision result. The UI works in mock mode without a real LLM.

---

## Exit Criteria (Hard Gate)

```bash
cd frontend
npm ci
npm run typecheck  # 0 errors
npm run build      # builds successfully to dist/

# Dev server smoke test:
VITE_API_URL=http://localhost:3000 npm run dev &
# Navigate to http://localhost:5173 — all 6 routes render without blank pages or console errors
```

**Do not proceed to Phase 5 until the build succeeds and all pages render.**

---

## Goals

1. Implement shared API client and types
2. Implement TanStack Query hooks
3. Implement core components (10 components)
4. Implement 6 pages
5. SSE real-time updates
6. Error handling and loading states

---

## Task Breakdown

### 4.1 — Shared API Client and Types

**Destination:** `frontend/src/utils/api-client.ts` + `frontend/src/types/api.ts`

**`types/api.ts`:**
```typescript
// Mirror Python Pydantic models exactly

export interface ContractorInfo {
  name: string;
  address?: string;
  ein?: string;
}

export interface ProjectInfo {
  name: string;
  location?: string;
  contractNumber?: string;
  wageDeterminationNumber?: string;
}

export interface EmployeeRecord {
  name: string;
  tradeClassification: string;
  hoursWorked: number;
  overtimeHours?: number;
  hourlyWage: number;
  fringeBenefits?: number;
  grossEarnings: number;
  deductions?: number;
  netWages: number;
}

export interface ExtractedWCP {
  jobId: string;
  contractor: ContractorInfo;
  project: ProjectInfo;
  employees: EmployeeRecord[];
  certificationDate: string;  // ISO date
  payrollNumber?: number;
  weekEnding?: string;
}

export interface ComplianceCheck {
  checkId: string;
  checkType: "WAGE" | "OVERTIME" | "FRINGE" | "SIGNATURE" | "TOTAL";
  employeeName: string;
  status: "PASS" | "FAIL" | "WARNING";
  expectedValue?: number;
  actualValue?: number;
  variance?: number;
  regulationCite: string;
  message: string;
}

export interface DeterministicReport {
  jobId: string;
  checks: ComplianceCheck[];
  overallStatus: "PASS" | "FAIL";
  violationCount: number;
  warningCount: number;
  dbwdRatesUsed: DBWDRateRecord[];
}

export interface Citation {
  regulation: string;
  section?: string;
  text: string;
}

export interface LLMVerdict {
  jobId: string;
  verdict: "APPROVED" | "REJECTED" | "REVISE";
  reasoning: string;
  citations: Citation[];
  confidence: number;
  ragContextUsed: boolean;
  model: string;
  promptVersion: string;
  langfuseTraceId: string;
}

export interface TrustScoredDecision {
  jobId: string;
  verdict: "APPROVED" | "REJECTED" | "REVISE";
  trustScore: number;
  trustBand: "AUTO_APPROVE" | "FLAG_FOR_REVIEW" | "REQUIRE_HUMAN_REVIEW";
  requiresHumanReview: boolean;
  violationCount: number;
  warningCount: number;
  llmConfidence: number;
  reasoningSummary: string;
  citations: Citation[];
  costUsd?: number;
  latencyMs?: number;
  phoenixTraceId: string;
  createdAt: string;
}

export interface DBWDRateRecord {
  trade: string;
  locality: string;
  rate: number;
  fringe: number;
  effectiveDate: string;
}

export interface PaginatedDecisions {
  items: TrustScoredDecision[];
  total: number;
  page: number;
  pageSize: number;
}
```

**`utils/api-client.ts`:**
```typescript
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

export const api = {
  analyze: (text: string) => 
    fetchApi<TrustScoredDecision>("/api/analyze", {
      method: "POST",
      body: JSON.stringify({ text })
    }),
  
  analyzePdf: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return fetchApi<TrustScoredDecision>("/api/analyze-pdf", {
      method: "POST",
      body: formData
    });
  },
  
  getDecisions: (params?: { verdict?: string; trustBand?: string; page?: number }) =>
    fetchApi<PaginatedDecisions>(`/api/decisions?${new URLSearchParams(params as any)}`),
  
  getDecision: (jobId: string) =>
    fetchApi<TrustScoredDecision>(`/api/decisions/${jobId}`),
  
  getAnalytics: () =>
    fetchApi<{ volume: any[]; approvalRate: any; cost: any[] }>("/api/analytics")
};
```

---

### 4.2 — TanStack Query Hooks

**Destination:** `frontend/src/hooks/`

**`useAnalyze.ts`:**
```typescript
import { useMutation } from "@tanstack/react-query";
import { api } from "../utils/api-client.js";

export function useAnalyze() {
  return useMutation({
    mutationFn: api.analyze,
    onError: (error) => {
      console.error("Analysis failed:", error);
    }
  });
}

export function useAnalyzePdf() {
  return useMutation({
    mutationFn: api.analyzePdf
  });
}
```

**`useDecisions.ts`:**
```typescript
import { useQuery } from "@tanstack/react-query";
import { api } from "../utils/api-client.js";

export function useDecisions(params?: { verdict?: string; trustBand?: string; page?: number }) {
  return useQuery({
    queryKey: ["decisions", params],
    queryFn: () => api.getDecisions(params)
  });
}

export function useDecision(jobId: string) {
  return useQuery({
    queryKey: ["decision", jobId],
    queryFn: () => api.getDecision(jobId),
    enabled: !!jobId
  });
}
```

**`useJobPolling.ts`:**
```typescript
import { useQuery } from "@tanstack/react-query";

export function useJobPolling(jobId: string | null) {
  return useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}`);
      return res.json();
    },
    enabled: !!jobId,
    refetchInterval: (data) => {
      // Stop polling when job is complete
      return data?.status === "completed" || data?.status === "failed" ? false : 1000;
    }
  });
}
```

**`useDecisionStream.ts`:**
```typescript
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useDecisionStream() {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const eventSource = new EventSource(`${import.meta.env.VITE_API_URL}/api/decisions/stream`);
    
    eventSource.onmessage = (event) => {
      const decision = JSON.parse(event.data);
      // Invalidate decisions list cache
      queryClient.invalidateQueries({ queryKey: ["decisions"] });
      // Show toast notification
      toast.success(`New decision: ${decision.verdict}`);
    };
    
    return () => eventSource.close();
  }, [queryClient]);
}
```

**`usePromptVersions.ts`:**
```typescript
import { useQuery } from "@tanstack/react-query";

export function usePromptVersions() {
  return useQuery({
    queryKey: ["prompt-versions"],
    queryFn: async () => {
      // Stub: Langfuse integration in Phase 5
      return ["v2"];
    }
  });
}
```

---

### 4.3 — Core Components

**Destination:** `frontend/src/components/`

**`Layout.tsx`:**
```tsx
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Upload, History, AlertCircle, BarChart3, Settings } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/analyze", icon: Upload, label: "Analyze" },
    { to: "/decisions", icon: History, label: "Decisions" },
    { to: "/review", icon: AlertCircle, label: "Review Queue" },
    { to: "/analytics", icon: BarChart3, label: "Analytics" },
    { to: "/settings", icon: Settings, label: "Settings" }
  ];
  
  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">WCP Agent</h1>
          <p className="text-sm text-gray-500">v3.0</p>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  isActive ? "bg-blue-50 text-blue-600" : "hover:bg-gray-100"
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
```

**`UploadDropzone.tsx`:**
```tsx
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText } from "lucide-react";

interface UploadDropzoneProps {
  onFileSelect: (file: File) => void;
  onTextSubmit: (text: string) => void;
}

export function UploadDropzone({ onFileSelect, onTextSubmit }: UploadDropzoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) onFileSelect(acceptedFiles[0]);
  }, [onFileSelect]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'text/csv': ['.csv'] },
    maxSize: 10 * 1024 * 1024  // 10MB
  });
  
  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p className="text-lg font-medium">Drop PDF or CSV here, or click to select</p>
        <p className="text-sm text-gray-500 mt-2">Max file size: 10MB</p>
      </div>
      
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-gray-50 text-gray-500">Or paste text</span>
        </div>
      </div>
      
      <TextInput onSubmit={onTextSubmit} />
    </div>
  );
}

function TextInput({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");
  
  return (
    <div className="flex gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste WH-347 text here..."
        className="flex-1 p-3 border rounded-md min-h-[100px]"
      />
      <button
        onClick={() => onSubmit(text)}
        disabled={!text.trim()}
        className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
      >
        Analyze
      </button>
    </div>
  );
}
```

**`DecisionCard.tsx`:**
```tsx
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrustScoreBadge } from "./TrustScoreBadge";
import { EmployeeAccordion } from "./EmployeeAccordion";
import { AuditTrail } from "./AuditTrail";
import type { TrustScoredDecision, DeterministicReport } from "../types/api";

interface DecisionCardProps {
  decision: TrustScoredDecision;
  deterministicReport?: DeterministicReport;
}

export function DecisionCard({ decision, deterministicReport }: DecisionCardProps) {
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Decision: {decision.verdict}</h2>
          <p className="text-sm text-gray-500">Job ID: {decision.jobId}</p>
        </div>
        <div className="flex items-center gap-4">
          <TrustScoreBadge score={decision.trustScore} band={decision.trustBand} />
          {decision.requiresHumanReview && (
            <Badge variant="destructive">Requires Human Review</Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Violations</p>
            <p className="font-medium text-red-600">{decision.violationCount}</p>
          </div>
          <div>
            <p className="text-gray-500">Warnings</p>
            <p className="font-medium text-yellow-600">{decision.warningCount}</p>
          </div>
          <div>
            <p className="text-gray-500">LLM Confidence</p>
            <p className="font-medium">{(decision.llmConfidence * 100).toFixed(0)}%</p>
          </div>
        </div>
        
        {decision.reasoningSummary && (
          <div className="bg-gray-50 p-4 rounded-md">
            <h3 className="font-medium mb-2">Reasoning</h3>
            <p className="text-sm text-gray-700">{decision.reasoningSummary}</p>
          </div>
        )}
        
        {deterministicReport && (
          <EmployeeAccordion checks={deterministicReport.checks} />
        )}
        
        <AuditTrail 
          citations={decision.citations}
          phoenixTraceId={decision.phoenixTraceId}
          costUsd={decision.costUsd}
          latencyMs={decision.latencyMs}
        />
      </CardContent>
    </Card>
  );
}
```

**`TrustScoreBadge.tsx`:**
```tsx
import { Badge } from "@/components/ui/badge";

type TrustBand = "AUTO_APPROVE" | "FLAG_FOR_REVIEW" | "REQUIRE_HUMAN_REVIEW";

interface TrustScoreBadgeProps {
  score: number;
  band: TrustBand;
}

export function TrustScoreBadge({ score, band }: TrustScoreBadgeProps) {
  const colors = {
    AUTO_APPROVE: "bg-green-100 text-green-800 border-green-300",
    FLAG_FOR_REVIEW: "bg-yellow-100 text-yellow-800 border-yellow-300",
    REQUIRE_HUMAN_REVIEW: "bg-red-100 text-red-800 border-red-300"
  };
  
  return (
    <Badge className={`${colors[band]} border px-3 py-1`}>
      <span className="font-bold">{(score * 100).toFixed(0)}%</span>
      <span className="ml-2 text-xs">{band.replace(/_/g, " ")}</span>
    </Badge>
  );
}
```

**`EmployeeAccordion.tsx`:**
```tsx
import { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import type { ComplianceCheck } from "../types/api";

interface EmployeeAccordionProps {
  checks: ComplianceCheck[];
}

export function EmployeeAccordion({ checks }: EmployeeAccordionProps) {
  // Group checks by employee
  const byEmployee = checks.reduce((acc, check) => {
    if (!acc[check.employeeName]) acc[check.employeeName] = [];
    acc[check.employeeName].push(check);
    return acc;
  }, {} as Record<string, ComplianceCheck[]>);
  
  return (
    <div className="space-y-2">
      <h3 className="font-medium">Per-Employee Checks</h3>
      {Object.entries(byEmployee).map(([name, employeeChecks]) => (
        <EmployeeRow key={name} name={name} checks={employeeChecks} />
      ))}
    </div>
  );
}

function EmployeeRow({ name, checks }: { name: string; checks: ComplianceCheck[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const violations = checks.filter(c => c.status === "FAIL").length;
  
  return (
    <div className="border rounded-md">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span className="font-medium">{name}</span>
          {violations > 0 && (
            <span className="text-sm text-red-600">({violations} violations)</span>
          )}
        </div>
      </button>
      
      {isOpen && (
        <div className="px-3 pb-3 space-y-2">
          {checks.map(check => <CheckRow key={check.checkId} check={check} />)}
        </div>
      )}
    </div>
  );
}

function CheckRow({ check }: { check: ComplianceCheck }) {
  const icons = {
    PASS: <CheckCircle className="w-5 h-5 text-green-500" />,
    FAIL: <XCircle className="w-5 h-5 text-red-500" />,
    WARNING: <AlertTriangle className="w-5 h-5 text-yellow-500" />
  };
  
  return (
    <div className="flex items-start gap-3 p-2 bg-gray-50 rounded">
      {icons[check.status]}
      <div className="flex-1">
        <p className="font-medium text-sm">{check.checkType}</p>
        <p className="text-sm text-gray-600">{check.message}</p>
        {check.expectedValue !== undefined && (
          <p className="text-xs text-gray-500 mt-1">
            Expected: ${check.expectedValue.toFixed(2)} | 
            Actual: ${check.actualValue?.toFixed(2)} | 
            Variance: ${check.variance?.toFixed(2)}
          </p>
        )}
        <p className="text-xs text-gray-400 mt-1">{check.regulationCite}</p>
      </div>
    </div>
  );
}
```

**`AuditTrail.tsx`:**
```tsx
import { ExternalLink, DollarSign, Clock } from "lucide-react";
import type { Citation } from "../types/api";

interface AuditTrailProps {
  citations: Citation[];
  phoenixTraceId: string;
  costUsd?: number;
  latencyMs?: number;
}

export function AuditTrail({ citations, phoenixTraceId, costUsd, latencyMs }: AuditTrailProps) {
  return (
    <div className="bg-gray-50 p-4 rounded-md space-y-3">
      <h3 className="font-medium">Audit Trail</h3>
      
      {citations.length > 0 && (
        <div>
          <p className="text-sm text-gray-500 mb-2">Regulation Citations</p>
          <ul className="space-y-1">
            {citations.map((cite, i) => (
              <li key={i} className="text-sm">
                <a 
                  href={`https://www.law.cornell.edu/uscode/text/40/3142`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  {cite.regulation} <ExternalLink className="w-3 h-3" />
                </a>
                <p className="text-gray-600 text-xs">{cite.text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="flex items-center gap-6 text-sm">
        {costUsd !== undefined && (
          <div className="flex items-center gap-1 text-gray-600">
            <DollarSign className="w-4 h-4" />
            Cost: ${costUsd.toFixed(4)}
          </div>
        )}
        {latencyMs !== undefined && (
          <div className="flex items-center gap-1 text-gray-600">
            <Clock className="w-4 h-4" />
            Latency: {latencyMs}ms
          </div>
        )}
      </div>
      
      {phoenixTraceId && (
        <div className="text-xs text-gray-500">
          Phoenix Trace: {phoenixTraceId}
        </div>
      )}
    </div>
  );
}
```

**`PipelineVisualizer.tsx`:**
```tsx
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

type StepStatus = "pending" | "loading" | "complete" | "error";

interface Step {
  id: string;
  label: string;
  status: StepStatus;
}

interface PipelineVisualizerProps {
  steps: Step[];
  currentStep?: string;
}

export function PipelineVisualizer({ steps, currentStep }: PipelineVisualizerProps) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
            step.status === "complete" ? "bg-green-100 text-green-800" :
            step.status === "loading" ? "bg-blue-100 text-blue-800" :
            step.status === "error" ? "bg-red-100 text-red-800" :
            "bg-gray-100 text-gray-600"
          }`}>
            {step.status === "complete" && <CheckCircle2 className="w-4 h-4" />}
            {step.status === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
            {step.status === "pending" && <Circle className="w-4 h-4" />}
            {step.status === "error" && <XCircle className="w-4 h-4" />}
            {step.label}
          </div>
          {index < steps.length - 1 && (
            <div className={`w-8 h-0.5 mx-1 ${
              step.status === "complete" ? "bg-green-300" : "bg-gray-200"
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}
```

**`HumanReviewQueue.tsx`:**
```tsx
import { useDecisions } from "../hooks/useDecisions";
import { Button } from "@/components/ui/button";

export function HumanReviewQueue() {
  const { data, isLoading } = useDecisions({ trustBand: "REQUIRE_HUMAN_REVIEW" });
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Human Review Queue</h2>
      <p className="text-gray-500">{data?.total} decisions require review</p>
      
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left p-3">Job ID</th>
            <th className="text-left p-3">Trust Score</th>
            <th className="text-left p-3">Created</th>
            <th className="text-left p-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map(decision => (
            <tr key={decision.jobId} className="border-b">
              <td className="p-3 font-mono text-sm">{decision.jobId}</td>
              <td className="p-3">{(decision.trustScore * 100).toFixed(0)}%</td>
              <td className="p-3 text-sm text-gray-500">
                {new Date(decision.createdAt).toLocaleDateString()}
              </td>
              <td className="p-3">
                <Button size="sm">Review</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**`SettingsPanel.tsx`:**
```tsx
import { useState } from "react";
import { usePromptVersions } from "../hooks/usePromptVersions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function SettingsPanel() {
  const [model, setModel] = useState("gpt-4o-mini");
  const { data: versions } = usePromptVersions();
  
  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium">LLM Model</label>
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
            <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <label className="text-sm font-medium">Prompt Version</label>
        <Select defaultValue="v2">
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {versions?.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
```

---

### 4.4 — Pages

**`pages/Dashboard.tsx`:**
```tsx
import { useDecisions } from "../hooks/useDecisions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const { data: recentDecisions } = useDecisions({ limit: 5 });
  
  // Mock data for charts — replace with real analytics endpoint
  const volumeData = [
    { day: "Mon", decisions: 12 },
    { day: "Tue", decisions: 19 },
    { day: "Wed", decisions: 8 },
    { day: "Thu", decisions: 15 },
    { day: "Fri", decisions: 22 }
  ];
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      
      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Total Decisions" value="156" />
        <StatCard title="Approval Rate" value="87%" trend="+2%" />
        <StatCard title="Avg Cost" value="$0.08" />
        <StatCard title="Pending Review" value="12" alert />
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Decision Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={volumeData}>
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="decisions" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Recent Decisions</CardTitle>
          </CardHeader>
          <CardContent>
            {recentDecisions?.items.map(d => (
              <div key={d.jobId} className="flex justify-between py-2 border-b last:border-0">
                <span className="font-mono text-sm">{d.jobId.slice(0, 8)}...</span>
                <span className={`text-sm ${
                  d.verdict === "APPROVED" ? "text-green-600" : "text-red-600"
                }`}>{d.verdict}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, trend, alert }: { title: string; value: string; trend?: string; alert?: boolean }) {
  return (
    <Card className={alert ? "border-red-300" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && <div className="text-sm text-green-600">{trend}</div>}
      </CardContent>
    </Card>
  );
}
```

**`pages/Analyze.tsx`:**
```tsx
import { useState } from "react";
import { useAnalyze, useAnalyzePdf } from "../hooks/useAnalyze";
import { UploadDropzone } from "../components/UploadDropzone";
import { PipelineVisualizer } from "../components/PipelineVisualizer";
import { DecisionCard } from "../components/DecisionCard";
import type { TrustScoredDecision } from "../types/api";

const PIPELINE_STEPS = [
  { id: "extract", label: "Extract" },
  { id: "validate", label: "Validate" },
  { id: "verdict", label: "LLM Verdict" },
  { id: "score", label: "Trust Score" },
  { id: "persist", label: "Persist" }
];

export default function Analyze() {
  const [currentStep, setCurrentStep] = useState<string | undefined>();
  const [result, setResult] = useState<TrustScoredDecision | null>(null);
  
  const analyzeMutation = useAnalyze();
  const analyzePdfMutation = useAnalyzePdf();
  
  const handleTextSubmit = async (text: string) => {
    setCurrentStep("extract");
    setResult(null);
    
    try {
      const decision = await analyzeMutation.mutateAsync(text);
      setResult(decision);
    } finally {
      setCurrentStep(undefined);
    }
  };
  
  const handleFileSelect = async (file: File) => {
    setCurrentStep("extract");
    setResult(null);
    
    try {
      const decision = await analyzePdfMutation.mutateAsync(file);
      setResult(decision);
    } finally {
      setCurrentStep(undefined);
    }
  };
  
  const steps = PIPELINE_STEPS.map(step => ({
    ...step,
    status: currentStep === step.id ? "loading" :
            result ? "complete" : "pending"
  }));
  
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-bold">Analyze WCP</h1>
      
      <UploadDropzone 
        onFileSelect={handleFileSelect}
        onTextSubmit={handleTextSubmit}
      />
      
      {(currentStep || result) && (
        <PipelineVisualizer steps={steps} currentStep={currentStep} />
      )}
      
      {result && <DecisionCard decision={result} />}
    </div>
  );
}
```

**`pages/Decisions.tsx`:**
```tsx
import { useState } from "react";
import { useDecisions } from "../hooks/useDecisions";
import { DecisionCard } from "../components/DecisionCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Decisions() {
  const [filters, setFilters] = useState({ verdict: "", trustBand: "" });
  const { data, isLoading } = useDecisions(filters);
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Decision History</h1>
      
      <div className="flex gap-4">
        <Input placeholder="Search by job ID..." className="w-64" />
        <Select value={filters.verdict} onValueChange={v => setFilters(f => ({ ...f, verdict: v }))}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Verdict" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-4">
        {data?.items.map(decision => (
          <DecisionCard key={decision.jobId} decision={decision} />
        ))}
      </div>
    </div>
  );
}
```

**`pages/ReviewQueue.tsx`:**
```tsx
import { HumanReviewQueue } from "../components/HumanReviewQueue";

export default function ReviewQueue() {
  return (
    <div>
      <HumanReviewQueue />
    </div>
  );
}
```

**`pages/Analytics.tsx`:**
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

// Mock data
const costData = [
  { day: "Mon", cost: 0.85 },
  { day: "Tue", cost: 1.20 },
  { day: "Wed", cost: 0.64 },
  { day: "Thu", cost: 1.05 },
  { day: "Fri", cost: 1.50 }
];

export default function Analytics() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Analytics</h1>
      
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Daily Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={costData}>
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                <Line type="monotone" dataKey="cost" stroke="#3b82f6" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Token Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">Coming in Phase 5 with real analytics endpoint</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

**`pages/Settings.tsx`:**
```tsx
import { SettingsPanel } from "../components/SettingsPanel";

export default function Settings() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>
      <SettingsPanel />
    </div>
  );
}
```

---

### 4.5 — Error Handling and Loading States

**`components/ErrorBoundary.tsx`:**
```tsx
import { Component, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-96">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-gray-500 mb-4">{this.state.error?.message}</p>
          <Button onClick={() => window.location.reload()}>Reload Page</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**Add skeleton loaders using Shadcn `Skeleton`:**
```tsx
// components/DecisionCardSkeleton.tsx
import { Skeleton } from "@/components/ui/skeleton";

export function DecisionCardSkeleton() {
  return (
    <div className="space-y-4 p-6 border rounded-lg">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-1/4" />
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </div>
  );
}
```

---

## Architecture Notes

### UI Contains Zero Business Logic
No wage math, no trust score computation. Everything is read from API responses. This separation ensures the frontend can be tested with mock data without a running backend.

### TanStack Query Is The Only Client State Manager
Do not use Redux or Zustand. Server state = TanStack Query; UI state (modal open, selected tab) = React `useState`.

### Path Alias @ Resolves to ./src
Always import from `@/components/...` not `../../components/...`. This is configured in `vite.config.ts`.

### Shadcn/ui Components Are Already Installed
Check `package.json` for `@radix-ui/*` and `lucide-react`. Use Shadcn components before writing custom HTML. Consistency with Shadcn is part of the visual spec.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Agent not running during frontend dev | High | Medium | Add `VITE_MOCK_API=true` mode that returns fixture data from `src/utils/mock-data.ts` |
| SSE not supported by Hono | Low | Medium | Hono supports SSE via `streamSSE`. If issues arise, fall back to long-polling |
| Recharts bundle size | Low | Low | Tree-shaking should minimize. If still large, replace with lighter charting library |

---

## Command Reference

```bash
# Setup
cd frontend && npm ci

# Dev server
VITE_API_URL=http://localhost:3000 npm run dev

# Type check
npm run typecheck

# Build
npm run build

# Preview production build
npm run preview
```

---

*Phase 4 document version: 2026-04-22*
*Blocked by: Phase 3 agent mock-mode E2E passing*
