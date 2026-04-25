import { config } from "../config.js";

const SAM_GOV_BASE = "https://api.sam.gov/wages/v2";

export interface DBWDRate {
  trade: string;
  locality: string;
  rate: number;
  fringe: number;
  effective_date: string;
  wage_determination_number: string;
}

export async function fetchDBWDRates(trade: string, locality: string): Promise<DBWDRate[]> {
  // TODO: implement SAM.gov API call
  throw new Error("Not implemented");
}
