import { Hono } from "hono";

import { proxyJson } from "./proxy.js";

export const ingestion = new Hono();

ingestion.get("/jobs", (c) => proxyJson(c, "GET", "/v4/ingestion/jobs"));
ingestion.get("/status/:jobId", (c) =>
  proxyJson(c, "GET", `/v4/ingestion/status/${c.req.param("jobId")}`)
);
