import { config } from "../config.js";
import { BackendError } from "./errors.js";

export const httpClient = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${config.BACKEND_URL}${path}`);
    if (!res.ok) {
      throw new BackendError(`Backend GET ${path} failed: ${res.status}`, path);
    }
    return res.json() as Promise<T>;
  },

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${config.BACKEND_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BackendError(`Backend POST ${path} failed: ${res.status} — ${text}`, path);
    }
    return res.json() as Promise<T>;
  },
};
