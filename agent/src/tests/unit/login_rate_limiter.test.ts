import { describe, expect, it, vi } from "vitest";
import { Hono, type Context } from "hono";
import { createRateLimiter } from "../../middleware/rate_limiter.js";

function makeApp() {
  const app = new Hono();
  app.use("/login", createRateLimiter({ windowMs: 60_000, maxRequests: 5 }));
  app.get("/login", (c: Context) => c.json({ ok: true }));
  return app;
}

describe("Login Rate limiter middleware", () => {
  it("blocks requests exceeding the 5 request limit with 429", async () => {
    const app = makeApp();
    const headers = { "x-forwarded-for": "10.10.10.10" };

    for (let i = 0; i < 5; i++) {
      const res = await app.request("/login", { headers });
      expect(res.status).toBe(200);
    }

    const blocked = await app.request("/login", { headers });
    expect(blocked.status).toBe(429);
    const body = (await blocked.json()) as { error: string };
    expect(body.error).toBe("Rate limit exceeded");
  });
});
