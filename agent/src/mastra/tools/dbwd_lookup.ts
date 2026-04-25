import { httpClient } from "../../utils/http-client.js";

export async function dbwdLookupTool(trade: string, locality: string, date: string) {
  return httpClient.get(`/dbwd/${encodeURIComponent(trade)}/${encodeURIComponent(locality)}/${date}`);
}
