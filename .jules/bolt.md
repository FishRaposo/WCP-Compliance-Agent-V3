## 2024-05-01 - [Add Database Index for trust_band]
**Learning:** Filtering results by a specific attribute (like `trust_band`) and sorting by `created_at` can lead to inefficient sequential scans on large tables in PostgreSQL if a composite index is not present. This was observed with the `list_decisions` API endpoint, which is used by the frontend (e.g. `HumanReviewQueue`).
**Action:** Create a composite index `(trust_band, created_at DESC)` using Alembic to ensure the query utilizes an index scan instead of a sequential scan, improving read performance.
