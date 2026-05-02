import type { Context } from "hono";

import { config } from "../../config.js";

const BACKEND_TIMEOUT_MS = 60_000;
type V4SuccessStatus = 200 | 201 | 202;

/**
 * Error subclass used exclusively by the V4 proxy layer.
 * Distinguishes safe backend errors (4xx — forward with original status)
 * from fatal proxy errors (network/parse — returns 502).
 */
export class ProxyError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly endpoint: string,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = "ProxyError";
  }
}

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

const extractForwardedHeaders = (c: Context): Record<string, string> => {
  const headers: Record<string, string> = {};
  for (const key of forwardedHeaders) {
    const value = c.req.header(key);
    if (value != null) headers[key] = value;
  }
  return headers;
};

interface RequestInitNodeDuplex extends RequestInit {
  duplex?: "half";
}

const buildNodeRequestInit = (init: RequestInitNodeDuplex): RequestInitNodeDuplex => init;

async function handle4xxResponse(c: Context, res: Response): Promise<Response> {
  const text = await res.text();
  let errorBody: Record<string, unknown> = { error: res.statusText };
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      errorBody = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (value !== null && value !== undefined) {
          errorBody[key] = value;
        }
      }
    }
  } catch {
    if (text) errorBody = { error: text };
  }
  return c.json(errorBody, res.status as 400 | 401 | 403 | 404 | 409 | 422);
}

async function handleSuccessResponse(c: Context, res: Response, successStatus: V4SuccessStatus): Promise<Response> {
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();
  if (!text) return c.body(null, successStatus);
  if (!contentType.includes("application/json")) {
    return c.body(text, successStatus, contentType ? { "Content-Type": contentType } : undefined);
  }
  try {
    return c.json(JSON.parse(text) as unknown, successStatus);
  } catch {
    return c.body(text, successStatus, { "Content-Type": "text/plain" });
  }
}

/**
 * Proxies JSON requests to the backend. Handles empty responses, non-JSON
 * responses (text/plain, etc.), and JSON parse failures gracefully.
 *
 * Forwards auth headers (Authorization) and trace IDs (x-request-id, x-trace-id,
 * x-correlation-id) to the backend for observability correlation.
 *
 * Error semantics:
 * - 4xx responses from backend are returned as-is (original status, sanitized body).
 * - 5xx responses from backend are returned as 502 with the backend status.
 * - Network/timeout/parse failures return 502.
 * - 3xx redirects from backend are not followed.
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

    if (res.status >= 400 && res.status < 500) {
      return handle4xxResponse(c, res);
    }

    if (res.status >= 500) {
      return c.json({ error: `Backend error ${res.status}` }, 502);
    }

    return handleSuccessResponse(c, res, successStatus);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return c.json({ error: `Backend request timed out after ${BACKEND_TIMEOUT_MS}ms` }, 504);
    }
    return c.json({ error: `Failed to proxy ${backendPath}` }, 502);
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Proxies multipart/binary requests to the backend.
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
    const rawRequest = c.req.raw;
    const url = buildBackendUrl(backendPath, c.req.url.split("?")[1] ?? "");
    const headers = extractForwardedHeaders(c);
    const init = buildNodeRequestInit({
      method,
      signal: controller.signal,
      headers,
      body: rawRequest.body,
      duplex: "half",
    });
    const res = await fetch(url, init);

    if (res.status >= 400 && res.status < 500) {
      return handle4xxResponse(c, res);
    }

    if (res.status >= 500) {
      return c.json({ error: `Backend error ${res.status}` }, 502);
    }

    return handleSuccessResponse(c, res, successStatus);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return c.json({ error: `Backend request timed out after ${BACKEND_TIMEOUT_MS}ms` }, 504);
    }
    return c.json({ error: `Failed to proxy ${backendPath}` }, 502);
  } finally {
    clearTimeout(timeout);
  }
};
