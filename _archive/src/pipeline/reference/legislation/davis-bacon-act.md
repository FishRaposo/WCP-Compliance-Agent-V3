# 40 U.S.C. § 3142 - Davis-Bacon Act

**Full Title**: An Act to Amend the Act entitled "An Act to provide for the construction and completion of public buildings, and for other purposes"

**Enacted**: 1931
**Last Amended**: Various amendments, most recent in 2023
**Citation**: 40 U.S.C. § 3142

## Full Text (Excerpt - Relevant Sections)

### Prevailing Wage Requirements

(a) The advertised specifications for every contract in excess of $2,000 to which the United States or the District of Columbia is a party, for construction, alteration, or repair, including painting and decorating, of public buildings or public works, and every contract in excess of $2,000 which is directly assisted by the Federal Government or the District of Columbia, shall contain a provision stating the minimum wages to be paid various classes of laborers and mechanics which shall be based upon the wages that will be paid for similar projects in the area as determined by the Secretary of Labor.

### Wage Determinations

(b) The Secretary of Labor shall determine, in accordance with prevailing rates for similar projects in the area, the minimum wages to be paid various classes of laborers and mechanics employed on the contract.

### Weekly Certified Payroll

(c) The contractor shall submit weekly a copy of all payrolls to the Federal agency contracting for or financing the construction project. The payrolls shall set out accurately and completely the following information for each laborer or mechanic:
- (1) Name, address, and Social Security number
- (2) Correct classification of the work performed
- (3) Hours worked each day
- (4) Hourly rate of pay
- (5) Daily and weekly gross pay
- (6) Deductions made
- (7) Net wages paid

### Compliance

(d) No contractor or subcontractor shall require any laborer or mechanic employed in the performance of the contract to work in surroundings or under working conditions which are unsanitary, hazardous, or dangerous to health and safety as determined under construction safety and health standards.

## Key Requirements for WCP Compliance

### 1. Prevailing Wage
- Contractors must pay not less than the prevailing wage rates
- Rates determined by Department of Labor
- Vary by trade and geographic area

### 2. Weekly Payroll Submission
- Must submit payrolls weekly
- Must include all required information
- Must be certified as accurate

### 3. Classification
- Workers must be correctly classified by trade
- Classification must match actual work performed
- Misclassification is a violation

### 4. Record Retention
- Payroll records must be retained for 3 years after contract completion
- Records must be available for inspection

## Usage in Pipeline

### Layer 1 (Deterministic)
- **Base Wage Check**: Validates wage >= DBWD prevailing rate
- **Classification Check**: Validates trade classification
- **Citation**: 40 U.S.C. § 3142(a)

### Layer 2 (LLM Verdict)
- **Context**: Full statutory text provided in system prompt
- **Citation**: LLM must cite 40 U.S.C. § 3142 in wage violation rationales

### Layer 3 (Trust Score)
- **Severity**: Wage violations marked as critical (zeroes deterministic score)
- **Rationale**: Direct statutory violation

## Related Statutes

- **40 U.S.C. § 3145** (Copeland Act): Weekly payroll certification requirements
- **40 U.S.C. § 3702** (CWHSSA): Overtime requirements
- **29 CFR Part 5**: DOL implementation regulations

## Sources

- [U.S. Code - Title 40, Chapter 31, Subchapter III, § 3142](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title40-section3142)
- [Department of Labor - Davis-Bacon and Related Acts](https://www.dol.gov/agencies/whd/government-contracts)
