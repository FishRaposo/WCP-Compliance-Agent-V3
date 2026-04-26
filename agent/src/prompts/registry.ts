import { config } from "../config.js";
import { langfuse } from "../langfuse/client.js";
import { wcpVerdictV1 } from "./versions/wcp-verdict-v1.js";
import { wcpVerdictV2 } from "./versions/wcp-verdict-v2.js";

export interface PromptVersion {
  version: string;
  template: string;
  description: string;
}

const LOCAL_REGISTRY: Record<string, PromptVersion> = {
  [wcpVerdictV1.version]: wcpVerdictV1,
  [wcpVerdictV2.version]: wcpVerdictV2,
};

const DEFAULT_VERSION = config.OPENAI_MODEL.startsWith("gpt-4o-mini")
  ? "v2"
  : "v2";

function isLangfuseConfigured(): boolean {
  return Boolean(
    config.LANGFUSE_PUBLIC_KEY && config.LANGFUSE_SECRET_KEY
  );
}

export const promptRegistry = {
  async getPrompt(name: string, version?: string): Promise<PromptVersion> {
    const targetVersion = version ?? DEFAULT_VERSION;

    // Best-effort Langfuse fetch
    if (isLangfuseConfigured()) {
      try {
        const lfPrompt = await langfuse.getPrompt(name, targetVersion);
        if (lfPrompt?.prompt) {
          return {
            version: targetVersion,
            template: lfPrompt.prompt,
            description: `Langfuse prompt ${name}:${targetVersion}`,
          };
        }
      } catch {
        // Fall through to local registry
      }
    }

    const local = LOCAL_REGISTRY[targetVersion];
    if (local) return local;

    throw new Error(
      `Prompt "${name}" version "${targetVersion}" not found in local registry.`
    );
  },

  async listVersions(_name: string): Promise<string[]> {
    return Object.keys(LOCAL_REGISTRY);
  },
};
