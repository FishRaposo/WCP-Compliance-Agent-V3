import { Hono } from "hono";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

export const health = new Hono();

const __dirname = dirname(fileURLToPath(import.meta.url));
let version = "unknown";
try {
  const pkg = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf-8"));
  version = pkg.version ?? "unknown";
} catch {
  // package.json not available
}

health.get("/", (c) => c.json({ status: "ok", version }));
