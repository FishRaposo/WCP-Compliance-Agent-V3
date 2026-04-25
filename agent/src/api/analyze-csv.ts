import { Hono } from "hono";

export const analyzeCsv = new Hono();

analyzeCsv.post("/", async (c) => {
  // TODO: implement — parse CSV bulk upload → enqueue Celery batch job → return job_id
  return c.json({ error: "Not implemented" }, 501);
});
