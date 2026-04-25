/**
 * Prompt Registry
 *
 * PostgreSQL-backed registry for versioned LLM prompts.
 * Supports per-org overrides and version resolution.
 *
 * Fallback: when PostgreSQL is unavailable, falls back to the file-based
 * version registry (src/prompts/versions/).
 */

import { query } from "../services/db-client.js";
import { childLogger } from "../utils/logger.js";

const log = childLogger("PromptRegistry");

// ============================================================================
// Types
// ============================================================================

export interface PromptTemplate {
  key: string;
  version: number;
  content: string;
  variables: string[];
  modelHint?: string;
  orgId?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// File-based fallback registry
// ============================================================================

const FILE_REGISTRY = new Map<string, PromptTemplate[]>();

/**
 * Register an in-memory prompt (used during seeding and as fallback).
 */
export function registerInMemoryPrompt(prompt: PromptTemplate): void {
  const key = prompt.orgId ? `${prompt.orgId}:${prompt.key}` : prompt.key;
  const existing = FILE_REGISTRY.get(key) ?? [];
  FILE_REGISTRY.set(key, [...existing.filter((p) => p.version !== prompt.version), prompt]);
}

function getActiveInMemory(key: string, orgId?: string): PromptTemplate | null {
  // Try org-specific first, then global
  const keys = orgId ? [`${orgId}:${key}`, key] : [key];

  for (const k of keys) {
    const versions = FILE_REGISTRY.get(k) ?? [];
    const active = versions.find((p) => p.isActive) ?? versions.sort((a, b) => b.version - a.version)[0];
    if (active) return active;
  }

  return null;
}

// ============================================================================
// PromptRegistry class
// ============================================================================

export class PromptRegistry {
  /**
   * Get the active prompt for a key, with optional org-level override.
   * Falls back to in-memory registry when DB unavailable.
   */
  async getActivePrompt(key: string, orgId?: string): Promise<PromptTemplate | null> {
    // Try DB first
    try {
      const orgClause = orgId
        ? `AND (org_id = $3 OR org_id IS NULL) ORDER BY CASE WHEN org_id = $3 THEN 0 ELSE 1 END, version DESC`
        : `AND org_id IS NULL ORDER BY version DESC`;

      const params = orgId ? [key, true, orgId] : [key, true];

      const result = await query<{
        key: string;
        version: number;
        content: string;
        variables: string;
        model_hint: string | null;
        org_id: string | null;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>(
        `SELECT key, version, content, variables, model_hint, org_id, is_active, created_at, updated_at
         FROM prompts
         WHERE key = $1 AND is_active = $2 ${orgClause}
         LIMIT 1`,
        params
      );

      if (result && result.rows.length > 0) {
        const row = result.rows[0];
        return {
          key: row.key,
          version: row.version,
          content: row.content,
          variables: JSON.parse(row.variables || "[]"),
          modelHint: row.model_hint ?? undefined,
          orgId: row.org_id ?? undefined,
          isActive: row.is_active,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      }
    } catch (err) {
      log.warn({ err }, "DB unavailable — falling back to in-memory prompt registry");
    }

    return getActiveInMemory(key, orgId);
  }

  /**
   * Register a prompt version in the DB.
   * If DB unavailable, registers in-memory only.
   */
  async registerPrompt(prompt: PromptTemplate): Promise<void> {
    registerInMemoryPrompt(prompt);

    try {
      await query(
        `INSERT INTO prompts (key, version, content, variables, model_hint, org_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (key, version, COALESCE(org_id, '')) DO UPDATE
           SET content = EXCLUDED.content,
               variables = EXCLUDED.variables,
               model_hint = EXCLUDED.model_hint,
               is_active = EXCLUDED.is_active,
               updated_at = NOW()`,
        [
          prompt.key,
          prompt.version,
          prompt.content,
          JSON.stringify(prompt.variables),
          prompt.modelHint ?? null,
          prompt.orgId ?? null,
          prompt.isActive,
        ]
      );
    } catch (err) {
      log.warn({ err }, "DB unavailable — prompt registered in-memory only");
    }
  }

  /**
   * Set a specific version as the active prompt.
   */
  async setActive(key: string, version: number, orgId?: string): Promise<void> {
    // Update in-memory
    const k = orgId ? `${orgId}:${key}` : key;
    const versions = FILE_REGISTRY.get(k) ?? [];
    FILE_REGISTRY.set(
      k,
      versions.map((p) => ({ ...p, isActive: p.version === version }))
    );

    // Update DB
    try {
      await query(
        `UPDATE prompts SET is_active = (version = $3), updated_at = NOW()
         WHERE key = $1 AND org_id IS NOT DISTINCT FROM $2`,
        [key, orgId ?? null, version]
      );
    } catch (err) {
      log.warn({ err }, "DB unavailable — prompt activation in-memory only");
    }
  }

  /**
   * List all versions of a prompt.
   */
  async listVersions(key: string, orgId?: string): Promise<PromptTemplate[]> {
    try {
      const result = await query<{
        key: string;
        version: number;
        content: string;
        variables: string;
        model_hint: string | null;
        org_id: string | null;
        is_active: boolean;
      }>(
        `SELECT key, version, content, variables, model_hint, org_id, is_active
         FROM prompts
         WHERE key = $1 AND org_id IS NOT DISTINCT FROM $2
         ORDER BY version DESC`,
        [key, orgId ?? null]
      );

      if (result && result.rows.length > 0) {
        return result.rows.map((row) => ({
          key: row.key,
          version: row.version,
          content: row.content,
          variables: JSON.parse(row.variables || "[]"),
          modelHint: row.model_hint ?? undefined,
          orgId: row.org_id ?? undefined,
          isActive: row.is_active,
        }));
      }
    } catch (err) {
      log.warn({ err }, "DB unavailable — prompt version listing in-memory only");
    }

    // Fall back to in-memory
    const k = orgId ? `${orgId}:${key}` : key;
    return FILE_REGISTRY.get(k) ?? [];
  }
}

// Singleton instance
export const promptRegistry = new PromptRegistry();
