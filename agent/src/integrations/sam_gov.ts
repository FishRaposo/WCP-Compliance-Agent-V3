/**
 * SAM.gov integration — fetch latest DBWD wage determination rates.
 *
 * Phase 3: Implemented with graceful fallback when API key is unavailable.
 * When SAM_GOV_API_KEY is missing or invalid, returns a warning message
 * and falls back to the backend's cached DBWD corpus.
 */

import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import type { DBWDRateRecord } from "../types/index.js";

const SAM_GOV_API_URL = "https://sam.gov/api/prod/dol/wage-determination";

export async function fetchSamGovRates(
  trade: string,
  locality: string
): Promise<{ rates: DBWDRateRecord[]; warning?: string }> {
  if (!config.SAM_GOV_API_KEY) {
    return {
      rates: [],
      warning:
        "SAM.gov API key not configured. Using cached DBWD rates. " +
        "Register for a SAM.gov API key at https://sam.gov/ to enable live rate lookups.",
    };
  }

  try {
    const url = new URL(SAM_GOV_API_URL);
    url.searchParams.set("trade", trade);
    url.searchParams.set("locality", locality);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${config.SAM_GOV_API_KEY}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      logger.warn({ status: res.status, body: text }, "SAM.gov API request failed");
      return {
        rates: [],
        warning: `SAM.gov API returned ${res.status}. Using cached DBWD rates.`,
      };
    }

    const data = (await res.json()) as { rates?: Record<string, string | number | undefined>[] };
    const rates: DBWDRateRecord[] = (data.rates || []).map((r) => ({
      trade: r.trade || trade,
      locality: r.locality || locality,
      rate: parseFloat(r.rate),
      fringe: parseFloat(r.fringe || 0),
      effective_date: r.effective_date || new Date().toISOString().split("T")[0],
      wage_determination_number: r.wd_number || "",
    }));

    return { rates };
  } catch (err) {
    logger.error({ err }, "SAM.gov fetch error");
    return {
      rates: [],
      warning: "SAM.gov request failed. Using cached DBWD rates.",
    };
  }
}
