import { Hono } from "hono";

import { createSSEBridge, closeSSEConnection, v4EventStreams } from "../events/index.js";
import { logger } from "../utils/logger.js";

export const events = new Hono();

/**
 * SSE Subscribe Endpoint
 *
 * Provides Server-Sent Events (SSE) stream for V4 real-time events.
 * Bridges Redis Streams to HTTP SSE with periodic heartbeat comments.
 *
 * Query params:
 *   stream  — V4 event stream name (decisions | contracts | payrolls | ingestion).
 *             Defaults to "decisions".
 *   id      — Optional client-provided connection ID (used for debugging).
 *
 * Response: text/event-stream
 *
 * Graceful fallback: If Redis is unavailable, returns a synthetic heartbeat
 * stream so the client can establish connection and retry.
 */
events.get("/subscribe", async (c) => {
  const streamName = (c.req.query("stream") ?? "decisions") as (typeof v4EventStreams)[keyof typeof v4EventStreams];
  const clientId = c.req.query("id") ?? crypto.randomUUID();

  // Validate stream name
  const validStreams = Object.values(v4EventStreams) as string[];
  if (!validStreams.includes(streamName)) {
    return c.json(
      {
        error: `Invalid stream name. Must be one of: ${validStreams.join(", ")}`,
      },
      400
    );
  }

  const streamConfig = {
    streamName,
    consumerGroup: "sse-bridge",
    consumerName: `sse-${clientId}`,
  };

  let bridge: ReadableStream<Uint8Array> | null = null;

  try {
    bridge = createSSEBridge(clientId, streamConfig);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Maximum SSE connections exceeded")) {
      logger.warn({ clientId }, "SSE capacity exceeded");
      return c.json({ error: "Server at capacity" }, 503);
    }
    logger.warn({ err, clientId }, "Redis unavailable — returning synthetic heartbeat stream");
    const encoder = new TextEncoder();
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    const heartbeatStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(": connected (Redis unavailable)\n\n"));
        heartbeatTimer = setInterval(() => {
          const heartbeat = encoder.encode(": heartbeat\n\n");
          try {
            controller.enqueue(heartbeat);
          } catch {
            if (heartbeatTimer) clearInterval(heartbeatTimer);
            try { controller.close(); } catch { /* already closed */ }
          }
        }, 15_000);
      },
      cancel() {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        logger.debug({ clientId }, "Synthetic SSE stream cancelled");
      },
    });

    return c.newResponse(heartbeatStream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  // Graceful heartbeat wrapper for active SSE bridge
  // Sends a comment heartbeat every 15s to prevent proxy/Gateway timeouts
  const encoder = new TextEncoder();
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const wrappedStream = new ReadableStream<Uint8Array>({
    start(controller) {
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          closeSSEConnection(clientId);
        }
      }, 15_000);
    },
    async pull(controller) {
      const reader = bridge!.getReader();
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (err) {
        logger.error({ err, clientId }, "SSE bridge read error");
        try { controller.close(); } catch { /* already closed */ }
      } finally {
        reader.releaseLock();
      }
    },
    cancel() {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      closeSSEConnection(clientId);
      logger.debug({ clientId }, "SSE subscription cancelled");
    },
  });

  return c.newResponse(wrappedStream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});

/**
 * POST /api/events/unsubscribe — gracefully closes an SSE connection.
 * Body: { connectionId: string }
 */
events.post("/unsubscribe", async (c) => {
  const body = await c.req.json<{ connectionId?: unknown }>();
  const connectionId = typeof body?.connectionId === "string" ? body.connectionId : null;
  if (!connectionId) {
    return c.json({ error: "connectionId required" }, 400);
  }
  closeSSEConnection(connectionId);
  return c.json({ ok: true });
});