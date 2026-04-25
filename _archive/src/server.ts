import { serve } from "@hono/node-server";
import { validateEnvironmentOrExit } from "./utils/env-validator.js";
import { createApp } from "./app.js";
import { childLogger } from "./utils/logger.js";

const log = childLogger("Server");

// Validate environment before starting server
validateEnvironmentOrExit();

const app = createApp();

const port = parseInt(process.env.PORT || '3000', 10);
log.info(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
