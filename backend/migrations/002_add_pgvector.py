"""002 — Add pgvector extension and regulation_chunks table."""

UPGRADE_SQL = """
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS regulation_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id TEXT NOT NULL UNIQUE,
    text TEXT NOT NULL,
    trade TEXT,
    locality TEXT,
    regulation_cite TEXT,
    wage_determination_number TEXT,
    embedding vector(384),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chunks_trade_locality ON regulation_chunks(trade, locality);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON regulation_chunks
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
"""

DOWNGRADE_SQL = """
DROP TABLE IF EXISTS regulation_chunks;
DROP EXTENSION IF EXISTS vector;
"""
