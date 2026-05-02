import { Hono } from "hono";

import { promptRegistry } from "../prompts/registry.js";

export const promptVersions = new Hono();

promptVersions.get("/", async (c) => {
  const versions = await promptRegistry.listVersions();
  return c.json(versions, 200);
});
