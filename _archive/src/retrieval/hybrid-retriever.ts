/**
 * Hybrid Retriever
 *
 * Orchestrates BM25 → vector → RRF → cross-encoder pipeline to resolve a
 * trade classification string into DBWD rate information.
 *
 * Fallback chain (most robust first):
 *   1. Full hybrid (ES + pgvector + rerank) — when both services available
 *   2. BM25 only — when pgvector unavailable
 *   3. Vector only — when ES unavailable
 *   4. In-memory corpus — when both services unavailable (development fallback)
 *
 * This module is the ONLY external-facing interface for retrieval.
 * Layer 1 calls lookupDBWDRate() — never the sub-modules directly.
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { bm25Search } from "./bm25-search.js";
import { vectorSearch } from "./vector-search.js";
import { rrfFusion } from "./rrf-fusion.js";
import { crossEncoderRerank } from "./cross-encoder.js";
import type { RetrievalHit, RetrievalResult } from "./types.js";
import type { DBWDRateInfo } from "../types/decision-pipeline.js";
import { childLogger } from "../utils/logger.js";

const log = childLogger("HybridRetriever");

// ============================================================================
// In-memory fallback corpus (from Phase 01)
// Matches all 20 entries in data/dbwd-corpus.json for offline dev/test.
// ============================================================================

export const IN_MEMORY_CORPUS: Record<string, { base: number; fringe: number; wdId: string; tradeCode: string }> = {
  Electrician:       { base: 51.69, fringe: 34.63, wdId: "WD-2024-ELEC-0490", tradeCode: "ELEC0490" },
  Laborer:           { base: 26.45, fringe: 12.50, wdId: "WD-2024-LABR-0210", tradeCode: "LABR0210" },
  Plumber:           { base: 48.20, fringe: 28.10, wdId: "WD-2024-PLMB-0380", tradeCode: "PLMB0380" },
  Carpenter:         { base: 45.00, fringe: 25.00, wdId: "WD-2024-CARP-0150", tradeCode: "CARP0150" },
  Mason:             { base: 42.50, fringe: 22.50, wdId: "WD-2024-MSON-0320", tradeCode: "MSON0320" },
  Ironworker:        { base: 49.75, fringe: 32.10, wdId: "WD-2024-IRON-0440", tradeCode: "IRON0440" },
  Roofer:            { base: 38.90, fringe: 18.20, wdId: "WD-2024-ROOF-0520", tradeCode: "ROOF0520" },
  Painter:           { base: 36.40, fringe: 17.80, wdId: "WD-2024-PNTR-0290", tradeCode: "PNTR0290" },
  Boilermaker:       { base: 52.30, fringe: 35.40, wdId: "WD-2024-BLMK-0110", tradeCode: "BLMK0110" },
  "Sheet Metal Worker": { base: 47.60, fringe: 29.30, wdId: "WD-2024-SHMT-0560", tradeCode: "SHMT0560" },
  "HVAC Mechanic":   { base: 46.80, fringe: 28.60, wdId: "WD-2024-HVAC-0240", tradeCode: "HVAC0240" },
  Glazier:           { base: 44.10, fringe: 24.50, wdId: "WD-2024-GLZR-0220", tradeCode: "GLZR0220" },
  Insulator:         { base: 45.90, fringe: 26.70, wdId: "WD-2024-INST-0260", tradeCode: "INST0260" },
  "Operating Engineer": { base: 50.20, fringe: 33.80, wdId: "WD-2024-OPEG-0470", tradeCode: "OPEG0470" },
  "Truck Driver":    { base: 32.15, fringe: 15.40, wdId: "WD-2024-TRDR-0590", tradeCode: "TRDR0590" },
  "Concrete Worker": { base: 40.30, fringe: 21.90, wdId: "WD-2024-CONC-0170", tradeCode: "CONC0170" },
  Surveyor:          { base: 37.80, fringe: 19.60, wdId: "WD-2024-SURV-0580", tradeCode: "SURV0580" },
  "Tile Setter":     { base: 41.60, fringe: 22.80, wdId: "WD-2024-TILE-0600", tradeCode: "TILE0600" },
  "Drywall Finisher":{ base: 39.50, fringe: 20.40, wdId: "WD-2024-DRWL-0200", tradeCode: "DRWL0200" },
  "Sprinkler Fitter":{ base: 50.80, fringe: 33.20, wdId: "WD-2024-PROT-0500", tradeCode: "PROT0500" },
};

const IN_MEMORY_ALIASES: Record<string, string> = {
  Wireman: "Electrician",
  "Electrical Worker": "Electrician",
  "Journeyman Electrician": "Electrician",
  "Inside Wireman": "Electrician",
  "General Laborer": "Laborer",
  "Construction Worker": "Laborer",
  "Common Laborer": "Laborer",
  "Pipe Fitter": "Plumber",
  Pipefitter: "Plumber",
  "Steam Fitter": "Plumber",
  "Finish Carpenter": "Carpenter",
  "Framing Carpenter": "Carpenter",
  Bricklayer: "Mason",
  "Stone Mason": "Mason",
  "Structural Iron Worker": "Ironworker",
  "Reinforcing Iron Worker": "Ironworker",
  "Rebar Worker": "Ironworker",
  "Roofing Mechanic": "Roofer",
  "HVAC Sheet Metal": "Sheet Metal Worker",
  "Ductwork Installer": "Sheet Metal Worker",
  "Heating Mechanic": "HVAC Mechanic",
  "Air Conditioning Mechanic": "HVAC Mechanic",
  "Glass Worker": "Glazier",
  "Insulation Worker": "Insulator",
  "Equipment Operator": "Operating Engineer",
  "Heavy Equipment Operator": "Operating Engineer",
  "Crane Operator": "Operating Engineer",
  "Construction Truck Driver": "Truck Driver",
  "Dump Truck Driver": "Truck Driver",
  "Cement Mason": "Concrete Worker",
  "Concrete Finisher": "Concrete Worker",
  "Survey Party Chief": "Surveyor",
  "Tile Layer": "Tile Setter",
  "Ceramic Tile Installer": "Tile Setter",
  "Drywall Taper": "Drywall Finisher",
  "Fire Sprinkler Installer": "Sprinkler Fitter",
};

/** Description texts for cross-encoder (mirrors dbwd-corpus.json) */
const CORPUS_DESCRIPTIONS = new Map<string, string>([
  ["ELEC0490", "Electrician: installs, maintains, and repairs electrical wiring, equipment, and fixtures."],
  ["LABR0210", "Laborer: performs manual labor tasks on construction sites including site preparation and cleanup."],
  ["PLMB0380", "Plumber: installs and repairs pipes, fixtures, and other plumbing equipment."],
  ["CARP0150", "Carpenter: constructs, installs, and repairs structures and fixtures made of wood and plywood."],
  ["MSON0320", "Mason: builds or repairs walls, floors, and other structures with brick, block, or stone."],
  ["IRON0440", "Ironworker: erects and installs structural and reinforcing iron and steel."],
  ["ROOF0520", "Roofer: covers roofs with shingles, asphalt, aluminum, wood, and related materials."],
  ["PNTR0290", "Painter: applies paint, stain, varnish, enamel, and other finishes to buildings."],
  ["BLMK0110", "Boilermaker: constructs, assembles, maintains, and repairs stationary steam boilers."],
  ["SHMT0560", "Sheet Metal Worker: fabricates, assembles, installs, and repairs sheet metal products and HVAC ductwork."],
  ["HVAC0240", "HVAC Mechanic: installs, maintains, and repairs heating, ventilating, air-conditioning, and refrigeration systems."],
  ["GLZR0220", "Glazier: installs glass in windows, skylights, and other areas including curtain wall systems."],
  ["INST0260", "Insulator: applies insulation materials to pipes, ducts, boilers, and other surfaces."],
  ["OPEG0470", "Operating Engineer: operates and maintains heavy construction equipment such as cranes and excavators."],
  ["TRDR0590", "Truck Driver: operates trucks to transport materials to and from construction sites."],
  ["CONC0170", "Concrete Worker: smooths and finishes surfaces of poured concrete floors, walls, and sidewalks."],
  ["SURV0580", "Surveyor: measures and maps the Earth's surface on construction sites."],
  ["TILE0600", "Tile Setter: applies tile to floors, walls, ceilings, and other surfaces."],
  ["DRWL0200", "Drywall Finisher: tapes, finishes, and prepares drywall surfaces for painting."],
  ["PROT0500", "Sprinkler Fitter: installs, services, and repairs fire protection and suppression systems."],
]);

// ============================================================================
// H2: Runtime corpus override via WCP_CONFIG_PATH
// Loads a JSON file of trade rates at module init and merges into the tables.
// ============================================================================

interface CorpusEntry {
  trade: string;
  base: number;
  fringe: number;
  wdId: string;
  tradeCode: string;
  effectiveDate?: string;
}

interface ConfigAliases {
  tradeAliases?: Record<string, string>;
}

function loadCorpusOverride(): void {
  const configPath = process.env.WCP_CONFIG_PATH;
  if (!configPath) return;

  const absPath = resolve(configPath);
  if (!existsSync(absPath)) {
    log.warn({ absPath }, "WCP_CONFIG_PATH set but file not found");
    return;
  }

  try {
    const raw = readFileSync(absPath, "utf-8");
    const parsed = JSON.parse(raw) as CorpusEntry[] | ConfigAliases;

    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (entry.trade && typeof entry.base === "number" && typeof entry.fringe === "number") {
          IN_MEMORY_CORPUS[entry.trade] = {
            base: entry.base,
            fringe: entry.fringe,
            wdId: entry.wdId,
            tradeCode: entry.tradeCode,
          };
        }
      }
      log.info({ count: parsed.length, absPath }, "Loaded trade entries from corpus override");
    } else if (parsed && typeof parsed === "object" && "tradeAliases" in parsed) {
      const aliases = (parsed as ConfigAliases).tradeAliases ?? {};
      for (const [alias, canonical] of Object.entries(aliases)) {
        IN_MEMORY_ALIASES[alias] = canonical;
      }
      log.info({ count: Object.keys(aliases).length, absPath }, "Loaded trade aliases from corpus override");
    }
  } catch (err) {
    log.error({ err }, "Failed to parse WCP_CONFIG_PATH file");
  }
}

loadCorpusOverride();

// M7: Load tradeAliases from wcp.config.json at startup
(function loadWcpConfigAliases(): void {
  try {
    const configPath = resolve("wcp.config.json");
    if (!existsSync(configPath)) return;
    const raw = readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw) as { tradeAliases?: Record<string, string> };
    const aliases = config.tradeAliases ?? {};
    for (const [alias, canonical] of Object.entries(aliases)) {
      IN_MEMORY_ALIASES[alias] = canonical;
    }
    if (Object.keys(aliases).length > 0) {
      log.info({ count: Object.keys(aliases).length }, "Merged aliases from wcp.config.json");
    }
  } catch {
    // Non-fatal — config may not exist in all environments
  }
})();

// ============================================================================
// In-memory fallback lookup
// ============================================================================

function inMemoryLookup(role: string, locality?: string): DBWDRateInfo | null {
  const normalized = role.trim();

  // Exact match
  const direct = IN_MEMORY_CORPUS[normalized];
  if (direct) {
    return buildRateInfo(normalized, direct.base, direct.fringe, direct.wdId, direct.tradeCode, "2024-06-01", "exact", locality);
  }

  // Alias match
  const aliased = IN_MEMORY_ALIASES[normalized];
  if (aliased && IN_MEMORY_CORPUS[aliased]) {
    const r = IN_MEMORY_CORPUS[aliased];
    return buildRateInfo(aliased, r.base, r.fringe, r.wdId, r.tradeCode, "2024-06-01", "alias", locality);
  }

  return null;
}

function buildRateInfo(
  trade: string,
  base: number,
  fringe: number,
  wdId: string,
  tradeCode: string,
  effectiveDate: string,
  _method: string,
  locality?: string
): DBWDRateInfo {
  return {
    dbwdId: wdId,
    baseRate: base,
    fringeRate: fringe,
    totalRate: base + fringe,
    version: "2024-06-01",
    effectiveDate,
    trade,
    tradeCode,
    locality: locality ?? "Metropolitan Area",
  };
}

function hitToDBWDRateInfo(hit: RetrievalHit, locality?: string): DBWDRateInfo {
  return {
    dbwdId: hit.wdId,
    baseRate: hit.baseRate,
    fringeRate: hit.fringeRate,
    totalRate: hit.baseRate + hit.fringeRate,
    version: "2024-06-01",
    effectiveDate: hit.effectiveDate,
    trade: hit.jobTitle,
    tradeCode: hit.tradeCode,
    locality: locality ?? "Metropolitan Area",
  };
}

// ============================================================================
// Main export: lookupDBWDRate
// ============================================================================

export interface LookupResult {
  rateInfo: DBWDRateInfo | null;
  method: "hybrid" | "bm25_only" | "vector_only" | "in_memory" | "unknown";
  confidence: number;
  retrievalResult?: RetrievalResult;
}

/**
 * Look up DBWD rate for a trade classification using the full hybrid pipeline.
 *
 * @param role Trade classification string from WCP extraction
 * @param topK Number of candidates to return before re-ranking (default: 5)
 * @param locality Optional locality override; falls back to "Metropolitan Area"
 */
export async function lookupDBWDRate(
  role: string,
  topK = 5,
  locality?: string
): Promise<LookupResult> {
  const t0 = Date.now();

  // Run BM25 and vector search in parallel
  const [bm25Start] = [Date.now()];
  const [bm25Hits, vectorHits] = await Promise.all([
    bm25Search(role, { topK: 20 }),
    vectorSearch(role, { topK: 20 }),
  ]);
  const bm25Ms = Date.now() - bm25Start;
  const vectorMs = bm25Ms; // same parallel wall time

  const hasBM25 = bm25Hits.length > 0;
  const hasVector = vectorHits.length > 0;

  // Full fallback to in-memory when both sources empty
  if (!hasBM25 && !hasVector) {
    const fallback = inMemoryLookup(role, locality);
    return {
      rateInfo: fallback,
      method: "in_memory",
      confidence: fallback ? (IN_MEMORY_ALIASES[role.trim()] ? 0.9 : 1.0) : 0.3,
    };
  }

  // RRF fusion
  const fusionStart = Date.now();
  const fused = rrfFusion(bm25Hits, vectorHits);
  const fusionMs = Date.now() - fusionStart;

  // Cross-encoder re-rank on top-20
  const rerankStart = Date.now();
  const reranked = await crossEncoderRerank(role, fused.slice(0, 20), CORPUS_DESCRIPTIONS);
  const rerankMs = Date.now() - rerankStart;

  const best = reranked[0] ?? fused[0];
  const totalMs = Date.now() - t0;

  const method = hasBM25 && hasVector ? "hybrid" : hasBM25 ? "bm25_only" : "vector_only";

  return {
    rateInfo: best ? hitToDBWDRateInfo(best, locality) : null,
    method,
    confidence: best ? Math.min(best.score, 1.0) : 0.3,
    retrievalResult: {
      query: role,
      hits: reranked.slice(0, topK),
      timings: { bm25Ms, vectorMs, fusionMs, rerankMs, totalMs },
      metrics: {
        bm25Hits: bm25Hits.length,
        vectorHits: vectorHits.length,
        fusedHits: fused.length,
        finalHits: reranked.length,
      },
    },
  };
}
