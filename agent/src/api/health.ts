import { Hono } from "hono";

export const health = new Hono();

health.get("/", (c) => c.json({ status: "ok", version: "3.0.0" }));
