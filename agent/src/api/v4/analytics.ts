import { Hono } from "hono";

import { proxyJson } from "./proxy.js";

/**
 * V4 Analytics Proxy Routes
 *
 * Proxies analytics requests to backend V4 endpoints:
 *   GET /api/v4/analytics/overview     → GET /v4/analytics/overview
 *   GET /api/v4/analytics/decision-volume → GET /v4/analytics/decision-volume
 *   GET /api/v4/analytics/approval     → GET /v4/analytics/approval (V3 proxy fallback)
 *   GET /api/v4/analytics/compliance   → GET /v4/analytics/compliance
 *   GET /api/v4/analytics/wages        → GET /v4/analytics/wages
 *   GET /api/v4/analytics/llm          → GET /v4/analytics/llm
 */

export const v4Analytics = new Hono();

/** V4 Analytics Overview — DuckDB-powered cross-entity summary */
v4Analytics.get("/overview", (c) => proxyJson(c, "GET", "/v4/analytics/overview"));

/** V4 Decision Volume — time-series decision counts per period */
v4Analytics.get("/decision-volume", (c) => proxyJson(c, "GET", "/v4/analytics/decision-volume"));

/** Approval rates — proxy to V3 backend approval-by-trade for now */
v4Analytics.get("/approval", (c) => proxyJson(c, "GET", "/analytics/approval-by-trade"));

/** V4 Compliance — approval/rejection rates and flag trends */
v4Analytics.get("/compliance", (c) => proxyJson(c, "GET", "/v4/analytics/compliance"));

/** V4 Wages — prevailing wage analysis and DBWD match rates */
v4Analytics.get("/wages", (c) => proxyJson(c, "GET", "/v4/analytics/wages"));

/** V4 LLM — token usage, cost breakdown, and provider latency */
v4Analytics.get("/llm", (c) => proxyJson(c, "GET", "/v4/analytics/llm"));