export const decisionEventStreamName = "wcp.decisions";
export const v4EventOwner = "v4";

/**
 * V4 event stream names
 */
export const v4EventStreams = {
  /** Decision events stream */
  decisions: "wcp.decisions",
  /** Contract events stream */
  contracts: "wcp.contracts",
  /** Payroll events stream */
  payrolls: "wcp.payrolls",
  /** Ingestion job events stream */
  ingestion: "wcp.ingestion",
} as const;

export type V4EventStreamName = (typeof v4EventStreams)[keyof typeof v4EventStreams];

// Re-export streams module (import-safe, no Redis at import time)
export * from "./streams/index.js";

// Re-export SSE bridge module
export * from "./sse/index.js";
