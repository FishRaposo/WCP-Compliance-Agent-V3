import { Hono } from "hono";

import { proxyJson, proxyMultipart } from "./proxy.js";

export const ingestion = new Hono();

/**
 * V4 Ingestion Routes
 *
 * Proxies ingestion requests to backend V4 endpoints.
 * Multipart bulk-upload is routed to /v4/ingestion/bulk-upload.
 */

ingestion.get("/jobs", (c) => proxyJson(c, "GET", "/v4/ingestion/jobs"));
ingestion.get("/status/:jobId", (c) =>
  proxyJson(c, "GET", `/v4/ingestion/status/${c.req.param("jobId")}`)
);

/**
 * Bulk upload route — accepts multipart file uploads and proxies to backend.
 * Backend route: POST /v4/ingestion/bulk-upload
 * Content-Type: multipart/form-data with file + optional metadata fields.
 */
ingestion.post("/bulk-upload", (c) => proxyMultipart(c, "POST", "/v4/ingestion/bulk-upload", 202));
