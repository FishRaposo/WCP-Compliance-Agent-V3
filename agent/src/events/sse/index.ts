/**
 * V4 SSE Bridge Module
 *
 * HTTP Server-Sent Events (SSE) bridge for V4 real-time event streams.
 * Bridges Redis Streams to SSE for client subscriptions.
 *
 * @module events/sse
 */

export {
  type V4SSEEventType,
  type SSEEventPayload,
  broadcastSSEEvent,
  createSSEBridge,
  closeSSEConnection,
  closeAllSSEConnections,
  getActiveSSEConnectionCount,
} from "./bridge.js";
