/**
 * V4 Redis Streams Consumer
 *
 * Import-safe module that provides a Redis Streams consumer for processing
 * V4 event streams. Redis client is lazily initialized to avoid requiring
 * Redis at import time.
 *
 * Key behaviors:
 * - Consumer group pattern (xreadgroup) ensures at-least-once delivery and
 *   allows multiple concurrent consumers (e.g., multiple SSE bridge connections).
 * - Messages are acknowledged (xack) only after the handler succeeds, ensuring
 *   durability across consumer restarts.
 * - xgroup CREATE is idempotent — BUSYGROUP errors are logged at debug level
 *   and ignored (group already exists).
 * - getRedisClient uses a lazy singleton; connection failures propagate
 *   immediately so callers can fall back gracefully.
 *
 * ADR-013: Redis Streams
 * V4 Event Architecture: events/streams/consumer.ts
 */

import { createRequire } from "node:module";
import { config } from "../../config.js";
import { logger } from "../../utils/logger.js";

const require = createRequire(import.meta.url);

/** Stream and consumer group configuration */
export interface StreamConfig {
  streamName: string;
  consumerGroup: string;
  consumerName: string;
}

/** Message handler function type */
export type StreamMessageHandler = (messageId: string, fields: Record<string, string>) => Promise<void>;

/** Redis client interface for type-safe access */
interface RedisClientInterface {
  on(event: "error", listener: (err: Error) => void): void;
  connect(): Promise<void>;
  quit(): Promise<void>;
  xgroup(...args: string[]): Promise<unknown>;
  xreadgroup(...args: string[]): Promise<unknown>;
  xack(stream: string, group: string, id: string): Promise<number>;
  xadd(stream: string, ...args: string[]): Promise<string>;
}

/** Redis client singleton - lazily initialized */
let redisClient: RedisClientInterface | null = null;

/**
 * Lazily initializes and returns the Redis client.
 * Throws if Redis is not available or connection fails.
 */
const getRedisClient = async (): Promise<RedisClientInterface> => {
  if (redisClient !== null) return redisClient;
  try {
    // Use createRequire so the module can be imported even when the optional
    // runtime dependency is unavailable in lightweight test environments.
    const Redis = require("ioredis");
    const client = new Redis({
      lazyConnect: true,
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD,
    }) as RedisClientInterface;
    client.on("error", (err: Error) => {
      logger.error({ err }, "Redis client error");
    });
    await client.connect();
    redisClient = client;
    return client;
  } catch (err) {
    logger.error({ err }, "Failed to connect to Redis");
    throw err;
  }
};

/**
 * Creates a consumer group for a stream if it doesn't exist.
 */
export const ensureConsumerGroup = async (config: StreamConfig): Promise<void> => {
  const client = await getRedisClient();
  try {
    // XGROUP CREATE is idempotent if group already exists (MKSTREAM creates stream if missing)
    await client.xgroup("CREATE", config.streamName, config.consumerGroup, "0", "MKSTREAM");
    logger.info({ stream: config.streamName, group: config.consumerGroup }, "Consumer group ensured");
  } catch (err) {
    // BUSYGROUP error means group already exists - this is fine
    if (err instanceof Error && err.message.includes("BUSYGROUP")) {
      logger.debug({ stream: config.streamName, group: config.consumerGroup }, "Consumer group already exists");
    } else {
      throw err;
    }
  }
};

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/** Internal type for XREADGROUP results */
type XReadGroupResult = [streamName: string, messages: [messageId: string, fields: string[]][]][];

/**
 * Reads new messages from a stream using consumer group pattern.
 * Blocks for `blockMs` milliseconds waiting for new messages.
 */
export const readStreamMessages = async (
  config: StreamConfig,
  handler: StreamMessageHandler,
  blockMs = 5000
): Promise<number> => {
  const client = await getRedisClient();
  const results = (await client.xreadgroup(
    "GROUP",
    config.consumerGroup,
    config.consumerName,
    "BLOCK",
    String(blockMs),
    "COUNT",
    "100",
    "STREAMS",
    config.streamName,
    ">"
  )) as XReadGroupResult | null;
  if (!results) return 0;

  let processed = 0;
  for (const [, messages] of results) {
    for (const [messageId, rawFields] of messages) {
      try {
        const fields = Object.fromEntries(chunkArray(rawFields, 2));
        await handler(messageId, fields);
        // Acknowledge the message after successful processing
        await client.xack(config.streamName, config.consumerGroup, messageId);
        processed++;
      } catch (err) {
        logger.error({ messageId, err }, "Failed to process stream message");
      }
    }
  }
  return processed;
};

/**
 * Adds a message to a stream (producer side).
 */
export const addStreamMessage = async (
  streamName: string,
  fields: Record<string, string>
): Promise<string> => {
  const client = await getRedisClient();
  const flatArgs: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    flatArgs.push(k, v);
  }
  const messageId = await client.xadd(streamName, "*", ...flatArgs);
  logger.debug({ streamName, messageId }, "Message added to stream");
  return messageId;
};

/**
 * Gracefully closes the Redis connection.
 */
export const closeStreamConsumer = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info("Redis stream consumer connection closed");
  }
};
