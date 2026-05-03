import {
  mockAnalyticsOverview,
  mockDecisionSummaries,
  mockTrustScoredDecision,
  mockDecisionVolume,
  mockApprovalRate,
  mockTrustBandDistribution,
  mockCostAnalytics,
  mockJobStatus,
  mockPromptVersions,
  mockContracts,
  mockIngestionJobs,
  mockPayrolls,
  mockComplianceAnalytics,
  mockWagesAnalytics,
  mockLLMAnalytics,
} from "./mock-data";

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
export const IS_MOCK = import.meta.env.VITE_MOCK_API === "true";

function getToken(): string | null {
  return localStorage.getItem("wcp_token");
}

async function request<T>(path: string, init?: RequestInit, params?: Record<string, string | number | undefined>): Promise<T> {
  if (IS_MOCK) {
    return mockResolve<T>(path);
  }

  let url = path;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) searchParams.append(key, String(value));
    }
    const queryString = searchParams.toString();
    if (queryString) url += `?${queryString}`;
  }

  const isFormData = init?.body instanceof FormData;
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (init?.headers) {
    Object.assign(headers, init.headers as Record<string, string>);
  }

  const fullUrl = BASE_URL ? `${BASE_URL}${url}` : url;
  const res = await fetch(fullUrl, {
    ...init,
    headers,
  });

  if (res.status === 401) {
    localStorage.removeItem("wcp_token");
    window.dispatchEvent(new CustomEvent("auth:expired"));
    window.location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

async function mockResolve<T>(path: string): Promise<T> {
  await new Promise((r) => setTimeout(r, 300));

  if (path.startsWith("/api/analyze")) return mockTrustScoredDecision as T;
  if (path === "/api/decisions") return mockDecisionSummaries as T;
  if (path.startsWith("/api/jobs/")) return mockJobStatus as T;
  if (path.includes("/analytics/overview")) return mockAnalyticsOverview as T;
  if (path.includes("/analytics/volume") || path.includes("/analytics/decision-volume")) return mockDecisionVolume as T;
  if (path.includes("/analytics/approval")) return mockApprovalRate as T;
  if (path.includes("/analytics/trust-band")) return mockTrustBandDistribution as T;
  if (path.includes("/analytics/cost")) return mockCostAnalytics as T;
  if (path.includes("/prompt-versions")) return mockPromptVersions as T;
  if (path.startsWith("/api/contracts")) return mockContracts as T;
  if (path.startsWith("/api/payrolls")) return mockPayrolls as T;
  if (path.startsWith("/api/ingestion/jobs")) return mockIngestionJobs as T;
  if (path.includes("/analytics/compliance")) return mockComplianceAnalytics as T;
  if (path.includes("/analytics/wages")) return mockWagesAnalytics as T;
  if (path.includes("/analytics/llm")) return mockLLMAnalytics as T;
  if (path === "/health")
    return { status: "ok", version: "3.0.0", phase: 3 } as T;
  if (path.startsWith("/api/auth/login"))
    return { token: "mock-jwt-token", user_id: "mock-user", role: "admin" } as T;

  console.warn(`[apiClient] No mock fixture for path: ${path}`);
  throw new Error(`Mock API not available for: ${path}`);
}

export const apiClient = {
  get: <T>(path: string, params?: Record<string, string | number | undefined>) => request<T>(path, undefined, params),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, {
      method: "POST",
      body: form,
    }),
  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),
};
