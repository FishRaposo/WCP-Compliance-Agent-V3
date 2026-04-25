/**
 * OpenTelemetry Instrumentation (M5)
 *
 * Initializes the OTel SDK with:
 *   - NodeTracerProvider
 *   - OTLP HTTP exporter (when OTEL_EXPORTER_OTLP_ENDPOINT is set)
 *   - Console exporter (fallback for local development)
 *   - Auto-instrumentations for HTTP, DNS, etc.
 *
 * This file must be imported BEFORE any other application code in server.ts.
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { ConsoleSpanExporter, SimpleSpanProcessor, BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

const serviceName = process.env.OTEL_SERVICE_NAME ?? "wcp-compliance-agent";

const exporter = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  ? new OTLPTraceExporter({
      url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
    })
  : new ConsoleSpanExporter();

const spanProcessor = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  ? new BatchSpanProcessor(exporter)
  : new SimpleSpanProcessor(exporter);

const sdk = new NodeSDK({
  resourceDetectors: [],
  spanProcessor,
  serviceName,
  instrumentations: [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-fs": { enabled: false },
    }),
  ],
});

sdk.start();

process.on("SIGTERM", () => {
  sdk.shutdown().catch(() => {});
});

export { sdk };
