import { Hono } from "hono";

import { proxyJson } from "./proxy.js";

export const payrolls = new Hono();

payrolls.get("/", (c) => proxyJson(c, "GET", "/v4/payrolls"));
payrolls.post("/bulk", (c) => proxyJson(c, "POST", "/v4/payrolls/bulk", 202));
payrolls.get("/:contractId/:payrollId", (c) =>
  proxyJson(c, "GET", `/v4/payrolls/${c.req.param("contractId")}/${c.req.param("payrollId")}`)
);
