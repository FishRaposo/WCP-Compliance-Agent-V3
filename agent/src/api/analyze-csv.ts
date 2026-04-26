import { Hono } from "hono";

import { httpClient } from "../utils/http-client.js";
import { BackendError } from "../utils/errors.js";

export const analyzeCsv = new Hono();

analyzeCsv.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const items = body.items ?? [];
    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ error: "Missing items array" }, 400);
    }

    const result = await httpClient.post<{
      job_id: string;
      status: string;
    }>("/jobs", {
      task_type: "process_payroll",
      payload: { items },
    });

    return c.json(result, 202);
  } catch (err) {
    if (err instanceof BackendError) {
      return c.json({ error: err.message }, 502);
    }
    return c.json({ error: "CSV batch submission failed" }, 500);
  }
});
