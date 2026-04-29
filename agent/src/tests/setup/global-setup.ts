/// <reference types="node" />
/**
 * Vitest global setup: starts a mock Python backend on port 9999
 * so integration tests run without a real Python backend.
 */

import { startMockBackend } from "../integration/mock-python.js";

let server: ReturnType<typeof startMockBackend> | null = null;

export async function setup() {
  process.env["BACKEND_URL"] = "http://localhost:9999";
  process.env["LLM_MODE"] = "mock";
  process.env["OPENAI_API_KEY"] = "mock";
  process.env["AUTH_DISABLED"] = "true";
  server = await startMockBackend(9999);
}

export async function teardown() {
  if (server) {
    await new Promise<void>((resolve) => {
      server!.close(() => resolve());
    });
  }
}
