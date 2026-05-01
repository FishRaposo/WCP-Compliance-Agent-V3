export const v4PublicApiPrefix = "/api";
export const v4BackendApiPrefix = "/v4";

export const v4RouteMap = {
  analytics: "/api/analytics",
  analyticsOverview: "/api/analytics/overview",
  analyticsDecisionVolume: "/api/analytics/decision-volume",
  analyticsCompliance: "/api/analytics/compliance",
  analyticsWages: "/api/analytics/wages",
  analyticsLlm: "/api/analytics/llm",
  contracts: "/api/contracts",
  payrolls: "/api/payrolls",
  ingestion: "/api/ingestion",
  ingestionBulkUpload: "/api/ingestion/bulk-upload",
} as const;

export type V4RouteName = keyof typeof v4RouteMap;
