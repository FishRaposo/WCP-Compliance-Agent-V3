import type { MiddlewareHandler } from "hono";

const requests = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

export const rateLimiter = (): MiddlewareHandler => async (c, next) => {
  const key = c.req.header("x-forwarded-for") ?? "anonymous";
  const now = Date.now();
  const entry = requests.get(key);

  if (!entry || now > entry.resetAt) {
    requests.set(key, { count: 1, resetAt: now + WINDOW_MS });
    await next();
    return;
  }

  if (entry.count >= MAX_REQUESTS) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  entry.count++;
  await next();
};
