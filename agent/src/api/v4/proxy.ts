import type { Context } from "hono";

import { config } from "../../config.js";
import { BackendError } from "../../utils/errors.js";

const BACKEND_TIMEOUT_MS = 60_000;
type V4SuccessStatus = 200 | 201 | 202;

const buildBackendUrl = (path: string, queryString: string): string => {
  const suffix = queryString ? `${path}?${queryString}` : path;
  return `${config.BACKEND_URL}${suffix}`;
};

/** Headers forwarded from incoming request to backend V4 proxy */
const forwardedHeaders = [
  "authorization",
  "x-request-id",
  "x-trace-id",
  "x-correlation-id",
  "accept",
  "content-type",
] as const;
type ForwardedHeader = (typeof forwardedHeaders)[number];

/**
 * Extracts forwardable headers from the incoming request.
 * Includes auth headers, trace IDs, content type, and accept type.
 */
const extractForwardedHeaders = (c: Context): Record<string, string> => {
  const headers: Record<string, string> = {};
  for (const key of forwardedHeaders) {
    const value = c.req.header(key);
    if (value != null) headers[key] = value;
  }
  return headers;
};

/**
 * Proxies JSON requests to the backend. Handles empty responses, non-JSON
 * responses (text/plain, etc.), and JSON parse failures gracefully.
 *
 * Forwards auth headers (Authorization) and trace IDs (x-request-id, x-trace-id,
 * x-correlation-id) to the backend for observability correlation.
 */
export const proxyJson = async (
  c: Context,
  method: "GET" | "POST" | "PUT" | "DELETE",
  backendPath: string,
  successStatus: V4SuccessStatus = 200
): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
  try {
    const body = method === "GET" || method === "DELETE" ? undefined : await c.req.text();
    const headers = extractForwardedHeaders(c);
    // Ensure Content-Type is set for methods with body
    if (body && !headers["content-type"]) {
      headers["content-type"] = "application/json";
    }
    const init: RequestInit = {
      method,
      signal: controller.signal,
      headers,
    };
    if (body) {
      init.body = body;
    }
    const res = await fetch(buildBackendUrl(backendPath, c.req.url.split("?")[1] ?? ""), init);
    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text();
    if (!res.ok) {
      throw new BackendError(`Backend ${method} ${backendPath} failed: ${res.status} — ${text}`, backendPath);
    }
    if (!text) return c.body(null, successStatus);
    // If response is not JSON, return as text with appropriate content-type
    if (!contentType.includes("application/json")) {
      return c.body(text, successStatus, contentType ? { "Content-Type": contentType } : undefined);
    }
    try {
      return c.json(JSON.parse(text) as unknown, successStatus);
    } catch {
      // Malformed JSON - return as text
      return c.body(text, successStatus, { "Content-Type": "text/plain" });
    }
  } catch (err) {
    if (err instanceof BackendError) return c.json({ error: err.message }, 502);
    return c.json({ error: `Failed to proxy ${backendPath}` }, 500);
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Proxies multipart/binary requests to the backend (e.g., bulk contract uploads,
 * payroll file uploads, ingestion bulk-upload).
 *
 * Forwards the raw request body and all headers including Content-Type for multipart.
 * Auth and trace headers are forwarded for backend observability correlation.
 */
export const proxyMultipart = async (
  c: Context,
  method: "POST",
  backendPath: string,
  successStatus: V4SuccessStatus = 202
): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
  try {
    // Use c.req.raw to get the raw Request object and forward it
    const rawRequest = c.req.raw;
    const url = buildBackendUrl(backendPath, c.req.url.split("?")[1] ?? "");
    const headers = extractForwardedHeaders(c);
    // Type assertion for Node.js fetch duplex option (required for streaming body)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const init = {
      method,
      signal: controller.signal,
      headers,
      body: rawRequest.body,
      duplex: "half",
    } as any;
    const res = await fetch(url, init);
    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text();
    if (!res.ok) {
      throw new BackendError(`Backend ${method} ${backendPath} failed: ${res.status} — ${text}`, backendPath);
    }
    if (!text) return c.body(null, successStatus);
    // If response is not JSON, return as text with appropriate content-type
    if (!contentType.includes("application/json")) {
      return c.body(text, successStatus, contentType ? { "Content-Type": contentType } : undefined);
    }
    try {
      return c.json(JSON.parse(text) as unknown, successStatus);
    } catch {
      // Malformed JSON - return as text
      return c.body(text, successStatus, { "Content-Type": "text/plain" });
    }
  } catch (err) {
    if (err instanceof BackendError) return c.json({ error: err.message }, 502);
    return c.json({ error: `Failed to proxy ${backendPath}` }, 500);
  } finally {
    clearTimeout(timeout);
  }
};
