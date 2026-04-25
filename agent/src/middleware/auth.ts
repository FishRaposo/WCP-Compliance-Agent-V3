import type { MiddlewareHandler } from "hono";

// TODO: implement JWT validation and API key auth
export const authMiddleware = (): MiddlewareHandler => async (c, next) => {
  await next();
};
