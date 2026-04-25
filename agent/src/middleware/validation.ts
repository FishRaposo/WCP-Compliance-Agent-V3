import type { MiddlewareHandler } from "hono";
import type { ZodSchema } from "zod";

export const validate =
  <T>(schema: ZodSchema<T>): MiddlewareHandler =>
  async (c, next) => {
    const body = await c.req.json().catch(() => null);
    const result = schema.safeParse(body);
    if (!result.success) {
      return c.json({ error: "Validation error", issues: result.error.issues }, 422);
    }
    c.set("validatedBody" as never, result.data);
    await next();
  };
