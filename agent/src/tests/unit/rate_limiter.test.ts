import { describe, expect, it, vi } from "vitest";
import { Hono, type Context } from "hono";
import { rateLimiter } from "../../middleware/rate_limiter.js";

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

  it("extracts the rightmost IP when multiple are provided via x-forwarded-for", async () => {
    const app = makeApp();

    // First, hit the limit for "4.4.4.4" using a single IP
    const headersSingle = { "x-forwarded-for": "4.4.4.4" };
    for (let i = 0; i < 60; i++) {
      await app.request("/test", { headers: headersSingle });
    }

    // Request 61 should be blocked
    let res = await app.request("/test", { headers: headersSingle });
    expect(res.status).toBe(429);

    // Now send a request with a spoofed x-forwarded-for: "5.5.5.5, 4.4.4.4"
    // Since the rightmost IP is 4.4.4.4, it should still be blocked.
    const headersSpoofed = { "x-forwarded-for": "5.5.5.5, 4.4.4.4" };
    res = await app.request("/test", { headers: headersSpoofed });
    expect(res.status).toBe(429);

    // Also send a request with "4.4.4.4, 5.5.5.5"
    // The rightmost IP is 5.5.5.5, which has 0 requests, so it should be allowed.
    const headersAllowed = { "x-forwarded-for": "4.4.4.4, 5.5.5.5" };
    res = await app.request("/test", { headers: headersAllowed });
    expect(res.status).toBe(200);
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
});
