# Reference Values

This directory contains all reference values used by the WCP Compliance Agent pipeline.

## Purpose

- **Single Source of Truth**: All thresholds, rates, and constants in one place
- **Auditability**: Easy to verify values against official sources
- **Maintainability**: Update values in one location, propagate to pipeline

## DBWD Prevailing Wage Rates

### Current Implementation (Phase 0-1)
**Status**: Hardcoded for prototyping
**Location**: `src/pipeline/layer1-deterministic.ts` and `src/utils/mock-responses.ts`
**Trades**: 5 trades (Electrician, Laborer, Plumber, Carpenter, Mason)

### Phase 2+ Target
**Status**: PostgreSQL + pgvector integration
**Location**: Database table with full DBWD determinations
**Coverage**: All trades and geographic determinations

## Thresholds and Constants

### Trust Score Thresholds

| Threshold | Value | Purpose |
|-----------|-------|---------|
| `AUTO_APPROVE` | 0.85+ | Fully automated approval |
| `FLAG_FOR_REVIEW` | 0.60-0.84 | Flag for human review |
| `REQUIRE_HUMAN` | < 0.60 | Mandatory human review |

### Deterministic Score Weights

| Component | Weight | Description |
|-----------|--------|-------------|
| Passed Checks | 1.0 | Ratio of passed checks to total checks |
| Critical Failure Override | 0.0 | Any critical failure sets score to 0 |

### Classification Confidence Thresholds

| Range | Interpretation |
|-------|----------------|
| ≥ 0.90 | High confidence - trade clearly identified |
| 0.70-0.89 | Medium confidence - trade likely but ambiguous |
| < 0.70 | Low confidence - trade unknown or ambiguous |

### Overtime Thresholds

| Threshold | Value | Regulation |
|-----------|-------|------------|
| Standard Workweek | 40 hours | 40 U.S.C. § 3702 |
| Overtime Multiplier | 1.5x | 40 U.S.C. § 3702 |

## Severity Levels

| Severity | Description | Impact on Trust |
|----------|-------------|-----------------|
| `critical` | Violates core statutory requirement | Zeroes deterministic score, requires human review |
| `high` | Significant compliance gap | Major trust score penalty |
| `medium` | Minor compliance issue | Moderate trust score penalty |
| `low` | Informational/clarification needed | Minor trust score penalty |

## Check Types

| Check Type | Description | Regulation |
|------------|-------------|------------|
| `classification` | Worker classification validation | 29 CFR 5.5(a)(3)(i) |
| `base_wage` | Prevailing wage compliance | 40 U.S.C. § 3142 |
| `overtime` | Overtime calculation verification | 40 U.S.C. § 3702 |
| `fringe` | Fringe benefit compliance | 29 CFR 5.5(a)(3) |

## Usage in Pipeline

### Layer 1 (Deterministic)
- **DBWD Rates**: Used for wage comparison
- **Thresholds**: Used for check pass/fail determination
- **Severity**: Mapped to check results

### Layer 2 (LLM Verdict)
- **Context**: Thresholds provided for reasoning
- **Citation**: Check IDs reference specific check types

### Layer 3 (Trust Score)
- **Thresholds**: Used for trust band determination
- **Weights**: Used for component score calculation

## Updating Values

When updating reference values:
1. Update the appropriate file in this directory
2. Update the code that references these values
3. Add source citation and date of update
4. Update tests to reflect new values
5. Document change in CHANGELOG.md

## Sources

### DBWD Rates
- [Department of Labor - Wage Determinations](https://www.dol.gov/agencies/whd/government-contracts/wagedec)

### Thresholds
- Derived from regulatory requirements (see `legislation/` directory)
- Calibrated based on trust score evaluation (Phase 4)

## Version Control

All values are version-controlled. Changes should:
- Include source citation
- Be reviewed for accuracy
- Update dependent code and tests
