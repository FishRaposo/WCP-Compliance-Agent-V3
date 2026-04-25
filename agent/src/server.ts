import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { config } from "./config.js";
import { analyze } from "./api/analyze.js";
import { analyzePdf } from "./api/analyze-pdf.js";
import { analyzeCsv } from "./api/analyze-csv.js";
import { health } from "./api/health.js";
import { decisions } from "./api/decisions.js";
import { jobs } from "./api/jobs.js";
import { authMiddleware } from "./middleware/auth.js";
import { rateLimiter } from "./middleware/rate_limiter.js";
import { logger } from "./utils/logger.js";

const app = new Hono();

app.use("*", cors({ origin: ["http://localhost:5173"], credentials: true }));
app.use("/api/*", rateLimiter());

app.route("/health", health);
app.route("/api/analyze", analyze);
app.route("/api/analyze-pdf", analyzePdf);
app.route("/api/analyze-csv", analyzeCsv);
app.route("/api/decisions", decisions);
app.route("/api/jobs", jobs);

serve({ fetch: app.fetch, port: config.PORT }, () => {
  logger.info({ port: config.PORT }, "WCP Agent Gateway started");
});

export default app;
