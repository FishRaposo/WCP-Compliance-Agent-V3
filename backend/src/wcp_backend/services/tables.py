"""Centralized SQLAlchemy table definitions.

All API modules that need direct table access should import from here
instead of defining their own inline Table() objects. This ensures
schema consistency and avoids duplicate MetaData() instances.
"""

from __future__ import annotations

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    MetaData,
    Table,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PgUUID

metadata = MetaData()

decisions_table = Table(
    "decisions",
    metadata,
    Column("id", PgUUID(), primary_key=True, server_default=func.gen_random_uuid()),
    Column("job_id", Text(), nullable=False, unique=True),
    Column("verdict", Text(), nullable=False),
    Column("trust_score", Float(), nullable=False),
    Column("trust_band", Text(), nullable=False),
    Column("requires_human_review", Boolean(), nullable=False, server_default="false"),
    Column("violation_count", Integer(), nullable=False, server_default="0"),
    Column("warning_count", Integer(), nullable=False, server_default="0"),
    Column("reasoning_summary", Text(), nullable=True),
    Column("citations", JSONB(), nullable=True, server_default="[]"),
    Column("cost_usd", Float(), nullable=True),
    Column("latency_ms", Integer(), nullable=True),
    Column("phoenix_trace_id", Text(), nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)

jobs_table = Table(
    "jobs",
    metadata,
    Column("id", PgUUID(), primary_key=True, server_default=func.gen_random_uuid()),
    Column("job_id", Text(), nullable=False, unique=True),
    Column("celery_task_id", Text(), nullable=True),
    Column("status", Text(), nullable=False, server_default="pending"),
    Column("payload", JSONB(), nullable=True, server_default="{}"),
    Column("result", JSONB(), nullable=True),
    Column("error", Text(), nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)

users_table = Table(
    "users",
    metadata,
    Column("id", PgUUID(), primary_key=True, server_default=func.gen_random_uuid()),
    Column("email", Text(), nullable=False, unique=True),
    Column("password_hash", Text(), nullable=False),
    Column("role", Text(), nullable=False, server_default="analyst"),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)
