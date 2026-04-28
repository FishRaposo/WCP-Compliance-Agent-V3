import { Langfuse } from "langfuse";
import { config } from "../config.js";

let client: Langfuse | null = null;

export function getLangfuse(): Langfuse | null {
  if (!config.LANGFUSE_PUBLIC_KEY || !config.LANGFUSE_SECRET_KEY) {
    return null;
  }

  client ??= new Langfuse({
    publicKey: config.LANGFUSE_PUBLIC_KEY,
    secretKey: config.LANGFUSE_SECRET_KEY,
    baseUrl: config.LANGFUSE_HOST,
  });

  return client;
}
