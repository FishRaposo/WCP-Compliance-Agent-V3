export const v4PublicApiPrefix = "/api";
export const v4BackendApiPrefix = "/v4";

export const v4RouteMap = {
  analytics: "/api/v4/analytics",
  analyticsOverview: "/api/v4/analytics/overview",
  analyticsDecisionVolume: "/api/v4/analytics/decision-volume",
  analyticsCompliance: "/api/v4/analytics/compliance",
  analyticsWages: "/api/v4/analytics/wages",
  analyticsLlm: "/api/v4/analytics/llm",
  contracts: "/api/contracts",
  payrolls: "/api/payrolls",
  ingestion: "/api/ingestion",
  ingestionBulkUpload: "/api/ingestion/bulk-upload",
} as const;

export type V4RouteName = keyof typeof v4RouteMap;
