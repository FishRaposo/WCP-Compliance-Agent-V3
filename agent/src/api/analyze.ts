import { Hono } from "hono";
import { z } from "zod";

export const analyze = new Hono();

const AnalyzeRequest = z.object({
  text: z.string().min(1),
  job_id: z.string().optional(),
});

analyze.post("/", async (c) => {
  // TODO: implement — validate → call Mastra pipeline → return TrustScoredDecision
  return c.json({ error: "Not implemented" }, 501);
});
