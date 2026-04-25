import { Hono } from "hono";
import { httpClient } from "../utils/http-client.js";

export const decisions = new Hono();

decisions.get("/", async (c) => {
  const limit = c.req.query("limit") ?? "50";
  const offset = c.req.query("offset") ?? "0";
  // TODO: implement — proxy to Python /decisions
  return c.json({ error: "Not implemented" }, 501);
});

decisions.get("/:id", async (c) => {
  const id = c.req.param("id");
  // TODO: implement
  return c.json({ error: "Not implemented" }, 501);
});
