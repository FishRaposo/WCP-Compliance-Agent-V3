import { Hono } from "hono";

export const promptVersions = new Hono();

promptVersions.get("/", (c) => {
  return c.json(["v2", "v1"], 200);
});
