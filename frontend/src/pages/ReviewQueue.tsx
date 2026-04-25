import HumanReviewQueue from "../components/HumanReviewQueue.tsx";

export default function ReviewQueue() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Human Review Queue</h1>
      <p className="text-sm text-gray-500">Decisions with trust score below 60% requiring human review.</p>
      <HumanReviewQueue />
    </div>
  );
}
