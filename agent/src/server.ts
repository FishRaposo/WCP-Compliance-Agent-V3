import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { config, corsOrigins } from "./config.js";
import { analyze } from "./api/analyze.js";
import { analyzePdf } from "./api/analyze-pdf.js";
import { analyzeCsv } from "./api/analyze-csv.js";
import { auth } from "./api/auth.js";
import { health } from "./api/health.js";
import { decisions } from "./api/decisions.js";
import { jobs } from "./api/jobs.js";
import { analytics } from "./api/analytics.js";
import { promptVersions } from "./api/prompt-versions.js";
import { contracts } from "./api/v4/contracts.js";
import { ingestion } from "./api/v4/ingestion.js";
import { payrolls } from "./api/v4/payrolls.js";
import { authMiddleware } from "./middleware/auth.js";
import { rateLimiter } from "./middleware/rate_limiter.js";
import { logger } from "./utils/logger.js";

const app = new Hono();

app.use("*", async (c, next) => {
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  await next();
});

app.use("*", cors({ origin: corsOrigins, credentials: true }));
app.use("/api/*", rateLimiter());

app.route("/health", health);
app.route("/api/auth", auth);

// Protected routes
app.use("/api/analyze", authMiddleware);
app.use("/api/analyze-pdf", authMiddleware);
app.use("/api/analyze-csv", authMiddleware);
app.use("/api/decisions", authMiddleware);
app.use("/api/jobs", authMiddleware);
app.use("/api/analytics", authMiddleware);
app.use("/api/contracts", authMiddleware);
app.use("/api/payrolls", authMiddleware);
app.use("/api/ingestion", authMiddleware);
app.use("/api/prompt-versions", authMiddleware);

app.route("/api/analyze", analyze);
app.route("/api/analyze-pdf", analyzePdf);
app.route("/api/analyze-csv", analyzeCsv);
app.route("/api/decisions", decisions);
app.route("/api/jobs", jobs);
app.route("/api/analytics", analytics);
app.route("/api/contracts", contracts);
app.route("/api/payrolls", payrolls);
app.route("/api/ingestion", ingestion);
app.route("/api/prompt-versions", promptVersions);

serve({ fetch: app.fetch, port: config.PORT }, () => {
  logger.info({ port: config.PORT }, "WCP Agent Gateway started");
});

export default app;
