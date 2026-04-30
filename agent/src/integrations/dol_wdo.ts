/**
 * DOL Wage Determinations Online (WDO) integration.
 *
 * Phase 3: Implemented with graceful fallback when API is unavailable.
 * When no API key is configured, returns a warning message
 * and falls back to the backend's cached DBWD corpus.
 */

import { logger } from "../utils/logger.js";
import type { DBWDRateRecord } from "../types/index.js";

const DOL_WDO_API_URL = "https://www.dol.gov/agencies/whd/government-contracts/wage-determinations";

export async function fetchDolWdoRates(
  trade: string,
  locality: string
): Promise<{ rates: DBWDRateRecord[]; warning?: string }> {
  // Phase 3: DOL WDO does not require an API key for basic lookups,
  // but the endpoint format may change. We wrap it defensively.
  try {
    const url = new URL(DOL_WDO_API_URL);
    url.searchParams.set("trade", trade);
    url.searchParams.set("locality", locality);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "DOL WDO API request failed");
      return {
        rates: [],
        warning:
          "DOL WDO API returned an error. Using cached DBWD rates. " +
          "Visit https://www.dol.gov/agencies/whd/government-contracts for official determinations.",
      };
    }

    const data = (await res.json()) as { rates?: Record<string, string | number | undefined>[] };
    const rates: DBWDRateRecord[] = (data.rates || []).map((r) => ({
      trade: String(r.trade || trade),
      locality: String(r.locality || locality),
      rate: parseFloat(String(r.rate)),
      fringe: parseFloat(String(r.fringe || 0)),
      effective_date: String(r.effective_date || new Date().toISOString().split("T")[0]),
      wage_determination_number: String(r.wd_number || ""),
    }));

    return { rates };
  } catch (err) {
    logger.error({ err }, "DOL WDO fetch error");
    return {
      rates: [],
      warning:
        "DOL WDO request failed. Using cached DBWD rates. " +
        "Visit https://www.dol.gov/agencies/whd/government-contracts for official determinations.",
    };
  }
}
