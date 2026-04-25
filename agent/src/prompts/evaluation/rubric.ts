export interface EvalRubric {
  accuracy: { weight: number; description: string };
  citation_completeness: { weight: number; description: string };
  reasoning_clarity: { weight: number; description: string };
}

export const wcpVerdictRubric: EvalRubric = {
  accuracy: {
    weight: 0.5,
    description: "Does the verdict match the expected outcome for this payroll submission?",
  },
  citation_completeness: {
    weight: 0.3,
    description: "Are all relevant regulations cited? Are citations accurate?",
  },
  reasoning_clarity: {
    weight: 0.2,
    description: "Is the reasoning clear, specific, and legally defensible?",
  },
};
