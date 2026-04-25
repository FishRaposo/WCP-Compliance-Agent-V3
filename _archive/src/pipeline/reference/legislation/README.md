# Legislative and Regulatory References

This directory contains the full text and citations of all laws and regulations referenced by the WCP Compliance Agent.

## Purpose

- **Source of Truth**: Complete regulatory text for accurate compliance checking
- **Citation Accuracy**: Exact statute references for audit trails
- **Model Context**: Full regulatory text available for LLM reasoning

## Key Regulations

### Davis-Bacon Act and Related Acts

#### 40 U.S.C. § 3142 - Davis-Bacon Act
**Summary**: Requires payment of prevailing wages to laborers and mechanics on federal construction projects.

**Key Requirements**:
- Contractors must pay not less than prevailing wages
- Wage determinations issued by Department of Labor
- Weekly certified payroll submissions required

#### 40 U.S.C. § 3145 - Copeland Act
**Summary**: Requires contractors to submit weekly certified payroll records.

**Key Requirements**:
- Weekly payroll submissions
- Statement of compliance with wage requirements
- 7-year record retention

#### 40 U.S.C. § 3702 - Contract Work Hours and Safety Standards Act (CWHSSA)
**Summary**: Overtime requirements for federal construction contracts.

**Key Requirements**:
- Overtime pay (1.5x) for hours over 40 in a workweek
- Applies to laborers and mechanics

### Department of Labor Regulations

#### 29 CFR Part 5 - Labor Standards Provisions
**Summary**: Implementation regulations for Davis-Bacon and related acts.

**Key Subparts**:
- 29 CFR 5.5: Contract clauses and payroll requirements
- 29 CFR 5.22: Determination of prevailing wage rates

#### 29 CFR 5.5(a)(3) - Payroll Requirements
**Summary**: Specific requirements for weekly certified payroll submissions.

**Key Requirements**:
- Weekly submission of payrolls
- Must include: employee name, address, Social Security number, work classification, hours worked, wages paid, fringe benefits, deductions
- Must be certified as accurate and complete

## Usage in Pipeline

### Layer 1 (Deterministic)
- **Citations**: Used in check definitions for regulatory references
- **Rule Logic**: Hardcoded thresholds derived from regulatory requirements

### Layer 2 (LLM Verdict)
- **Context**: Full regulatory text provided in system prompt
- **Citation**: LLM must cite specific statutes in rationale

### Layer 3 (Trust Score)
- **Severity Mapping**: Critical violations mapped to statutes with strict requirements

## Updates

When regulations change:
1. Update this directory with new regulatory text
2. Update Layer 1 check logic if thresholds change
3. Update Layer 2 system prompt with new citations
4. Update tests to reflect new requirements
5. Document change in CHANGELOG.md

## Sources

- [Department of Labor - Davis-Bacon and Related Acts](https://www.dol.gov/agencies/whd/government-contracts)
- [eCFR - 29 CFR Part 5](https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/part-5)
- [Government Publishing Office - U.S. Code Title 40](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title40-section3142)
