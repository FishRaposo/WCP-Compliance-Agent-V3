import { describe, expect, it } from "vitest";
import app from "../../server.js";

describe("HTTP routes", () => {
  it("GET /health returns ok status", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; version: string };
    expect(body.status).toBe("ok");
    expect(body.version).toBe("3.0.0");
  });

  it("POST /api/auth/login returns 400 for invalid body", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Invalid request");
  });

  it("POST /api/auth/login returns 500 for unknown user (backend not running)", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com", password: "wrong" }),
    });
    expect([401, 500]).toContain(res.status);
  });

  it("POST /api/analyze returns 200 when AUTH_DISABLED=true", async () => {
    const res = await app.request("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Role: Electrician, Hours: 40, Wage: 51.69" }),
    });
    expect(res.status).toBe(200);
  });
});
