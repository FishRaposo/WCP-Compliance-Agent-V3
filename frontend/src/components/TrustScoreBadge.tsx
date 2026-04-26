import type { TrustBand } from "../types/api.ts";

interface Props {
  score: number;
  band: TrustBand;
}

const bandColors: Record<TrustBand, string> = {
  auto_approve: "bg-green-100 text-green-800",
  flag_for_review: "bg-yellow-100 text-yellow-800",
  require_human_review: "bg-red-100 text-red-800",
};

const bandLabels: Record<TrustBand, string> = {
  auto_approve: "Auto Approve",
  flag_for_review: "Flag for Review",
  require_human_review: "Requires Human Review",
};

export default function TrustScoreBadge({ score, band }: Props) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bandColors[band]}`}>
      {(score * 100).toFixed(0)}% trust — {bandLabels[band]}
    </span>
  );
}
