import { config } from "../config.js";

export interface PromptVersion {
  version: string;
  template: string;
  description: string;
}

export const promptRegistry = {
  async getPrompt(name: string, version?: string): Promise<PromptVersion> {
    // TODO: implement — fetch from Langfuse by name + version, fallback to local registry
    throw new Error("Not implemented");
  },

  async listVersions(name: string): Promise<string[]> {
    // TODO: implement — list available versions from Langfuse
    throw new Error("Not implemented");
  },
};
