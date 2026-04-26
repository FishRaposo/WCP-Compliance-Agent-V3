import { Hono } from "hono";

import { config } from "../config.js";
import { runPipelineFromExtracted } from "../mastra/workflows/wcp-pipeline.js";
import { BackendError } from "../utils/errors.js";
import type { ExtractedWCP } from "../types/index.js";

export const analyzePdf = new Hono();

analyzePdf.post("/", async (c) => {
  try {
    const form = await c.req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return c.json({ error: "Missing file" }, 400);
    }

    // Step 1: Extract PDF via backend
    const backendForm = new FormData();
    backendForm.append("file", file, file.name);

    const extractRes = await fetch(`${config.BACKEND_URL}/extract`, {
      method: "POST",
      body: backendForm,
    });

    if (!extractRes.ok) {
      const text = await extractRes.text();
      throw new BackendError(
        `Backend extract failed: ${extractRes.status} — ${text}`,
        "/extract"
      );
    }

    const extracted: ExtractedWCP = await extractRes.json();

    // Step 2-5: Run pipeline from extracted data
    const decision = await runPipelineFromExtracted(extracted);

    return c.json(decision, 200);
  } catch (err) {
    if (err instanceof BackendError) {
      return c.json({ error: err.message }, 502);
    }
    return c.json(
      { error: err instanceof Error ? err.message : "PDF analysis failed" },
      500
    );
  }
});
