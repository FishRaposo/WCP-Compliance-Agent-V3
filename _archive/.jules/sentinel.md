## 2026-04-19 - DoS Protection on Analyze Endpoint
**Vulnerability:** The `/analyze` endpoint accepted unconstrained `content` string lengths in its request payload, leading to potential Denial of Service (DoS) attacks as memory consumption and pipeline processing time scaled linearly with payload size.
**Learning:** External-facing APIs must restrict the maximum size of input payloads explicitly before any complex parsing, extraction, or downstream pipeline steps process the data.
**Prevention:** Implement `maxContentLength` in application configurations and explicitly check the `content.length` at the API layer, returning an immediate `413 Payload Too Large` error for oversized inputs to reject them cheaply.

## 2026-04-18 - Prevent Stack Trace Leakage in API Errors
**Vulnerability:** The application was inadvertently including internal stack traces in the `details` object returned by the global error handler (`src/utils/errors.ts`), exposing sensitive implementation details.
**Learning:** Even though the main `formatApiError` wrapper didn't expose these directly, instances of `WCPError` serialize their internal `details` property. Stack traces should never be serialized into properties that might eventually become part of an HTTP response payload.
**Prevention:** Remove `error.stack` from globally shared error objects. Instead, log stack traces directly on the server side (e.g., in the API handler `src/app.ts`) where it can be securely captured by observability tools without reaching the client.

## 2026-04-18 - Secure Defaults in Web Frameworks
**Vulnerability:** The application did not employ standard HTTP security headers to protect against common web vulnerabilities like XSS, clickjacking, and MIME-sniffing.
**Learning:** Web frameworks often require explicit middleware to set basic security headers.
**Prevention:** Always implement security headers middleware (e.g., `secureHeaders()` in Hono or `helmet()` in Express) globally before other application routes.
