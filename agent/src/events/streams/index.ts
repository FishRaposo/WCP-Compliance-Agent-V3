/**
 * V4 Redis Streams Module
 *
 * Import-safe Redis Streams consumer and producer for V4 event processing.
 * See ADR-013 for architecture context.
 *
 * @module events/streams
 */

export {
  type StreamConfig,
  type StreamMessageHandler,
  ensureConsumerGroup,
  readStreamMessages,
  addStreamMessage,
  closeStreamConsumer,
} from "./consumer.js";
