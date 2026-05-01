/**
 * V4 SSE Bridge Scaffold
 *
 * Bridges V4 event streams (Redis Streams) to HTTP Server-Sent Events (SSE).
 * Allows clients to subscribe to real-time V4 events via SSE endpoint.
 *
 * Import-safe: does not require Redis at import time.
 *
 * V4 Event Architecture: events/sse/bridge.ts
 */

import { logger } from "../../utils/logger.js";
import { type StreamConfig, type StreamMessageHandler, readStreamMessages } from "../streams/index.js";

/** SSE event types for V4 */
export type V4SSEEventType = "contract.created" | "contract.updated" | "payroll.created" | "job.completed" | "error";

/** SSE event payload */
export interface SSEEventPayload {
  type: V4SSEEventType;
  data: Record<string, unknown>;
  timestamp: string;
  streamId?: string;
}

/** SSE connection state */
interface SSEConnection {
  controller: ReadableStreamDefaultController<Uint8Array>;
  streamName: string;
  isActive: boolean;
}

/** Active SSE connections registry */
const activeConnections = new Map<string, SSEConnection>();

/**
 * Formats data as SSE-compliant message
 */
export const formatSSEEvent = (payload: SSEEventPayload): string => {
  const lines = [
    `event: ${payload.type}`,
    `data: ${JSON.stringify(payload.data)}`,
    `id: ${payload.streamId ?? payload.timestamp}`,
    "",
    "",
  ];
  return lines.join("\r\n");
};

/**
 * Encodes string to Uint8Array for streaming
 */
const encodeToStream = (chunk: string): Uint8Array =>
  new TextEncoder().encode(chunk);

/**
 * Broadcasts an SSE event to all connected clients subscribed to a stream.
 */
export const broadcastSSEEvent = (streamName: string, payload: SSEEventPayload): void => {
  const eventData = formatSSEEvent(payload);
  const encoded = encodeToStream(eventData);

  for (const [id, conn] of activeConnections) {
    if (conn.isActive && conn.streamName === streamName) {
      try {
        conn.controller.enqueue(encoded);
      } catch (err) {
        logger.error({ connectionId: id, err }, "Failed to enqueue SSE event");
        conn.isActive = false;
      }
    }
  }
};

/**
 * Creates a handler that bridges Redis Stream events to SSE.
 * Returns a ReadableStream that can be used as SSE response body.
 */
export const createSSEBridge = (
  connectionId: string,
  streamConfig: StreamConfig
): ReadableStream<Uint8Array> => {
  let isActive = true;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Register this connection
      activeConnections.set(connectionId, {
        controller,
        streamName: streamConfig.streamName,
        isActive: true,
      });
      logger.info({ connectionId, stream: streamConfig.streamName }, "SSE bridge connected");

      // Send initial heartbeat comment to establish connection
      const heartbeat = encodeToStream(": heartbeat\n\n");
      try {
        controller.enqueue(heartbeat);
      } catch {
        isActive = false;
      }
    },
    async pull(controller) {
      // Read from Redis Stream and forward to SSE
      const handler: StreamMessageHandler = async (messageId, fields) => {
        const payload: SSEEventPayload = {
          type: (fields.type as V4SSEEventType) ?? "error",
          data: fields,
          timestamp: new Date().toISOString(),
          streamId: messageId,
        };
        const eventData = formatSSEEvent(payload);
        controller.enqueue(encodeToStream(eventData));
      };

      try {
        await readStreamMessages(streamConfig, handler, 1000);
      } catch (err) {
        logger.error({ connectionId, err }, "SSE bridge pull error");
        const errorPayload: SSEEventPayload = {
          type: "error",
          data: { message: "Stream read error" },
          timestamp: new Date().toISOString(),
        };
        controller.enqueue(encodeToStream(formatSSEEvent(errorPayload)));
      }

      // If connection is no longer active, cancel the stream
      if (!activeConnections.get(connectionId)?.isActive) {
        controller.close();
      }
    },
    cancel() {
      const conn = activeConnections.get(connectionId);
      if (conn) {
        conn.isActive = false;
        activeConnections.delete(connectionId);
        logger.info({ connectionId }, "SSE bridge disconnected");
      }
    },
  });

  return stream;
};

/**
 * Closes a specific SSE connection by ID.
 */
export const closeSSEConnection = (connectionId: string): void => {
  const conn = activeConnections.get(connectionId);
  if (conn) {
    conn.isActive = false;
    try {
      conn.controller.close();
    } catch {
      // Already closed or errored
    }
    activeConnections.delete(connectionId);
    logger.info({ connectionId }, "SSE connection closed");
  }
};

/**
 * Closes all active SSE connections.
 */
export const closeAllSSEConnections = (): void => {
  for (const [id] of activeConnections) {
    closeSSEConnection(id);
  }
  logger.info("All SSE connections closed");
};

/**
 * Returns the count of active SSE connections.
 */
export const getActiveSSEConnectionCount = (): number => activeConnections.size;
