import { useState, useRef, useCallback } from "react";
import UploadDropzone from "../components/UploadDropzone.tsx";
import PipelineVisualizer from "../components/PipelineVisualizer.tsx";
import DecisionCard from "../components/DecisionCard.tsx";
import { useAnalyze, useAnalyzePdf } from "../hooks/useAnalyze.ts";
import type { TrustScoredDecision, PipelineStep } from "../types/api.ts";
import { Card, CardContent } from "@/components/ui/card";

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
  const pdfMutation = useAnalyzePdf();
  const textMutation = useAnalyze();
  const isPending = pdfMutation.isPending || textMutation.isPending;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    setStepIndex((prev) => {
      if (prev >= STEP_LABELS.length - 1) {
        clearTimer();
        return STEP_LABELS.length;
      }
      return prev + 1;
    });
  }, [clearTimer]);

  const startProgress = useCallback(() => {
    setStepIndex(0);
    clearTimer();
    timerRef.current = setInterval(tick, 600);
  }, [clearTimer, tick]);

  const runAnalysis = async (fn: () => Promise<TrustScoredDecision>) => {
    setError(null);
    setDecision(null);
    startProgress();
    try {
      const result = await fn();
      clearTimer();
      setStepIndex(STEP_LABELS.length);
      setDecision(result);
    } catch (err) {
      clearTimer();
      setStepIndex(-1);
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
    }
  };

  const handleFile = (file: File) => runAnalysis(() => pdfMutation.mutateAsync(file));
  const handleText = (text: string) => runAnalysis(() => textMutation.mutateAsync(text));

  const steps = stepIndex >= 0 ? buildSteps(Math.min(stepIndex, STEP_LABELS.length - 1)) : undefined;
  const showDone = stepIndex >= STEP_LABELS.length;
  const pipelineSteps = showDone
    ? STEP_LABELS.map((label) => ({ label, status: "done" as const }))
    : steps;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900">Analyze Payroll</h1>
      <UploadDropzone
        onFile={handleFile}
        onTextSubmit={handleText}
        label="Drop WH-347 PDF here"
        disabled={isPending}
      />
      {(isPending || showDone) && <PipelineVisualizer steps={pipelineSteps} />}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-700 font-medium">Error</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </CardContent>
        </Card>
      )}
      {decision && <DecisionCard decision={decision} />}
    </div>
  );
}
