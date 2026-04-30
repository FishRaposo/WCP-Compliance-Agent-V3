import { memo } from "react";
import type { TrustBand } from "../types/api.ts";
import { Badge } from "@/components/ui/badge";

interface Props {
  score: number;
  band: TrustBand;
}

const bandStyles: Record<TrustBand, string> = {
  auto_approve: "border-green-300 bg-green-100 text-green-800",
  flag_for_review: "border-yellow-300 bg-yellow-100 text-yellow-800",
  require_human_review: "border-red-300 bg-red-100 text-red-800",
};

const bandLabels: Record<TrustBand, string> = {
  auto_approve: "Auto Approve",
  flag_for_review: "Flag for Review",
  require_human_review: "Requires Human Review",
};

export default memo(function TrustScoreBadge({ score, band }: Props) {
  return (
    <Badge variant="outline" className={bandStyles[band]}>
      <span className="font-bold">{(score * 100).toFixed(0)}%</span>
      <span className="ml-1.5">{bandLabels[band]}</span>
    </Badge>
  );
});
