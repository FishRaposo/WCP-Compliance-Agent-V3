/**
 * Vercel Serverless Function — POST /api/analyze
 *
 * BYOK model: reads X-OpenAI-Key header and uses it for this request only.
 * Falls back to OPENAI_API_KEY env var, then to mock mode if neither is set.
 *
 * The key is NEVER logged, stored, or forwarded anywhere except to OpenAI.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

function getAllowedOrigin(origin: string | undefined): string | null {
  if (!origin) return null;
  const allowed = ["http://localhost:3000", "http://localhost:5173"];
  if (allowed.includes(origin) || /^https:\/\/.+\.vercel\.app$/.test(origin)) {
    return origin;
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS — allow the showcase frontend
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-OpenAI-Key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method not allowed", statusCode: 405 } });
  }

  // BYOK: read per-request key from header, fall back to env var
  const byokKey = req.headers["x-openai-key"];
  const keyToUse = (Array.isArray(byokKey) ? byokKey[0] : byokKey) || process.env.OPENAI_API_KEY || "";

  const MAX_CONTENT_BYTES = 64 * 1024; // 64 KB

  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({
      error: { message: "Invalid request body", statusCode: 400 },
    });
  }

  const { content } = req.body as Record<string, unknown>;

  if (!content || typeof content !== "string") {
    return res.status(400).json({
      error: { message: "content is required and must be a string", statusCode: 400 },
    });
  }

  if (Buffer.byteLength(content, "utf8") > MAX_CONTENT_BYTES) {
    return res.status(413).json({
      error: { message: `Content exceeds maximum allowed size of ${MAX_CONTENT_BYTES / 1024} KB`, statusCode: 413 },
    });
  }

  try {
    // Dynamic import keeps cold-start lean and avoids top-level env read
    const { generateWcpDecision } = await import("../dist/entrypoints/wcp-entrypoint.js");
    // Override env for this invocation (Vercel serverless = single-tenant per request)
    const previousKey = process.env.OPENAI_API_KEY ?? "";
    process.env.OPENAI_API_KEY = keyToUse;
    try {
      const result = await generateWcpDecision({ content });
      return res.status(200).json({
        ...result,
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        mockMode: !keyToUse || ["mock", "mock-key", "test-api-key"].includes(keyToUse),
      });
    } finally {
      process.env.OPENAI_API_KEY = previousKey;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ error: { message, statusCode: 500 } });
  }
}
