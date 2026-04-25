# DBWD Prevailing Wage Rates

**Status**: Phase 0-1 (Hardcoded for prototyping)
**Source**: Department of Labor Wage Determinations
**Last Updated**: 2026-04-19
**Phase 2 Target**: PostgreSQL + pgvector integration with full DBWD database

## Current Implementation

The following rates are hardcoded in the pipeline for prototyping purposes:
- `src/pipeline/layer1-deterministic.ts`
- `src/utils/mock-responses.ts`

### Rate Table

| Trade | Base Rate ($/hr) | Fringe Rate ($/hr) | Total Rate ($/hr) | DBWD ID |
|-------|------------------|--------------------|-------------------|---------|
| Electrician | 51.69 | 34.63 | 86.32 | DBWD-2024-06-01-ELEC |
| Laborer | 26.45 | 12.50 | 38.95 | DBWD-2024-06-01-LABR |
| Plumber | 48.50 | 32.00 | 80.50 | DBWD-2024-06-01-PLMB |
| Carpenter | 42.75 | 28.50 | 71.25 | DBWD-2024-06-01-CARP |
| Mason | 45.20 | 30.00 | 75.20 | DBWD-2024-06-01-MASN |

**Effective Date**: 2024-06-01
**Determination Type**: General Decision
**Geographic Scope**: Nationwide (simplified for prototyping)

## Rate Components

### Base Rate
- Hourly wage rate for the trade
- Includes basic hourly compensation
- Does not include fringe benefits

### Fringe Rate
- Hourly value of fringe benefits
- Includes health insurance, pension, training, etc.
- Can be paid as cash or bona fide benefits

### Total Rate
- Base Rate + Fringe Rate
- Total hourly compensation required
- Used for compliance verification

## Usage in Pipeline

### Layer 1 (Deterministic)
```typescript
// In layer1-deterministic.ts
const DBWD_RATES = {
  "Electrician": { base: 51.69, fringe: 34.63 },
  "Laborer": { base: 26.45, fringe: 12.50 },
  // ... other trades
};
```

### Check Logic
- **Base Wage Check**: `wage >= dbwdRate.base`
- **Fringe Check**: `fringe >= dbwdRate.fringe` (if applicable)
- **Total Rate**: Used for overall compliance assessment

## Limitations (Phase 0-1)

1. **Limited Trade Coverage**: Only 5 trades out of hundreds
2. **No Geographic Variation**: Single nationwide rate per trade
3. **No Wage Determination Types**: No distinction between general, project, or area determinations
4. **No Historical Rates**: No support for rate changes over time
5. **No Apprenticeship Rates**: No apprentice wage schedules

## Phase 2+ Implementation

### Database Schema
```sql
CREATE TABLE dbwd_rates (
  id SERIAL PRIMARY KEY,
  dbwd_id VARCHAR(50) UNIQUE NOT NULL,
  trade VARCHAR(100) NOT NULL,
  base_rate DECIMAL(10,2) NOT NULL,
  fringe_rate DECIMAL(10,2) NOT NULL,
  total_rate DECIMAL(10,2) GENERATED ALWAYS AS (base_rate + fringe_rate) STORED,
  effective_date DATE NOT NULL,
  expiration_date DATE,
  determination_type VARCHAR(50),
  geographic_area VARCHAR(100),
  county VARCHAR(100),
  state VARCHAR(2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dbwd_rates_trade ON dbwd_rates(trade);
CREATE INDEX idx_dbwd_rates_effective_date ON dbwd_rates(effective_date);
CREATE INDEX idx_dbwd_rates_geographic ON dbwd_rates(state, county);
```

### Full DBWD Integration
- Import official DBWD determinations from DOL
- Support all trades and geographic variations
- Track rate changes over time
- Support apprenticeship wage schedules
- Vector search for rate determination lookup

## Sources

- [Department of Labor - Wage Determinations Online](https://www.dol.gov/agencies/whd/government-contracts/wagedec)
- [SAM.gov - Wage Determinations](https://sam.gov/search/?index=wd&sort=-modifiedDate&page=1)

## Updates

When updating DBWD rates:
1. Obtain new determination from DOL
2. Update this file with new rates
3. Update hardcoded values in layer1-deterministic.ts and mock-responses.ts
4. Update tests that reference these rates
5. Document effective date and source
6. Commit with clear message: "Update DBWD rates to [date] determination"
