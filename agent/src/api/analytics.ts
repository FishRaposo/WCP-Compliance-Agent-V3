import { Hono } from "hono";

import { httpClient } from "../utils/http-client.js";
import { BackendError } from "../utils/errors.js";

export const analytics = new Hono();

analytics.get("/overview", async (c) => {
  const days = c.req.query("days") ?? "30";
  try {
    const data = await httpClient.get<unknown>(`/analytics/overview?days=${days}`);
    return c.json(data, 200);
  } catch (err) {
    // Dev fallback: return a mocked overview so the frontend can render
    // when the backend DB is unavailable during local development.
    if (err instanceof BackendError) {
      // If backend responded with a clear error, surface it but also provide a mock
      return c.json(
        { error: err.message, overview: { total_decisions: 0, total_contracts: 0, avg_trust_score: 0.0, overall_approval_rate: 0.0, human_review_queue_depth: 0, decisions_this_month: 0, note: "Mocked overview (backend error)" } },
        502
      );
    }
    return c.json({ total_decisions: 0, total_contracts: 0, avg_trust_score: 0.0, overall_approval_rate: 0.0, human_review_queue_depth: 0, decisions_this_month: 0, note: "Backend unreachable — returning empty overview" }, 503);
  }
});

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
