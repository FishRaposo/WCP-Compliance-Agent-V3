/**
 * Structured Logger (T6 + M5)
 *
 * Replaces all console.log/warn/error calls across the pipeline with pino.
 * Reads log level from LOG_LEVEL env var (default: "info").
 * In test environments (NODE_ENV=test), defaults to "silent" to suppress output.
 */

import pino from "pino";
import { createRequire } from "module";

// Read version from package.json at startup — single source of truth
const _require = createRequire(import.meta.url);
const _pkg = _require("../../package.json") as { version: string };

const isTest = process.env.NODE_ENV === "test";
const level = process.env.LOG_LEVEL ?? (isTest ? "silent" : "info");

export const logger = pino({
  level,
  base: {
    service: "wcp-compliance-agent",
    version: _pkg.version,
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Create a child logger bound to a specific module/stage.
 *
 * @param name Module or stage name (e.g., "Layer1", "Orchestrator")
 */
export function childLogger(name: string): pino.Logger {
  return logger.child({ module: name });
}
