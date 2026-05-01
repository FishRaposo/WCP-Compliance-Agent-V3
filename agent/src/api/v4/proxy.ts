import type { Context } from "hono";

import { config } from "../../config.js";
import { BackendError } from "../../utils/errors.js";

const BACKEND_TIMEOUT_MS = 60_000;
type V4SuccessStatus = 200 | 201 | 202;

const buildBackendUrl = (path: string, queryString: string): string => {
  const suffix = queryString ? `${path}?${queryString}` : path;
  return `${config.BACKEND_URL}${suffix}`;
};

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
    const init: RequestInit = {
      method,
      signal: controller.signal,
    };
    if (body) {
      init.headers = { "Content-Type": c.req.header("Content-Type") ?? "application/json" };
      init.body = body;
    }
    const res = await fetch(buildBackendUrl(backendPath, c.req.url.split("?")[1] ?? ""), init);
    const text = await res.text();
    if (!res.ok) {
      throw new BackendError(`Backend ${method} ${backendPath} failed: ${res.status} — ${text}`, backendPath);
    }
    if (!text) return c.body(null, successStatus);
    return c.json(JSON.parse(text) as unknown, successStatus);
  } catch (err) {
    if (err instanceof BackendError) return c.json({ error: err.message }, 502);
    return c.json({ error: `Failed to proxy ${backendPath}` }, 500);
  } finally {
    clearTimeout(timeout);
  }
};
