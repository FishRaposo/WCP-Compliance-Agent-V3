// CORS is configured centrally in config.ts and applied in server.ts via hono/cors.
// Re-export from config for backward compatibility with tests.

export { corsOrigins } from "../config.js";
