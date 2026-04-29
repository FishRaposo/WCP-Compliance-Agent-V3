import { Hono } from "hono";
import { z } from "zod";
import type { Context } from "hono";

import { config } from "../config.js";
import { httpClient } from "../utils/http-client.js";
import { signToken } from "../middleware/auth.js";
import { logger } from "../utils/logger.js";

interface AuthUser {
  user_id: string;
  email: string;
  role: string;
}

export const auth = new Hono();

const LoginRequest = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

auth.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = LoginRequest.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.format() }, 400);
  }

  try {
    const result = await httpClient.post<{
      valid: boolean;
      user_id: string | null;
      role: string | null;
    }>("/auth/validate", parsed.data);

    if (!result.valid || !result.user_id || !result.role) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const token = await signToken(result.user_id, parsed.data.email, result.role);

    logger.info({ user_id: result.user_id }, "User logged in");

    return c.json({
      token,
      user_id: result.user_id,
      role: result.role,
    });
  } catch (err) {
    logger.error({ err }, "Login failed");
    return c.json({ error: "Authentication service error" }, 500);
  }
});

auth.get("/me", async (c: Context) => {
  const user = c.get("user") as AuthUser | undefined;
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return c.json({ user_id: user.user_id, email: user.email, role: user.role });
});
