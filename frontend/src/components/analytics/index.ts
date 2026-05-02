export const analyticsPageRoute = "/analytics";
export const analyticsApiRoute = "/api/v4/analytics";
export const analyticsSubPages = [
  { href: "/analytics/overview", label: "Overview" },
  { href: "/analytics/compliance", label: "Compliance" },
  { href: "/analytics/wages", label: "Wages" },
  { href: "/analytics/llm", label: "LLM Cost" },
] as const;