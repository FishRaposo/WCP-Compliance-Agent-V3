import { useState, useRef, useCallback } from "react";
import UploadDropzone from "../components/UploadDropzone.tsx";
import PipelineVisualizer from "../components/PipelineVisualizer.tsx";
import DecisionCard from "../components/DecisionCard.tsx";
import { useAnalyzePdf } from "../hooks/useAnalyze.ts";
import type { TrustScoredDecision, PipelineStep } from "../types/api.ts";

const STEP_LABELS = ["Extract", "Validate", "Verdict", "Trust Score", "Persist"];

function buildSteps(current: number): PipelineStep[] {
  return STEP_LABELS.map((label, i) => ({
    label,
    status: i < current ? "done" as const : i === current ? "running" as const : "pending" as const,
  }));
}

export default function Analyze() {
  const [decision, setDecision] = useState<TrustScoredDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { mutateAsync, isPending } = useAnalyzePdf();

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startProgress = useCallback(() => {
    setStepIndex(0);
    clearTimer();
    let idx = 0;
    timerRef.current = setInterval(() => {
      idx += 1;
      if (idx >= STEP_LABELS.length) {
        clearTimer();
        setStepIndex(STEP_LABELS.length);
        return;
      }
      setStepIndex(idx);
    }, 600);
  }, [clearTimer]);

  const handleFile = async (file: File) => {
    setError(null);
    setDecision(null);
    startProgress();

    try {
      const result = await mutateAsync(file);
      clearTimer();
      setStepIndex(STEP_LABELS.length);
      setDecision(result);
    } catch (err) {
      clearTimer();
      setStepIndex(-1);
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
    }
  };

  const steps = stepIndex >= 0 ? buildSteps(Math.min(stepIndex, STEP_LABELS.length - 1)) : undefined;
  const showDone = stepIndex >= STEP_LABELS.length;
  const pipelineSteps = showDone
    ? STEP_LABELS.map((label) => ({ label, status: "done" as const }))
    : steps;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900">Analyze Payroll</h1>
      <UploadDropzone onFile={handleFile} label="Drop WH-347 PDF here" />
      {isPending && <PipelineVisualizer steps={pipelineSteps} />}
      {error && (
        <div className="rounded-md bg-red-50 p-4 border border-red-200">
          <p className="text-sm text-red-700 font-medium">Error</p>
          <p className="text-sm text-red-600 mt-1">{error}</p>
        </div>
      )}
      {decision && <DecisionCard decision={decision} />}
    </div>
  );
}
