/// <reference types="node" />
/**
 * Vitest setupFiles: injects mock environment variables into the test process
 * before any test module is loaded. This runs in the same worker process as tests.
 */

process.env["BACKEND_URL"] = "http://localhost:9999";
process.env["LLM_MODE"] = "mock";
process.env["OPENAI_API_KEY"] = "mock";
process.env["AUTH_DISABLED"] = "true";
process.env["NODE_ENV"] = "test";
