# Phase 1 — Backend Core: Deterministic Pipeline

**Goal:** Implement every Python function that currently raises `NotImplementedError` in the pipeline layer. Zero external services — pure Python logic that can be tested in isolation.

---

## Exit Criteria (Hard Gate)

```bash
cd backend
poetry run pytest tests/unit tests/integration -v  # must pass 100+ tests, 0 failures
```

**Current status: 103 tests passing (83 unit + 20 integration).**

**Do not proceed to Phase 2 until this command exits with 0.**

---

## Goals

1. Port V2 extraction patterns → `extraction.py`
2. Port in-memory DBWD corpus → `dbwd_lookup.py`
3. Implement all 5 check functions → `checks/*.py`
4. Implement rule engine + trust score → `rules.py`
5. Implement 4 API endpoints (no DB) → `api/*.py`
6. Write 50+ unit tests → `tests/unit/*.py`
7. Write integration tests for API endpoints → `tests/integration/*.py`

---

## Task Breakdown

### 1.1 — Extraction Patterns

**Source:** `_archive/src/pipeline/layer1-deterministic.ts` → `extractWCPData()`, `resolveClassification()`
**Destination:** `backend/src/wcp_backend/pipeline/extraction.py`

**Implement `extract_from_text(text: str) -> ExtractedWCP`:**

Parse plain text WH-347 representation using regex patterns:

| Field | Pattern Example | Regex Strategy |
|---|---|---|
| `trade_classification` | "Role: Electrician" or "Trade: ELEC" | `(?i)(?:role|trade|classification)[:\s]+([A-Za-z\s]+)` |
| `hours_worked` | "Hours: 40" or "40 hrs" | `(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)` |
| `overtime_hours` | "OT: 5" or "Overtime 5.0" | `(?i)(?:ot|overtime)[:\s]+(\d+(?:\.\d+)?)` |
| `hourly_wage` | "Wage: 51.69" or "$51.69/hr" | `\$?(\d+(?:\.\d+)?)\s*(?:/hr)?` |
| `fringe_benefits` | "Fringe: 34.63" or "Benefits 34.63" | `(?i)(?:fringe|benefits?)[:\s]+\$?(\d+(?:\.\d+)?)` |
| `gross_earnings` | "Gross: 2067.60" | `(?i)gross[:\s]+\$?(\d+(?:\.\d+)?)` |
| `deductions` | "Deductions: 150.00" | `(?i)deductions?[:\s]+\$?(\d+(?:\.\d+)?)` |
| `net_wages` | "Net: 1917.60" | `(?i)net[:\s]+\$?(\d+(?:\.\d+)?)` |
| `week_ending` | "Week Ending: 2026-01-15" | `(\d{4}-\d{2}-\d{2})` |
| `project_id` | "Project: ABC-123" | `(?i)project[:\s]+([A-Z0-9-]+)` |
| `payroll_number` | "Payroll # 42" | `(?i)payroll[:\s#]*(\d+)` |
| `certification_date` | "Certified: 2026-01-16" | `(\d{4}-\d{2}-\d{2})` |

**Classification aliasing logic:**
- Load `IN_MEMORY_ALIASES` mapping (e.g., `{"ELEC": "Electrician", "electrical worker": "Electrician", "PLUM": "Plumber"}`)
- Normalize input: lowercase, strip punctuation
- Look up in aliases → return canonical name
- If not found, return original (fuzzy match is Phase 2)

**Implement `extract_from_pdf(pdf_bytes: bytes) -> ExtractedWCP`:**
- Use `pdfplumber.open(io.BytesIO(pdf_bytes))`
- Extract all tables: `[page.extract_table() for page in pdf.pages]`
- Concatenate cell values into a single string
- Call `extract_from_text()` on the result
- Handle `pdfplumber` exceptions gracefully → return empty `ExtractedWCP` with `job_id` generated from UUID

**V2 Archive Reference:**
```typescript
// _archive/src/pipeline/layer1-deterministic.ts lines 45-120
// extractWCPData() — main regex orchestrator
// resolveClassification() — aliasing logic
```

---

### 1.2 — DBWD In-Memory Corpus

**Source:** `_archive/data/dbwd-corpus.json`, `_archive/src/retrieval/hybrid-retriever.ts`
**Destination:** `backend/src/wcp_backend/pipeline/dbwd_lookup.py`

**Create `backend/src/wcp_backend/data/dbwd_corpus.json`:**
Copy the 20-trade corpus from V2 archive (Electrician, Plumber, Carpenter, etc. with base wage + fringe for Washington, DC).

**Implement in-memory lookup:**

```python
# Module-level cache loaded on first import
_IN_MEMORY_CORPUS: dict[str, DBWDRateRecord] = {}
_IN_MEMORY_ALIASES: dict[str, str] = {}

def _load_corpus() -> None:
    """Load corpus from bundled JSON. Called lazily on first lookup."""
    pass  # TODO: implement

def _normalize_trade(trade: str) -> str:
    """Lowercase, strip punctuation, apply aliases."""
    pass  # TODO: implement

def _levenshtein(a: str, b: str) -> int:
    """Edit distance for fuzzy fallback. Max distance: 3."""
    pass  # TODO: implement

async def get_dbwd_rate(trade: str, locality: str, effective_date: str) -> DBWDRateRecord:
    """
    In-memory lookup for Phase 1.
    
    1. Normalize trade via _normalize_trade()
    2. Look up in _IN_MEMORY_CORPUS
    3. If not found: try fuzzy match with Levenshtein (distance < 3)
    4. If still not found: raise ValueError(f"Trade not found: {trade}")
    
    Phase 2 adds: Redis → PostgreSQL → SAM.gov layers above this.
    """
    raise NotImplementedError
```

**V2 Archive Reference:**
```typescript
// _archive/src/retrieval/hybrid-retriever.ts lines 15-40
// IN_MEMORY_ALIASES mapping

// _archive/src/services/dbwd-retrieval.ts lines 80-110
// levenshtein() implementation
```

---

### 1.3 — Check Functions

**Source:** `_archive/src/pipeline/layer1-deterministic.ts` → each `check*()` function
**Destination:** `backend/src/wcp_backend/pipeline/checks/`

| Check | Logic | Regulation |
|---|---|---|
| `wage_check.py` | `pass` if `employee.hourly_wage >= dbwd_rate.rate`; variance = actual - expected | 40 U.S.C. § 3142 |
| `overtime_check.py` | `pass` if `overtime_hours == 0` or computed OT rate ≥ 1.5× base; warn if hours > 40 but no OT | 29 C.F.R. § 5.32 |
| `fringe_check.py` | `pass` if `employee.fringe_benefits >= dbwd_rate.fringe` | 40 U.S.C. § 3141(2)(B) |
| `signature_check.py` | `pass` if `certification_date` present and not future-dated | 29 C.F.R. § 5.5(a)(3)(ii)(B) |
| `total_check.py` | `pass` if `gross ≈ (hours × wage) + (ot × wage × 0.5)` within $0.01; verify `net = gross - deductions` | 29 C.F.R. § 5.5(a)(3)(i) |

**Each check function must return:**
```python
ComplianceCheck(
    check_id=f"{check_type}_{employee.name.lower().replace(' ', '_')}",
    check_type=CheckType.WAGE,  # or OVERTIME, FRINGE, SIGNATURE, TOTAL
    employee_name=employee.name,
    status=CheckStatus.PASS,  # or FAIL, WARNING
    expected_value=dbwd_rate.rate,
    actual_value=employee.hourly_wage,
    variance=employee.hourly_wage - dbwd_rate.rate,
    regulation_cite="40 U.S.C. § 3142",  # exact string
    message="Wage meets DBWD minimum" if pass else f"Wage violation: {variance:.2f} below minimum"
)
```

**V2 Archive Reference:**
```typescript
// _archive/src/pipeline/layer1-deterministic.ts
// checkPrevailingWage() — lines 150-180
// checkOvertimeCompliance() — lines 190-220
// checkFringeBenefits() — lines 230-260
// checkSignature() — lines 270-290
// checkTotalHours() — lines 300-330
```

---

### 1.4 — Rule Engine + Trust Score

**Destination:** `backend/src/wcp_backend/pipeline/rules.py`

**Implement `run_rule_engine(extracted: ExtractedWCP) -> DeterministicReport`:**

```python
async def run_rule_engine(extracted: ExtractedWCP) -> DeterministicReport:
    checks: list[ComplianceCheck] = []
    dbwd_rates: list[DBWDRateRecord] = []
    
    # Get unique trades
    trades = {e.trade_classification for e in extracted.employees}
    
    for trade in trades:
        rate = await get_dbwd_rate(trade, extracted.project.location, extracted.week_ending.isoformat())
        dbwd_rates.append(rate)
    
    # Run checks per employee
    for employee in extracted.employees:
        rate = next(r for r in dbwd_rates if r.trade == _normalize_trade(employee.trade_classification))
        checks.append(check_wage(employee, rate))
        checks.append(check_overtime(employee))
        checks.append(check_fringe(employee, rate))
        checks.append(check_totals(employee))
    
    # Signature check (once per WCP, not per employee)
    checks.append(check_signature(extracted))
    
    # Data integrity and minimum wage sanity checks (inline in rules.py)
    # ... implement as helper functions
    
    violation_count = sum(1 for c in checks if c.status == CheckStatus.FAIL)
    warning_count = sum(1 for c in checks if c.status == CheckStatus.WARNING)
    overall_status = OverallStatus.PASS if violation_count == 0 else OverallStatus.FAIL
    
    return DeterministicReport(
        job_id=extracted.job_id,
        checks=checks,
        overall_status=overall_status,
        violation_count=violation_count,
        warning_count=warning_count,
        dbwd_rates_used=dbwd_rates
    )
```

**Implement trust score components (port from V2 exactly):**

```python
def compute_trust_components(
    deterministic: DeterministicReport,
    llm_verdict: LLMVerdict
) -> dict[str, float]:
    """
    Calibrated weights from V2. Do not adjust without regression testing.
    """
    # Deterministic component: 35% weight
    violation_ratio = deterministic.violation_count / max(len(deterministic.checks), 1)
    deterministic_score = 1.0 - violation_ratio
    
    # Classification component: 25% weight (confidence in trade classification)
    # Phase 1: hardcode 0.95 (classification was resolved)
    classification_score = 0.95
    
    # LLM self-confidence: 20% weight
    llm_score = llm_verdict.confidence
    
    # Agreement: 20% weight (LLM verdict aligns with deterministic findings)
    agreement_score = _compute_agreement(deterministic, llm_verdict)
    
    return {
        "deterministic": 0.35 * deterministic_score,
        "classification": 0.25 * classification_score,
        "llm_self": 0.20 * llm_score,
        "agreement": 0.20 * agreement_score
    }

def compute_trust_score(components: dict[str, float]) -> float:
    return sum(components.values())

def determine_trust_band(score: float) -> TrustBand:
    if score >= 0.85:
        return TrustBand.AUTO_APPROVE
    elif score >= 0.60:
        return TrustBand.FLAG_FOR_REVIEW
    else:
        return TrustBand.REQUIRE_HUMAN_REVIEW

def _compute_agreement(deterministic: DeterministicReport, llm_verdict: LLMVerdict) -> float:
    """
    Critical check failed but LLM says Approved → 0.0 (major disagreement)
    All checks pass and LLM says Approved → 1.0
    Adjacent verdict (Reject vs Revise) → 0.5
    """
    has_violations = deterministic.violation_count > 0
    llm_approved = llm_verdict.verdict == VerdictStatus.APPROVED
    
    if has_violations and llm_approved:
        return 0.0
    elif not has_violations and llm_approved:
        return 1.0
    else:
        return 0.5
```

**V2 Archive Reference:**
```typescript
// _archive/src/pipeline/layer3-trust-score.ts lines 20-80
// computeTrustComponents() — weights 0.35/0.25/0.20/0.20
// computeAgreement() — alignment logic
// determineTrustBand() — threshold logic
```

---

### 1.5 — API Endpoints (No DB)

**Destination:** `backend/src/wcp_backend/api/`

**`extract.py`:**
```python
@router.post("", response_model=ExtractedWCP)
async def extract_wcp(
    text: str | None = Body(None),
    file: UploadFile | None = File(None)
) -> ExtractedWCP:
    if file:
        content = await file.read()
        return extract_from_pdf(content)
    elif text:
        return extract_from_text(text)
    else:
        raise HTTPException(400, "Provide 'text' or 'file'")
```

**`validate.py`:**
```python
@router.post("", response_model=DeterministicReport)
async def validate_wcp(extracted: ExtractedWCP) -> DeterministicReport:
    return await run_rule_engine(extracted)
```

**`dbwd.py`:**
```python
@router.get("/{trade}/{locality}/{date}", response_model=DBWDRateRecord)
async def get_dbwd(
    trade: str,
    locality: str,
    date: str  # ISO format YYYY-MM-DD
) -> DBWDRateRecord:
    try:
        return await get_dbwd_rate(trade, locality, date)
    except ValueError as e:
        raise HTTPException(404, str(e))
```

**`health.py`:** (already implemented, verify returns correct version)
```python
@router.get("")
async def health() -> dict:
    return {"status": "ok", "version": "3.0.2", "phase": 1}
```

---

### 1.6 — Unit Tests (Target: 50+)

**Destination:** `backend/tests/unit/`

**`test_extraction.py` (15 tests):**
- Test each regex pattern individually with valid inputs
- Test classification aliasing (ELEC → Electrician)
- Test `extract_from_text` with complete WH-347 string
- Test `extract_from_pdf` with mock pdfplumber (patch `pdfplumber.open`)

**`test_checks.py` (20 tests):**
- Each check: 2 tests (pass case, fail case)
- Wage check: verify variance calculation
- Overtime check: verify 1.5× rate logic
- Fringe check: verify fringe comparison
- Signature check: verify date validation
- Total check: verify arithmetic within tolerance

**`test_rules.py` (10 tests):**
- `run_rule_engine` with clean WCP → all checks pass
- `run_rule_engine` with wage violation → correct violation count
- Trust score calculation with known inputs → verify exact value
- Trust band determination at boundaries (0.84, 0.85, 0.59, 0.60)
- Agreement scoring (violation + approved = 0.0, etc.)

**`test_dbwd_lookup.py` (14 tests):**
- Lookup known trade → correct rate
- Lookup alias → resolves to canonical
- Lookup unknown trade with fuzzy match ("Electrian" → "Electrician")
- Lookup unknown trade, no fuzzy match → ValueError
- Verify in-memory corpus loaded on first call

**Integration Tests (20 tests):**

Added to verify HTTP layer and API contracts:

- `test_extract_endpoint.py` (5 tests): text extraction, PDF upload, error handling, trade aliasing
- `test_validate_endpoint.py` (5 tests): clean WCP, wage violation, fringe violation, unknown trade, missing certification
- `test_dbwd_endpoint.py` (6 tests): known trade, alias, fuzzy match, unknown trade, 404 handling
- `test_health_endpoint.py` (4 tests): health check, version format, phase indicator

**Total: 103 tests (83 unit + 20 integration)**

---

## Architecture Notes

### Phase 1 Constraint: Zero External Services
Every function must be testable with `pytest tests/unit` and zero Docker services running. No database, no Redis, no Elasticsearch, no OpenAI API calls.

### Trust Score Weights Are Calibrated
The 0.35/0.25/0.20/0.20 weights were tuned against V2's golden set. Do not adjust without a full regression test and a documented reason.

### In-Memory DBWD Is The Phase 1 Source of Truth
The cache-aside pattern (Redis → PostgreSQL → SAM.gov) is designed but only the in-memory fallback is implemented. This is intentional — it keeps Phase 1 self-contained.

### check_id Format Is A Cross-Service Contract
The format `{check_type}_{employee_name_slug}` is referenced by the LLM in `referencedCheckIds`. Changing it in Phase 1 requires updating the agent prompt in Phase 3.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| pdfplumber can't parse WH-347 tables | Medium | High | `extract_from_pdf` is optional for Phase 1. `extract_from_text` is the critical path. Test pdfplumber, but don't block on it. |
| V2 TypeScript float precision differs from Python | Medium | Medium | Use ±0.01 tolerance in total_check arithmetic, not exact equality. |
| Levenshtein fuzzy match false positives | Low | Medium | Require minimum 3-character match before fuzzy logic. Add blocklist for ambiguous short strings. |
| pytest discovers no tests | Low | High | Ensure `pytest.ini` has correct `testpaths = tests/unit` and `python_files = test_*.py`. |

---

## Command Reference

```bash
# Setup (one-time)
cd backend
poetry install

# Run all tests (unit + integration)
poetry run pytest tests/unit tests/integration -v

# Run specific test file
poetry run pytest tests/unit/test_extraction.py -v
poetry run pytest tests/integration/test_validate_endpoint.py -v

# Run with coverage
poetry run pytest tests/unit tests/integration --cov=wcp_backend --cov-report=term-missing

# Benchmark performance
poetry run pytest tests/unit/test_checks.py --benchmark-only

# Type checking
poetry run mypy src/wcp_backend/

# Linting
poetry run ruff check src/wcp_backend tests

# Quick verification script
poetry run python scripts/quick_verify.py
```

---

*Phase 1 document version: 2026-04-22*
*Estimated effort: 2-3 focused sessions*
*Blocked by: Nothing — this is the first phase*
