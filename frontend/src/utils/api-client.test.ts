import { describe, expect, it, vi, beforeEach } from "vitest";

describe("apiClient (mock mode)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.stubEnv('VITE_MOCK_API', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns mock health response", async () => {
    const { apiClient } = await import("./api-client");
    const result = (await apiClient.get("/health")) as { status: string };
    expect(result.status).toBe("ok");
  });

  it("returns mock decision summaries", async () => {
    const { apiClient } = await import("./api-client");
    const result = (await apiClient.get("/api/decisions")) as Array<{
      decision_id: string;
    }>;
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].decision_id).toBeDefined();
  });

  it("returns mock login response", async () => {
    const { apiClient } = await import("./api-client");
    const result = (await apiClient.post("/api/auth/login", {
      email: "test@example.com",
      password: "test",
    })) as { token: string; user_id: string; role: string };
    expect(result.token).toBeDefined();
    expect(result.role).toBe("admin");
  });
});
