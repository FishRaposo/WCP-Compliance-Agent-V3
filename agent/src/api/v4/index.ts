export const v4PublicApiPrefix = "/api";
export const v4BackendApiPrefix = "/v4";

export const v4RouteMap = {
  analytics: "/api/analytics",
  contracts: "/api/contracts",
  payrolls: "/api/payrolls",
  ingestion: "/api/ingestion",
} as const;

export type V4RouteName = keyof typeof v4RouteMap;
