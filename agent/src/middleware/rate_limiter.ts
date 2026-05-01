import type { MiddlewareHandler } from "hono";

const requests = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

function getClientIp(c: Parameters<MiddlewareHandler>[0]): string {
  const xForwardedFor = c.req.header("x-forwarded-for");
  if (xForwardedFor) {
    // x-forwarded-for can be a comma-separated list of IPs.
    // The leftmost IP is typically the original client.
    const parts = xForwardedFor.split(",");
    const firstIp = parts[0];
    if (firstIp) return firstIp.trim();
  }
  return "anonymous";
}

function createRateLimiter(maxRequests: number, windowMs: number): MiddlewareHandler {
  const requests = new Map<string, { count: number; resetAt: number }>();

  return async (c, next) => {
    const key = getClientIp(c);
    const now = Date.now();
    const entry = requests.get(key);

    if (!entry || now > entry.resetAt) {
      requests.set(key, { count: 1, resetAt: now + windowMs });
      await next();
      return;
    }

    if (entry.count >= maxRequests) {
      return c.json({ error: "Rate limit exceeded" }, 429);
    }

    entry.count++;
    await next();
  };
}

export const rateLimiter = (): MiddlewareHandler => createRateLimiter(MAX_REQUESTS, WINDOW_MS);

export const loginRateLimiter = (): MiddlewareHandler => createRateLimiter(5, WINDOW_MS);
