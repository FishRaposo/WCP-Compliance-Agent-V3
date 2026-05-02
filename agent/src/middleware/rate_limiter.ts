import type { MiddlewareHandler } from "hono";

const requests = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

export const rateLimiter = (): MiddlewareHandler => async (c, next) => {
  const forwardedFor = c.req.header("x-forwarded-for");
  // For x-forwarded-for, the rightmost IP is the one directly connected to the proxy
  // Proxies append to the list. So the most reliable non-spoofed IP is typically the rightmost
  // if we assume our application is behind exactly one reverse proxy.
  const parts = forwardedFor ? forwardedFor.split(",") : [];
  const key = parts.length > 0 ? parts[parts.length - 1]?.trim() ?? "anonymous" : "anonymous";
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
