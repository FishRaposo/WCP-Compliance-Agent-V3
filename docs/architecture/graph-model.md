# Entity Relationship / Graph Model

## Current: In-Memory (Python dataclasses)

The compliance graph is currently modeled as Python dataclasses in `backend/src/wcp_backend/models/graph.py`. Every decision traverses this graph: WCP submission → employees → compliance checks → LLM verdict → trust score.

```
WCPNode
│  job_id: str
│  contractor_name: str
│  project_name: str
│  week_ending: str
│
├─── EmployeeNode[]
│     name: str
│     trade: str
│     job_id: str (FK)
│
│     ├─── CheckNode[]
│     │     check_id: str
│     │     check_type: CheckType  (wage|overtime|fringe|signature|total)
│     │     status: CheckStatus    (passed|failed|warning)
│     │     regulation_cite: str   (e.g. "40 U.S.C. § 3142")
│
└─── VerdictNode
│     job_id: str
│     verdict: VerdictStatus  (approved|rejected|requires_review)
│     confidence: float
│
└─── TrustScoreNode
      job_id: str
      score: float        (0.0 – 1.0)
      band: TrustBand     (high|medium|low)
      requires_review: bool
```

---

## Relational Schema (PostgreSQL)

```sql
-- Decisions table (immutable after insert)
decisions
├── id            UUID PK
├── job_id        TEXT UNIQUE
├── verdict       TEXT
├── trust_score   FLOAT
├── trust_band    TEXT
├── requires_human_review BOOLEAN
├── violation_count INT
├── warning_count INT
├── reasoning_summary TEXT
├── citations     JSONB
├── cost_usd      FLOAT
├── latency_ms    INT
├── phoenix_trace_id TEXT
└── created_at    TIMESTAMPTZ

-- Audit events (append-only, 7-year retention)
audit_events
├── id            UUID PK
├── job_id        TEXT
├── event_type    TEXT  (extraction_complete|validation_complete|verdict_issued|...)
├── actor         TEXT
├── payload       JSONB
├── regulation_references TEXT[]
├── trace_id      TEXT
└── created_at    TIMESTAMPTZ

-- DBWD rates (upserted from SAM.gov)
dbwd_rates
├── id            UUID PK
├── trade         TEXT
├── locality      TEXT
├── rate          FLOAT
├── fringe        FLOAT
├── effective_date DATE
├── wage_determination_number TEXT
└── created_at    TIMESTAMPTZ

-- Regulation chunks (RAG knowledge base)
regulation_chunks
├── id            UUID PK
├── chunk_id      TEXT UNIQUE
├── text          TEXT
├── trade         TEXT
├── locality      TEXT
├── regulation_cite TEXT
├── embedding     vector(384)  -- pgvector
└── created_at    TIMESTAMPTZ

-- Jobs (Celery task tracking)
jobs
├── id            UUID PK
├── job_id        TEXT UNIQUE
├── celery_task_id TEXT
├── status        TEXT  (pending|processing|complete|failed)
├── payload       JSONB
├── result        JSONB
├── error         TEXT
├── created_at    TIMESTAMPTZ
└── updated_at    TIMESTAMPTZ
```

---

## Future: Neo4j Graph (V4+)

When cross-contract analytics (V4) arrive, the entity model maps directly to Neo4j nodes and relationships:

```
(:Contractor {name, ein})
    -[:SUBMITTED]->
(:WCP {job_id, week_ending, payroll_number})
    -[:EMPLOYED]->
(:Employee {name, trade})
    -[:SUBJECT_TO]->
(:ComplianceCheck {check_id, check_type, status, regulation_cite})
    -[:LED_TO]->
(:Verdict {verdict, confidence})
    -[:SCORED_AS]->
(:TrustScore {score, band})

(:DBWDRate {trade, locality, rate, effective_date})
    -[:APPLIES_TO]->
(:Employee)
```

**NetworkX (immediate, in-memory):**
The `ComplianceGraph` dataclass in `backend/src/wcp_backend/models/graph.py` is Neo4j-schema-compatible. For analytics queries that don't require persistence, `networkx.DiGraph` can be used directly before Neo4j is provisioned.

**Neo4j migration path:**
1. V3: Python dataclasses + PostgreSQL JSONB (current)
2. V4: Add Neo4j container to `docker-compose.yml`
3. V4: `py2neo` or `neo4j-driver` writes graph alongside PostgreSQL on each decision
4. V4: Cypher queries for cross-contract violation pattern detection

---

## V3_PLAN Reference

The V3_PLAN.md's success criteria include "100% of decisions have full traces" (Phoenix) and "7-year audit log retention" (PostgreSQL). These map to the `audit_events` table which is the persistence-layer representation of the compliance graph traversal.
