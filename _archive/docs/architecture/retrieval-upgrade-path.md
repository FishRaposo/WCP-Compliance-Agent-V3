# Retrieval Upgrade Path

> **Current state:** JSON file-based retrieval (zero infrastructure, PoC scope)
> **Target state:** PostgreSQL + pgvector with hybrid search (BM25 + vector + reranking)

---

## Why JSON Files for the PoC

This repository is a **portfolio showcase and proof of concept**, not a production platform. The JSON-based retrieval layer was chosen deliberately:

- **Zero infrastructure** — no database, no vector store, no search engine to configure
- **Compiles anywhere** — clone, `npm install`, `npm run build` — works on any machine
- **No new dependencies** — the project stays lean and focused on architecture, not DevOps
- **Pattern is real** — the JSON structure mirrors what a production database would hold, proving the data model is sound

The retrieval layer (`src/services/dbwd-retrieval.ts`) is designed as a **swappable module**. The interface is intentionally thin so that replacing JSON with SQL is a single-file change.

---

## Current Implementation: JSON File-Based

### Data Structure

```typescript
// data/dbwd-rates.json
{
  "metadata": {
    "source": "SAM.gov",
    "version": "2024-06-01",
    "totalTrades": 5,
    "totalAliases": 16
  },
  "trades": [
    {
      "trade": "Electrician",
      "dbwdId": "WD-2024-ELEC-0490",
      "baseRate": 51.69,
      "fringeRate": 34.63,
      "locality": "Metropolitan Area",
      "effectiveDate": "2024-06-01",
      "aliases": ["Wireman", "Electrical Worker", "Journeyman Electrician"]
    }
  ]
}
```

### Retrieval API

```typescript
// src/services/dbwd-retrieval.ts
export function lookupRate(trade: string, locality?: string): DBWDRateInfo | null;
export function fuzzyMatchTrade(input: string): string;
```

### How It Works

1. **Module init** loads `data/dbwd-rates.json` into memory
2. **Exact match:** `lookupRate("Electrician")` → `DBWDRateInfo`
3. **Alias match:** `fuzzyMatchTrade("Wireman")` → `"Electrician"` → `lookupRate`
4. **Levenshtein fallback:** for typos and partial matches
5. **No match:** returns `null` → classification falls back to `"Unknown"`

---

## Target Implementation: PostgreSQL + pgvector

For a production deployment, swap the JSON loader for a SQL-backed retriever.

### Schema

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pgvector;

-- Core rates table
CREATE TABLE dbwd_rates (
  dbwd_id        TEXT PRIMARY KEY,
  trade          TEXT NOT NULL,
  trade_code     TEXT NOT NULL,
  base_rate      NUMERIC(10,2) NOT NULL,
  fringe_rate    NUMERIC(10,2) NOT NULL,
  total_rate     NUMERIC(10,2) GENERATED ALWAYS AS (base_rate + fringe_rate) STORED,
  locality       TEXT NOT NULL,
  effective_date DATE NOT NULL,
  source         TEXT NOT NULL DEFAULT 'SAM.gov',
  description    TEXT,
  embedding      VECTOR(384)
);

-- Indexes
CREATE INDEX idx_dbwd_embedding ON dbwd_rates
  USING ivfflat (embedding vector_cosine_ops);

CREATE INDEX idx_dbwd_trade_gin ON dbwd_rates
  USING gin (to_tsvector('english', trade || ' ' || COALESCE(description, '')));

CREATE INDEX idx_dbwd_locality ON dbwd_rates(locality, effective_date);
```

### Hybrid Search Query

```sql
WITH bm25 AS (
  SELECT
    dbwd_id,
    trade,
    base_rate,
    fringe_rate,
    ts_rank(
      to_tsvector('english', trade || ' ' || COALESCE(description, '')),
      plainto_tsquery('english', $1)
    ) AS bm25_score
  FROM dbwd_rates
  WHERE to_tsvector('english', trade || ' ' || COALESCE(description, ''))
        @@ plainto_tsquery('english', $1)
    AND locality = COALESCE($2, locality)
    AND effective_date <= CURRENT_DATE
  ORDER BY bm25_score DESC
  LIMIT 20
),
vector AS (
  SELECT
    dbwd_id,
    trade,
    1 - (embedding <=> $3::vector) AS vector_score
  FROM dbwd_rates
  WHERE locality = COALESCE($2, locality)
    AND effective_date <= CURRENT_DATE
  ORDER BY embedding <=> $3::vector
  LIMIT 20
)
SELECT
  COALESCE(bm25.dbwd_id, vector.dbwd_id) AS dbwd_id,
  COALESCE(bm25.trade, vector.trade) AS trade,
  COALESCE(bm25.bm25_score, 0) * 0.4
    + COALESCE(vector.vector_score, 0) * 0.6 AS hybrid_score
FROM bm25
FULL OUTER JOIN vector USING (dbwd_id)
ORDER BY hybrid_score DESC
LIMIT 5;
```

### Reranking (Cross-Encoder)

For top-5 hybrid results, run a cross-encoder reranker (e.g., `sentence-transformers/ms-marco-MiniLM-L-6-v2`) to produce final ranking. This is the same pattern used by modern RAG systems (LangChain, LlamaIndex).

---

## Migration Path

### Step 1: Swap the Loader

Replace the JSON init block in `src/services/dbwd-retrieval.ts`:

```typescript
// BEFORE (JSON)
const raw = readFileSync(resolve(process.cwd(), "data/dbwd-rates.json"), "utf-8");
const corpus = JSON.parse(raw);

// AFTER (PostgreSQL)
import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const rows = await pool.query("SELECT * FROM dbwd_rates WHERE locality = $1", [locality]);
```

### Step 2: Add Hybrid Search

Replace `lookupRate()` with a function that runs the hybrid SQL query above.

### Step 3: Add Embeddings

Generate trade embeddings via OpenAI (`text-embedding-3-small`) or a local model, store in `dbwd_rates.embedding`, and use vector search.

### Step 4: Add Cross-Encoder Reranking

Run a lightweight model on the top-5 hybrid results for final ranking.

---

## What This Proves

The JSON-based PoC demonstrates that:

1. **Data model is sound** — the schema (trade, aliases, rates, locality, effective date) maps cleanly to a relational model
2. **Retrieval interface is thin** — `lookupRate()` and `fuzzyMatchTrade()` are the only touchpoints; swapping the backend is trivial
3. **Fuzzy matching works** — Levenshtein distance proves the concept; production just swaps for BM25+vector
4. **No architectural lock-in** — the decision pipeline doesn't care where rates come from

This is **engineering arbitrage** — zero infrastructure for the showcase, production-ready architecture for the future.
