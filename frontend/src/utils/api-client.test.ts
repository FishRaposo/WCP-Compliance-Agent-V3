import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("apiClient", () => {
  let fetchMock: any;
  let originalWindowLocation: Location;

  beforeEach(() => {
    // Reset mocks and state
    localStorage.clear();
    vi.resetModules();

    // Mock import.meta.env
    vi.stubEnv("VITE_MOCK_API", "false");
    vi.stubEnv("VITE_API_URL", "http://test-api.com");

    // Mock fetch
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    global.fetch = fetchMock;

    // Mock window.location
    originalWindowLocation = window.location;
    delete (window as any).location;
    (window as any).location = { ...originalWindowLocation, href: "http://localhost/" };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    (window as any).location = originalWindowLocation;
  });

  describe("HTTP requests", () => {
    it("makes a GET request with correct URL and headers", async () => {
      const { apiClient } = await import("./api-client");
      await apiClient.get("/test-path");

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith("http://test-api.com/test-path", expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
        },
      }));
    });

    it("makes a POST request with correct URL, method, body, and headers", async () => {
      const { apiClient } = await import("./api-client");
      const body = { key: "value" };
      await apiClient.post("/test-path", body);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith("http://test-api.com/test-path", expect.objectContaining({
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
        },
      }));
    });

    it("makes a POST form request with FormData and omits Content-Type header", async () => {
      const { apiClient } = await import("./api-client");
      const formData = new FormData();
      formData.append("file", new Blob(["test"]), "test.txt");

      await apiClient.postForm("/test-path", formData);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const args = fetchMock.mock.calls[0];
      expect(args[0]).toBe("http://test-api.com/test-path");
      expect(args[1].method).toBe("POST");
      expect(args[1].body).toBe(formData);
      // Ensure Content-Type is NOT set, letting the browser set it with boundary
      expect(args[1].headers["Content-Type"]).toBeUndefined();
    });
  });

  describe("Authorization", () => {
    it("includes Authorization header if wcp_token is in localStorage", async () => {
      localStorage.setItem("wcp_token", "fake-jwt-token");
      const { apiClient } = await import("./api-client");

      await apiClient.get("/test-path");

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith("http://test-api.com/test-path", expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer fake-jwt-token",
        },
      }));
    });

    it("does not include Authorization header if wcp_token is not in localStorage", async () => {
      // localStorage is cleared in beforeEach
      const { apiClient } = await import("./api-client");

      await apiClient.get("/test-path");

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const args = fetchMock.mock.calls[0];
      expect(args[1].headers["Authorization"]).toBeUndefined();
    });
  });

  describe("Error Handling and 401 Redirects", () => {
    it("handles 401 status by clearing token, redirecting, and throwing Error", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });
      localStorage.setItem("wcp_token", "expired-token");

      const { apiClient } = await import("./api-client");

      await expect(apiClient.get("/test-path")).rejects.toThrow("Session expired. Please log in again.");

      expect(localStorage.getItem("wcp_token")).toBeNull();
      expect(window.location.href).toBe("/login");
    });

    it("handles other non-ok responses by throwing an API error", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      const { apiClient } = await import("./api-client");

      await expect(apiClient.get("/test-path")).rejects.toThrow("API error 500: Internal Server Error");
    });
  });

  describe("mock mode", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_MOCK_API", "true");
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
});
