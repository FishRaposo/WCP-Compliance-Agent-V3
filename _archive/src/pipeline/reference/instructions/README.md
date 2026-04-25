# Agent Operating Instructions

This directory contains the operating instructions and prompts for the WCP Compliance Agent.

## Purpose

- **Clear Direction**: Explicit instructions for how the LLM should operate
- **Consistency**: Version-controlled prompts for reproducible behavior
- **Auditability**: Human-readable instructions for compliance verification

## Layer 2 LLM Verdict Instructions

### System Prompt

The Layer 2 LLM receives a system prompt that defines its role and constraints:

**Role**: You are a Davis-Bacon Act compliance expert reviewing Weekly Certified Payroll (WCP) submissions.

**Constraints**:
1. **DO NOT RECOMPUTE**: You must use the deterministic findings from Layer 1. Do not perform arithmetic, look up rates, or extract data yourself.
2. **CITE CHECKS**: Every claim in your verdict must reference a specific check ID from the Layer 1 report.
3. **REGULATORY BASIS**: Every decision must cite specific statutes (e.g., 40 U.S.C. § 3142, 29 CFR 5.5(a)(3)).
4. **CONSERVATIVE BIAS**: When uncertain, default to requiring human review rather than auto-approval.

**Output Format**:
```json
{
  "status": "Approved" | "Revise" | "Reject",
  "rationale": "Explanation citing check IDs and statutes",
  "referencedCheckIds": ["check_001", "check_002"],
  "citations": [
    {
      "statute": "40 U.S.C. § 3142",
      "description": "Prevailing wage requirements"
    }
  ],
  "selfConfidence": 0.0-1.0,
  "reasoningTrace": "Step-by-step reasoning",
  "tokenUsage": 0,
  "model": "model-name",
  "timestamp": "ISO-8601"
}
```

### Decision Logic

**Approved**: All checks pass, no compliance issues found
- Rationale: "All deterministic checks passed. WCP complies with [statutes]."

**Revise**: Minor compliance issues that can be corrected
- Examples: Missing information, calculation errors that can be fixed
- Rationale: "Check [ID] failed due to [issue]. Requires revision before approval."

**Reject**: Critical compliance violations
- Examples: Underpayment, unknown classification, zero hours with wages
- Rationale: "Critical check [ID] failed due to [statute violation]. Cannot be approved without correction."

### Confidence Scoring

- **0.9-1.0**: High confidence - clear compliance or clear violation
- **0.7-0.89**: Medium confidence - some ambiguity but decision is supportable
- **0.5-0.69**: Low confidence - significant ambiguity, recommend human review
- **< 0.5**: Very low confidence - should not auto-approve

## Layer 1 Deterministic Instructions

### Extraction Rules

**Role Classification**:
- Match against known trade names (case-insensitive)
- If no match, classification = "Unknown", confidence = 0.30

**Data Extraction**:
- Role: `role[:\s]+(\w+)` (case-insensitive)
- Hours: `hours[:\s]+(\d+(?:\.\d+)?)` (decimal allowed)
- Wage: `wage[:\s]+\$?(\d+(?:\.\d+)?)` (optional $, decimal allowed)
- Fringe: `fringe[:\s]+\$?(\d+(?:\.\d+)?)` (optional $, decimal allowed)

### Check Logic

**Classification Check**:
- Pass: Role matches known trade
- Fail: Role unknown
- Severity: critical
- Regulation: 29 CFR 5.5(a)(3)(i)

**Base Wage Check**:
- Pass: Wage >= DBWD base rate
- Fail: Wage < DBWD base rate
- Severity: critical
- Regulation: 40 U.S.C. § 3142

**Overtime Check**:
- Pass: Hours <= 40 OR overtime pay calculated correctly
- Fail: Hours > 40 without proper overtime calculation
- Severity: high
- Regulation: 40 U.S.C. § 3702

**Fringe Check**:
- Pass: Fringe >= DBWD fringe rate OR fringe not applicable
- Fail: Fringe < DBWD fringe rate when required
- Severity: medium
- Regulation: 29 CFR 5.5(a)(3)

## Layer 3 Trust Score Instructions

### Trust Band Determination

**Auto** (score >= 0.85):
- High confidence in all components
- No critical failures
- LLM and deterministic agreement high

**Flag for Review** (0.60 <= score < 0.85):
- Some uncertainty or disagreement
- No critical failures
- Requires human oversight but can proceed with caution

**Require Human** (score < 0.60):
- Critical failures present
- Low confidence across components
- Must not auto-approve

### Component Weights

- Deterministic score: 25%
- Classification confidence: 15%
- LLM self-confidence: 30%
- Agreement (LLM vs deterministic): 30%

## Usage in Pipeline

### Layer 2 LLM Verdict
- System prompt loaded from this directory
- Instructions incorporated into `buildLayer2Prompt()` function
- Fallback to conservative verdict on parse errors

### Layer 1 Deterministic
- Extraction rules implemented in `extractWCPTool`
- Check logic in `layer1Deterministic()` function

### Layer 3 Trust Score
- Thresholds defined in `values/` directory
- Band logic in `layer3TrustScore()` function

## Updating Instructions

When updating agent instructions:
1. Update the appropriate file in this directory
2. Update the code that loads these instructions
3. Test with sample inputs to verify behavior
4. Update tests to reflect new behavior
5. Document change in CHANGELOG.md

## Version Control

All instructions are version-controlled. Changes should:
- Be tested for impact on decision quality
- Include rationale for the change
- Update dependent code and tests
