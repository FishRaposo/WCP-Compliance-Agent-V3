import { useState } from "react";
import UploadDropzone from "../components/UploadDropzone.tsx";
import PipelineVisualizer from "../components/PipelineVisualizer.tsx";
import DecisionCard from "../components/DecisionCard.tsx";
import { useAnalyzePdf } from "../hooks/useAnalyze.ts";
import type { TrustScoredDecision } from "../types/api.ts";

export default function Analyze() {
  const [decision, setDecision] = useState<TrustScoredDecision | null>(null);
  const { mutateAsync, isPending } = useAnalyzePdf();

  const handleFile = async (file: File) => {
    const result = await mutateAsync(file);
    setDecision(result);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900">Analyze Payroll</h1>
      <UploadDropzone onFile={handleFile} label="Drop WH-347 PDF here" />
      {isPending && <PipelineVisualizer />}
      {decision && <DecisionCard decision={decision} />}
    </div>
  );
}
