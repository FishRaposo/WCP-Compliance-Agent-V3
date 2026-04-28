import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { signToken } from "../../middleware/auth.js";

describe("Auth middleware (AUTH_DISABLED=true test env)", () => {
  it("allows access when AUTH_DISABLED is true", async () => {
    const { authMiddleware } = await import("../../middleware/auth.js");
    const app = new Hono();
    app.use("/protected", authMiddleware);
    app.get("/protected", (c) => {
      const user = (c as unknown as { get: (k: string) => { user_id: string; role: string } }).get("user");
      return c.json({ ok: true, user_id: user?.user_id ?? "", role: user?.role ?? "" });
    });

    const res = await app.request("/protected");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; user_id: string; role: string };
    expect(body.ok).toBe(true);
    expect(body.user_id).toBe("dev");
    expect(body.role).toBe("admin");
  });

  it("signs and returns a valid JWT token", async () => {
    const token = await signToken("user-123", "test@example.com", "analyst");
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);
  });
});
