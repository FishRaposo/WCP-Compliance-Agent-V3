import { Hono } from "hono";
import { z } from "zod";

import { runWCPPipeline } from "../mastra/workflows/wcp-pipeline.js";
import { BackendError } from "../utils/errors.js";

export const analyze = new Hono();

const AnalyzeRequest = z.object({
  text: z.string().min(1),
  job_id: z.string().optional(),
});

analyze.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = AnalyzeRequest.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request", details: parsed.error.format() },
      400
    );
  }

  try {
    const decision = await runWCPPipeline(parsed.data.text);
    return c.json(decision, 200);
  } catch (err) {
    if (err instanceof BackendError) {
      return c.json({ error: err.message }, 502);
    }
    return c.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      500
    );
  }
});
