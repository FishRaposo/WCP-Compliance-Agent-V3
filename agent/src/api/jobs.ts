import { Hono } from "hono";

export const jobs = new Hono();

jobs.post("/", async (c) => {
  // TODO: implement — forward to Python /jobs
  return c.json({ error: "Not implemented" }, 501);
});

jobs.get("/:id", async (c) => {
  const id = c.req.param("id");
  // TODO: implement — proxy to Python /jobs/:id
  return c.json({ error: "Not implemented" }, 501);
});
