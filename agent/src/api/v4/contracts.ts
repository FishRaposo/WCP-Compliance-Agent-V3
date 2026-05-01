import { Hono } from "hono";

import { proxyJson, proxyMultipart } from "./proxy.js";

export const contracts = new Hono();

contracts.get("/", (c) => proxyJson(c, "GET", "/v4/contracts"));
contracts.post("/", (c) => proxyJson(c, "POST", "/v4/contracts", 201));
contracts.post("/bulk", (c) => proxyMultipart(c, "POST", "/v4/contracts/bulk", 202));
contracts.get("/:id", (c) => proxyJson(c, "GET", `/v4/contracts/${c.req.param("id")}`));
contracts.put("/:id", (c) => proxyJson(c, "PUT", `/v4/contracts/${c.req.param("id")}`));
contracts.delete("/:id", (c) => proxyJson(c, "DELETE", `/v4/contracts/${c.req.param("id")}`));
