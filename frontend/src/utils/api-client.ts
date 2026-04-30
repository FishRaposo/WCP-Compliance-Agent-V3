import {
  mockDecisionSummaries,
  mockTrustScoredDecision,
  mockDecisionVolume,
  mockApprovalRate,
  mockTrustBandDistribution,
  mockCostAnalytics,
  mockJobStatus,
  mockPromptVersions,
} from "./mock-data";

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const IS_MOCK = import.meta.env?.VITE_MOCK_API === "true" || process.env?.VITE_MOCK_API === "true" || (typeof window !== 'undefined' && (window as unknown as { __MOCK_API__?: boolean }).__MOCK_API__);

function getToken(): string | null {
  return localStorage.getItem("wcp_token");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (IS_MOCK) {
    return mockResolve<T>(path);
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

  const url = BASE_URL ? `${BASE_URL}${path}` : `http://localhost${path}`;
  const res = await fetch(url, {
    ...init,
    headers,
  });

  if (res.status === 401) {
    localStorage.removeItem("wcp_token");
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
  if (path.startsWith("/api/decisions")) return mockDecisionSummaries as T;
  if (path.startsWith("/api/jobs/")) return mockJobStatus as T;
  if (path.includes("/analytics/volume")) return mockDecisionVolume as T;
  if (path.includes("/analytics/approval")) return mockApprovalRate as T;
  if (path.includes("/analytics/trust-band")) return mockTrustBandDistribution as T;
  if (path.includes("/analytics/cost")) return mockCostAnalytics as T;
  if (path.includes("/prompt-versions")) return mockPromptVersions as T;
  if (path === "/health")
    return { status: "ok", version: "3.0.0", phase: 3 } as T;
  if (path.startsWith("/api/auth/login"))
    return { token: "mock-jwt-token", user_id: "mock-user", role: "admin" } as T;

  return {} as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, {
      method: "POST",
      body: form,
    }),
};
