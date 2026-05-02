import { config } from "../config.js";
import { BackendError } from "./errors.js";

const BACKEND_TIMEOUT_MS = 60_000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

export const httpClient = {
  async get<T>(path: string, headers?: Record<string, string>): Promise<T> {
    const res = await fetchWithTimeout(`${config.BACKEND_URL}${path}`, {
      method: "GET",
      ...(headers ? { headers } : {}),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new BackendError(`Backend GET ${path} failed: ${res.status} ${body}`, path);
    }
    return res.json() as Promise<T>;
  },

  async post<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
    const res = await fetchWithTimeout(`${config.BACKEND_URL}${path}`, {
      method: "POST",
      headers: headers
        ? { "Content-Type": "application/json", ...headers }
        : { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BackendError(
        `Backend POST ${path} failed: ${res.status} — ${text}`,
        path
      );
    }
    return res.json() as Promise<T>;
  },
};
