import { Hono } from "hono";

import { httpClient } from "../utils/http-client.js";
import { BackendError } from "../utils/errors.js";

export const jobs = new Hono();

jobs.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const data = await httpClient.post<unknown>("/jobs", body);
    return c.json(data, 202);
  } catch (err) {
    if (err instanceof BackendError) {
      return c.json({ error: err.message }, 502);
    }
    return c.json({ error: "Failed to enqueue job" }, 500);
  }
});

jobs.get("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const data = await httpClient.get<unknown>(`/jobs/${id}`);
    return c.json(data, 200);
  } catch (err) {
    if (err instanceof BackendError) {
      return c.json({ error: err.message }, 502);
    }
    return c.json({ error: "Failed to fetch job status" }, 500);
  }
});
