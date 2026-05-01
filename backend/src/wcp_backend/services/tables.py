"""Centralized SQLAlchemy table definitions.

All API modules that need direct table access should import from here
instead of defining their own inline Table() objects. This ensures
schema consistency and avoids duplicate MetaData() instances.
"""

from __future__ import annotations

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    MetaData,
    Numeric,
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
    Column("contract_id", Text(), nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)

contracts_table = Table(
    "contracts",
    metadata,
    Column("id", Text(), primary_key=True, server_default=func.gen_random_uuid()),
    Column("contract_number", Text(), nullable=False, unique=True),
    Column("project_name", Text(), nullable=False),
    Column("contractor_name", Text(), nullable=False),
    Column("contractor_ein", Text(), nullable=True),
    Column("agency", Text(), nullable=True),
    Column("locality", Text(), nullable=False),
    Column("start_date", Date(), nullable=False),
    Column("end_date", Date(), nullable=True),
    Column("total_value", Numeric(14, 2), nullable=True),
    Column("status", Text(), nullable=False, server_default="active"),
    Column("source", Text(), nullable=False, server_default="manual"),
    Column("source_reference", Text(), nullable=True),
    Column("metadata", JSONB(), nullable=False, server_default="{}"),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)

ingestion_jobs_table = Table(
    "ingestion_jobs",
    metadata,
    Column("id", Text(), primary_key=True, server_default=func.gen_random_uuid()),
    Column("type", Text(), nullable=False),
    Column("status", Text(), nullable=False, server_default="pending"),
    Column("source_type", Text(), nullable=False),
    Column("source_reference", Text(), nullable=True),
    Column("contract_id", Text(), ForeignKey("contracts.id"), nullable=True),
    Column("total_records", Integer(), nullable=False, server_default="0"),
    Column("processed_records", Integer(), nullable=False, server_default="0"),
    Column("failed_records", Integer(), nullable=False, server_default="0"),
    Column("error_details", JSONB(), nullable=False, server_default="[]"),
    Column("started_at", DateTime(timezone=True), nullable=True),
    Column("completed_at", DateTime(timezone=True), nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)

payroll_records_table = Table(
    "payroll_records",
    metadata,
    Column("id", PgUUID(), primary_key=True, server_default=func.gen_random_uuid()),
    Column("contract_id", Text(), ForeignKey("contracts.id"), primary_key=True),
    Column("employee_name", Text(), nullable=False),
    Column("employee_id_hash", Text(), nullable=True),
    Column("trade_code", Text(), nullable=False),
    Column("locality_code", Text(), nullable=False),
    Column("week_ending", Date(), nullable=False),
    Column("hours_monday", Numeric(4, 1), nullable=True),
    Column("hours_tuesday", Numeric(4, 1), nullable=True),
    Column("hours_wednesday", Numeric(4, 1), nullable=True),
    Column("hours_thursday", Numeric(4, 1), nullable=True),
    Column("hours_friday", Numeric(4, 1), nullable=True),
    Column("hours_saturday", Numeric(4, 1), nullable=True),
    Column("hours_sunday", Numeric(4, 1), nullable=True),
    Column("total_hours", Numeric(5, 1), nullable=False),
    Column("hourly_rate", Numeric(8, 2), nullable=False),
    Column("gross_pay", Numeric(10, 2), nullable=False),
    Column("fringe_rate", Numeric(8, 2), nullable=True),
    Column("fringe_total", Numeric(10, 2), nullable=True),
    Column("overtime_hours", Numeric(5, 1), nullable=True, server_default="0"),
    Column("overtime_pay", Numeric(10, 2), nullable=True, server_default="0"),
    Column("decision_id", Text(), nullable=True),
    Column("source_file", Text(), nullable=True),
    Column("ingestion_job_id", Text(), ForeignKey("ingestion_jobs.id"), nullable=True),
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
