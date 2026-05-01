import { Hono } from "hono";

import { proxyJson } from "./proxy.js";

export const payrolls = new Hono();

/**
 * V4 Payrolls Routes
 *
 * Proxies payroll CRUD and bulk operations to backend V4 endpoints.
 * Bulk import accepts the JSON shape expected by the backend V4 endpoint.
 */

payrolls.get("/", (c) => proxyJson(c, "GET", "/v4/payrolls"));
payrolls.post("/bulk", (c) => proxyJson(c, "POST", "/v4/payrolls/bulk", 202));
payrolls.get("/:contractId/:payrollId", (c) =>
  proxyJson(c, "GET", `/v4/payrolls/${c.req.param("contractId")}/${c.req.param("payrollId")}`)
);
