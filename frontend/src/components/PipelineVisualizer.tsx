import type { PipelineStep } from "../types/api";

interface Props {
  steps?: PipelineStep[];
}

const defaultSteps: PipelineStep[] = [
  { label: "Extract", status: "pending" },
  { label: "Validate", status: "pending" },
  { label: "Verdict", status: "pending" },
  { label: "Trust Score", status: "pending" },
  { label: "Persist", status: "pending" },
];

export default function PipelineVisualizer({ steps = defaultSteps }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded text-xs font-medium ${
            step.status === "done" ? "bg-green-100 text-green-700" :
            step.status === "running" ? "bg-blue-100 text-blue-700 animate-pulse" :
            step.status === "error" ? "bg-red-100 text-red-700" :
            "bg-gray-100 text-gray-500"
          }`}>
            {step.status === "done" && "✓ "}{step.label}
          </div>
          {i < steps.length - 1 && <span className="text-gray-300">→</span>}
        </div>
      ))}
    </div>
  );
}
