import type { Context, Next } from "hono";
import { jwtVerify, SignJWT } from "jose";
import { config, isAuthDisabled } from "../../config.js";
import { logger } from "../../utils/logger.js";

const secret = new TextEncoder().encode(config.JWT_SECRET);

export async function authMiddleware(c: Context, next: Next) {
  if (isAuthDisabled) {
    c.set("user", { user_id: "dev", role: "admin" });
    return next();
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, secret, {
      clockTolerance: 60,
    });
    c.set("user", payload);
    return next();
  } catch (err) {
    logger.warn({ err }, "JWT verification failed");
    return c.json({ error: "Invalid or expired token" }, 401);
  }
}

export async function signToken(
  userId: string,
  email: string,
  role: string
): Promise<string> {
  return new SignJWT({ user_id: userId, email, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);
}
