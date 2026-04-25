"""004 — Add indexes for time-series analytics queries."""

UPGRADE_SQL = """
-- Decision volume by day
CREATE INDEX IF NOT EXISTS idx_decisions_date_verdict
    ON decisions(DATE_TRUNC('day', created_at), verdict);

-- Violation rate by trade
CREATE TABLE IF NOT EXISTS dbwd_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade TEXT NOT NULL,
    locality TEXT NOT NULL,
    rate FLOAT NOT NULL,
    fringe FLOAT NOT NULL DEFAULT 0,
    effective_date DATE NOT NULL,
    wage_determination_number TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(trade, locality, effective_date)
);

CREATE INDEX IF NOT EXISTS idx_dbwd_trade_locality ON dbwd_rates(trade, locality);
CREATE INDEX IF NOT EXISTS idx_dbwd_effective_date ON dbwd_rates(effective_date DESC);
"""

DOWNGRADE_SQL = """
DROP TABLE IF EXISTS dbwd_rates;
DROP INDEX IF EXISTS idx_decisions_date_verdict;
"""
