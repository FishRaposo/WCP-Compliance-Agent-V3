import { useDecisions } from "../hooks/useDecisions.ts";
import DecisionCard from "./DecisionCard.tsx";

// Displays decisions with trust_score < 0.60 that require human review.
export default function HumanReviewQueue() {
  // TODO: implement — filter decisions where requires_human_review === true
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">No items pending review.</p>
    </div>
  );
}
