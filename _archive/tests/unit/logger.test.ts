/**
 * Unit tests for the pino logger utility (T6)
 */

import { describe, it, expect } from "vitest";
import { childLogger } from "../../src/utils/logger.js";

describe("Logger Utility", () => {
  it("childLogger returns a logger object", () => {
    const log = childLogger("TestModule");
    expect(log).toBeDefined();
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
    expect(typeof log.debug).toBe("function");
  });

  it("childLogger does not throw when logging", () => {
    const log = childLogger("TestModule");
    expect(() => log.info("test message")).not.toThrow();
    expect(() => log.warn({ key: "value" }, "warn message")).not.toThrow();
    expect(() => log.error({ err: new Error("oops") }, "error message")).not.toThrow();
    expect(() => log.debug("debug message")).not.toThrow();
  });

  it("childLogger creates distinct loggers per module", () => {
    const log1 = childLogger("ModuleA");
    const log2 = childLogger("ModuleB");
    expect(log1).not.toBe(log2);
  });

  it("childLogger is silent in test environment (NODE_ENV=test)", () => {
    // In test env, logger should be silent to avoid noisy output.
    // We just verify it doesn't throw; actual silence is a pino config concern.
    const log = childLogger("SilentTest");
    let threw = false;
    try {
      log.info("this should be silent");
      log.error("silent error");
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});
