import { Hono } from "hono";

import { httpClient } from "../utils/http-client.js";
import { BackendError } from "../utils/errors.js";

export const analytics = new Hono();

analytics.get("/volume", async (c) => {
  const days = c.req.query("days") ?? "30";
  try {
    const data = await httpClient.get<unknown[]>(`/analytics/volume?days=${days}`);
    return c.json(data, 200);
  } catch (err) {
    if (err instanceof BackendError) return c.json({ error: err.message }, 502);
    return c.json({ error: "Failed to fetch volume" }, 500);
  }
});

analytics.get("/approval-by-trade", async (c) => {
  try {
    const data = await httpClient.get<unknown>("/analytics/approval-by-trade");
    return c.json(data, 200);
  } catch (err) {
    if (err instanceof BackendError) return c.json({ error: err.message }, 502);
    return c.json({ error: "Failed to fetch approval rates" }, 500);
  }
});

analytics.get("/trust-band-distribution", async (c) => {
  try {
    const data = await httpClient.get<unknown[]>("/analytics/trust-band-distribution");
    return c.json(data, 200);
  } catch (err) {
    if (err instanceof BackendError) return c.json({ error: err.message }, 502);
    return c.json({ error: "Failed to fetch trust band distribution" }, 500);
  }
});

analytics.get("/cost", async (c) => {
  try {
    const data = await httpClient.get<unknown>("/analytics/cost");
    return c.json(data, 200);
  } catch (err) {
    if (err instanceof BackendError) return c.json({ error: err.message }, 502);
    return c.json({ error: "Failed to fetch cost analytics" }, 500);
  }
});
