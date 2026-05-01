import { describe, expect, it, vi, beforeEach } from "vitest";

describe("apiClient (mock mode)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();

    // Explicitly mock fetch for JSDOM
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/health')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'ok' })
        });
      }
      if (url.endsWith('/api/decisions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ decision_id: 'mock-1' }])
        });
      }
      if (url.endsWith('/api/auth/login')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ token: 'mock-token', user_id: 'u1', role: 'admin' })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
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
