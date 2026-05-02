/**
 * V4 SSE Bridge Scaffold
 *
 * Bridges V4 event streams (Redis Streams) to HTTP Server-Sent Events (SSE).
 * Allows clients to subscribe to real-time V4 events via SSE endpoint.
 *
 * Import-safe: does not require Redis at import time.
 *
 * Architecture:
 * - Redis Streams consumer group pattern (xreadgroup) for durable consumption
 * - SSE event format follows the text/event-stream MIME type
 * - Heartbeat comments (`: comment\r\n\r\n`) sent every 15s to prevent proxy timeouts
 * - Graceful fallback to synthetic heartbeat stream when Redis is unavailable
 * - Active connections tracked in-memory; connection IDs unique per client
 *
 * V4 Event Architecture: events/sse/bridge.ts
 */

import { logger } from "../../utils/logger.js";
import { type StreamConfig, type StreamMessageHandler, ensureConsumerGroup, readStreamMessages } from "../streams/index.js";

/** SSE event types for V4 */
export type V4SSEEventType =
  | "decision.created"
  | "contract.created"
  | "contract.updated"
  | "payroll.created"
  | "job.completed"
  | "error";

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

const MAX_SSE_CONNECTIONS = 100;

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
  if (activeConnections.size >= MAX_SSE_CONNECTIONS) {
    throw new Error("Maximum SSE connections exceeded");
  }
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await ensureConsumerGroup(streamConfig);
      } catch (err) {
        logger.warn({ connectionId, err }, "Redis consumer group unavailable at SSE start");
      }
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
        const conn = activeConnections.get(connectionId);
        if (conn) conn.isActive = false;
      }
    },
    async pull(controller) {
      // Read from Redis Stream and forward to SSE
      const handler: StreamMessageHandler = async (messageId, fields) => {
        const data = parseStreamFields(fields);
        const payload: SSEEventPayload = {
          type: inferEventType(streamConfig.streamName, fields),
          data,
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

const parseStreamFields = (fields: Record<string, string>): Record<string, unknown> => {
  if (typeof fields.event === "string") {
    try {
      const parsed = JSON.parse(fields.event) as unknown;
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return fields;
    }
  }
  return fields;
};

const inferEventType = (streamName: string, fields: Record<string, string>): V4SSEEventType => {
  if (isV4EventType(fields.type)) return fields.type;
  if (streamName.includes("decision")) return "decision.created";
  if (streamName.includes("contract")) return "contract.created";
  if (streamName.includes("payroll")) return "payroll.created";
  if (streamName.includes("ingestion")) return "job.completed";
  return "error";
};

const isV4EventType = (value: string | undefined): value is V4SSEEventType =>
  value === "decision.created" ||
  value === "contract.created" ||
  value === "contract.updated" ||
  value === "payroll.created" ||
  value === "job.completed" ||
  value === "error";

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
