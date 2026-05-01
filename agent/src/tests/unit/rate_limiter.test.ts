import { describe, expect, it, vi } from "vitest";
import { Hono, type Context } from "hono";
import { rateLimiter, loginRateLimiter } from "../../middleware/rate_limiter.js";

function makeApp() {
  const app = new Hono();
  app.use("/test", rateLimiter());
  app.get("/test", (c: Context) => c.json({ ok: true }));
  return app;
}

describe("Rate limiter middleware", () => {
  it("allows requests under the limit", async () => {
    const app = makeApp();
    const res = await app.request("/test", {
      headers: { "x-forwarded-for": "1.1.1.1" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("blocks requests exceeding the limit with 429", async () => {
    const app = makeApp();
    const headers = { "x-forwarded-for": "2.2.2.2" };

    for (let i = 0; i < 60; i++) {
      await app.request("/test", { headers });
    }

    const blocked = await app.request("/test", { headers });
    expect(blocked.status).toBe(429);
    const body = (await blocked.json()) as { error: string };
    expect(body.error).toBe("Rate limit exceeded");
  });

  it("resets count after window expires", async () => {
    vi.useFakeTimers();
    const app = makeApp();
    const headers = { "x-forwarded-for": "3.3.3.3" };

    for (let i = 0; i < 60; i++) {
      await app.request("/test", { headers });
    }

    vi.advanceTimersByTime(61_000);

    const res = await app.request("/test", { headers });
    expect(res.status).toBe(200);

    vi.useRealTimers();
  });

  it("extracts the first IP when multiple comma-separated IPs are provided", async () => {
    const app = makeApp();
    const headers = { "x-forwarded-for": "10.0.0.1, 192.168.1.1, 10.0.0.2" };

    for (let i = 0; i < 60; i++) {
      await app.request("/test", { headers });
    }

    const blocked = await app.request("/test", { headers });
    expect(blocked.status).toBe(429);

    // Using a different first IP should be allowed
    const diffHeaders = { "x-forwarded-for": "10.0.0.2, 192.168.1.1, 10.0.0.2" };
    const allowed = await app.request("/test", { headers: diffHeaders });
    expect(allowed.status).toBe(200);
  });
});

describe("Login Rate limiter middleware", () => {
  it("blocks requests exceeding 5 with 429", async () => {
    const app = new Hono();
    app.use("/login", loginRateLimiter());
    app.post("/login", (c: Context) => c.json({ ok: true }));

    const headers = { "x-forwarded-for": "4.4.4.4" };

    for (let i = 0; i < 5; i++) {
      await app.request("/login", { method: "POST", headers });
    }

    const blocked = await app.request("/login", { method: "POST", headers });
    expect(blocked.status).toBe(429);
  });
});
