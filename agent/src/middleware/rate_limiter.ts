import type { MiddlewareHandler } from "hono";

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
}

export const createRateLimiter = (options: RateLimiterOptions): MiddlewareHandler => {
  const requests = new Map<string, { count: number; resetAt: number }>();

  return async (c, next) => {
    const key = c.req.header("x-forwarded-for") ?? "anonymous";
    const now = Date.now();
    const entry = requests.get(key);

    if (!entry || now > entry.resetAt) {
      requests.set(key, { count: 1, resetAt: now + options.windowMs });
      await next();
      return;
    }

    if (entry.count >= options.maxRequests) {
      return c.json({ error: "Rate limit exceeded" }, 429);
    }

    entry.count++;
    await next();
  };
};

export const rateLimiter = () => createRateLimiter({ windowMs: 60_000, maxRequests: 60 });
