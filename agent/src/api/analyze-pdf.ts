import { Hono } from "hono";

export const analyzePdf = new Hono();

analyzePdf.post("/", async (c) => {
  // TODO: implement — parse multipart upload → forward PDF bytes to Python /extract/pdf → Mastra pipeline
  return c.json({ error: "Not implemented" }, 501);
});
