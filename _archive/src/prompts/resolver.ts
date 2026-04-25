/**
 * Prompt Resolver
 *
 * Resolves the active prompt for a given key, loading file-based fallbacks
 * into the registry on first call so the registry is always populated.
 */

import { promptRegistry, registerInMemoryPrompt } from "./registry.js";
import { WCP_VERDICT_V2 } from "./versions/wcp-verdict-v2.js";
import { childLogger } from "../utils/logger.js";

const log = childLogger("PromptResolver");

// ============================================================================
// Bootstrap: register file-based prompts on module load
// ============================================================================

let _bootstrapped = false;

function bootstrap(): void {
  if (_bootstrapped) return;
  registerInMemoryPrompt(WCP_VERDICT_V2);
  _bootstrapped = true;
}

// ============================================================================
// Resolver
// ============================================================================

/**
 * Resolve the active prompt for a key.
 *
 * Resolution order:
 *   1. DB — org-specific version (if orgId provided)
 *   2. DB — global version
 *   3. In-memory file-based registry (fallback)
 *
 * @param key Prompt key (e.g., "wcp_verdict")
 * @param orgId Optional organisation ID for tenant-specific overrides
 * @returns The active prompt template, or null if none found
 */
export async function resolvePrompt(key: string, orgId?: string): Promise<string | null> {
  bootstrap();

  const template = await promptRegistry.getActivePrompt(key, orgId);
  return template?.content ?? null;
}

/**
 * Resolve the full PromptTemplate (content + version metadata) for a key.
 * Used by Layer 2 to capture promptVersion in the audit trail (M4).
 */
export async function resolvePromptTemplate(key: string, orgId?: string): Promise<import("./registry.js").PromptTemplate | null> {
  bootstrap();
  return promptRegistry.getActivePrompt(key, orgId);
}

/**
 * Seed the DB registry with all known prompts (call from seed-corpus.ts).
 */
export async function seedPromptRegistry(): Promise<void> {
  bootstrap();
  await promptRegistry.registerPrompt(WCP_VERDICT_V2);
  log.info("[PromptRegistry] Seeded v2 (active)");
}
