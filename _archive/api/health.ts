/**
 * Vercel Serverless Function — GET /api/health
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

export default function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-OpenAI-Key");
  }

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: { message: "Method not allowed", statusCode: 405 } });
  }

  const key = process.env.OPENAI_API_KEY || "";
  const mockMode = !key || ["mock", "mock-key", "test-api-key", ""].includes(key);

  return res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.6.0",
    environment: process.env.NODE_ENV || "production",
    mockMode,
    byok: true,
    openai: {
      apiKeyConfigured: !mockMode,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    },
  });
}
