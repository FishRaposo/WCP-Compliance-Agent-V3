import type { TrustBand } from "../types/api.ts";

interface Props {
  score: number;
  band: TrustBand;
}

const bandColors: Record<TrustBand, string> = {
  high: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-red-100 text-red-800",
};

export default function TrustScoreBadge({ score, band }: Props) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bandColors[band]}`}>
      {(score * 100).toFixed(0)}% trust
    </span>
  );
}
