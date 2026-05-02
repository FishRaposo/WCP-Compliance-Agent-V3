import { Hono } from "hono";
import { stream } from "hono/streaming";

import { config } from "../config.js";
import { httpClient } from "../utils/http-client.js";
import { BackendError } from "../utils/errors.js";

export const decisions = new Hono();

decisions.get("/stream", async (c) => {
  const forwardedHeaders: Record<string, string> = {
    Accept: "text/event-stream",
  };
  const auth = c.req.header("Authorization");
  if (auth) forwardedHeaders["Authorization"] = auth;
  const requestId = c.req.header("x-request-id");
  if (requestId) forwardedHeaders["x-request-id"] = requestId;
  const traceId = c.req.header("x-trace-id");
  if (traceId) forwardedHeaders["x-trace-id"] = traceId;

  const backendRes = await fetch(`${config.BACKEND_URL}/decisions/stream`, {
    headers: forwardedHeaders,
  });

  if (!backendRes.ok) {
    return c.json({ error: `Backend SSE failed: ${backendRes.status}` }, 502);
  }

  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");
  c.header("X-Accel-Buffering", "no");

  return stream(c, async (s) => {

    if (!backendRes.body) return;
    const reader = backendRes.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await s.write(decoder.decode(value, { stream: true }));
      }
    } catch {
      // client disconnected
    } finally {
      reader.releaseLock();
    }
  });
});

decisions.get("/", async (c) => {
  const limit = c.req.query("limit") ?? "50";
  const offset = c.req.query("offset") ?? "0";
  const verdict = c.req.query("verdict");
  const trust_band = c.req.query("trust_band");

  const params = new URLSearchParams({ limit, offset });
  if (verdict) params.append("verdict", verdict);
  if (trust_band) params.append("trust_band", trust_band);

  try {
    const data = await httpClient.get<unknown[]>(`/decisions?${params.toString()}`);
    return c.json(data, 200);
  } catch (err) {
    if (err instanceof BackendError) {
      return c.json({ error: err.message }, 502);
    }
    return c.json({ error: "Failed to fetch decisions" }, 500);
  }
});

decisions.get("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const data = await httpClient.get<unknown>(`/decisions/${id}`);
    return c.json(data, 200);
  } catch (err) {
    if (err instanceof BackendError) {
      return c.json({ error: err.message }, 502);
    }
    return c.json({ error: "Failed to fetch decision" }, 500);
  }
});
