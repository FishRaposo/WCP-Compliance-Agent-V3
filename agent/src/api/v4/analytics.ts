import { Hono } from "hono";

import { proxyJson } from "./proxy.js";

/**
 * V4 Analytics Proxy Routes
 *
 * Proxies analytics requests to backend V4 endpoints:
 *   GET /api/analytics/overview     → GET /v4/analytics/overview
 *   GET /api/analytics/decision-volume → GET /v4/analytics/decision-volume
 *   GET /api/analytics/compliance   → GET /v4/analytics/compliance
 *   GET /api/analytics/wages        → GET /v4/analytics/wages
 *   GET /api/analytics/llm         → GET /v4/analytics/llm
 *
 * These routes are mounted under the shared /api/analytics prefix in server.ts
 * (v4Analytics router), so existing V3 analytics routes (overview, volume,
 * approval-by-trade, trust-band-distribution, cost) remain accessible alongside
 * the new V4 endpoints.
 */

export const v4Analytics = new Hono();

/** V4 Analytics Overview — DuckDB-powered cross-entity summary */
v4Analytics.get("/overview", (c) => proxyJson(c, "GET", "/v4/analytics/overview"));

/** V4 Decision Volume — time-series decision counts per period */
v4Analytics.get("/decision-volume", (c) => proxyJson(c, "GET", "/v4/analytics/decision-volume"));

/** V4 Compliance — approval/rejection rates and flag trends */
v4Analytics.get("/compliance", (c) => proxyJson(c, "GET", "/v4/analytics/compliance"));

/** V4 Wages — prevailing wage analysis and DBWD match rates */
v4Analytics.get("/wages", (c) => proxyJson(c, "GET", "/v4/analytics/wages"));

/** V4 LLM — token usage, cost breakdown, and provider latency */
v4Analytics.get("/llm", (c) => proxyJson(c, "GET", "/v4/analytics/llm"));