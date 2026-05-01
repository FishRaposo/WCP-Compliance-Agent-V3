"""006 — V4 data platform foundation.

Revision ID: 006
Revises: 005
Create Date: 2026-05-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "contracts",
        sa.Column("id", sa.Text(), primary_key=True, server_default=sa.text("gen_random_uuid()::text")),
        sa.Column("contract_number", sa.Text(), nullable=False, unique=True),
        sa.Column("project_name", sa.Text(), nullable=False),
        sa.Column("contractor_name", sa.Text(), nullable=False),
        sa.Column("contractor_ein", sa.Text(), nullable=True),
        sa.Column("agency", sa.Text(), nullable=True),
        sa.Column("locality", sa.Text(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("total_value", sa.Numeric(14, 2), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="active"),
        sa.Column("source", sa.Text(), nullable=False, server_default="manual"),
        sa.Column("source_reference", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_contracts_status", "contracts", ["status"])
    op.create_index("ix_contracts_contractor", "contracts", ["contractor_name"])
    op.create_index("ix_contracts_dates", "contracts", ["start_date", "end_date"])
    op.create_index("ix_contracts_locality", "contracts", ["locality"])
    op.create_index("ix_contracts_source", "contracts", ["source"])

    op.add_column("decisions", sa.Column("contract_id", sa.Text(), nullable=True))
    op.create_foreign_key("fk_decisions_contract", "decisions", "contracts", ["contract_id"], ["id"])
    op.create_index("ix_decisions_contract_id", "decisions", ["contract_id"])
    op.create_index("ix_decisions_contract_created", "decisions", ["contract_id", "created_at"])

    op.create_table(
        "ingestion_jobs",
        sa.Column("id", sa.Text(), primary_key=True, server_default=sa.text("gen_random_uuid()::text")),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("source_type", sa.Text(), nullable=False),
        sa.Column("source_reference", sa.Text(), nullable=True),
        sa.Column("contract_id", sa.Text(), sa.ForeignKey("contracts.id"), nullable=True),
        sa.Column("total_records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processed_records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_details", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_ingestion_status", "ingestion_jobs", ["status"])
    op.create_index("ix_ingestion_type", "ingestion_jobs", ["type"])
    op.create_index("ix_ingestion_contract", "ingestion_jobs", ["contract_id"])
    op.create_index("ix_ingestion_created", "ingestion_jobs", ["created_at"])

    op.execute(
        """
        CREATE TABLE payroll_records (
            id UUID NOT NULL DEFAULT gen_random_uuid(),
            contract_id TEXT NOT NULL REFERENCES contracts(id),
            employee_name TEXT NOT NULL,
            employee_id_hash TEXT,
            trade_code TEXT NOT NULL,
            locality_code TEXT NOT NULL,
            week_ending DATE NOT NULL,
            hours_monday NUMERIC(4,1),
            hours_tuesday NUMERIC(4,1),
            hours_wednesday NUMERIC(4,1),
            hours_thursday NUMERIC(4,1),
            hours_friday NUMERIC(4,1),
            hours_saturday NUMERIC(4,1),
            hours_sunday NUMERIC(4,1),
            total_hours NUMERIC(5,1) NOT NULL,
            hourly_rate NUMERIC(8,2) NOT NULL,
            gross_pay NUMERIC(10,2) NOT NULL,
            fringe_rate NUMERIC(8,2),
            fringe_total NUMERIC(10,2),
            overtime_hours NUMERIC(5,1) DEFAULT 0,
            overtime_pay NUMERIC(10,2) DEFAULT 0,
            decision_id TEXT REFERENCES decisions(job_id),
            source_file TEXT,
            ingestion_job_id TEXT REFERENCES ingestion_jobs(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (id, contract_id)
        ) PARTITION BY LIST (contract_id)
        """
    )
    op.create_index("ix_payroll_week_ending", "payroll_records", ["week_ending"])
    op.create_index("ix_payroll_trade", "payroll_records", ["trade_code"])
    op.create_index("ix_payroll_employee", "payroll_records", ["employee_name"])
    op.create_index("ix_payroll_decision", "payroll_records", ["decision_id"])
    op.create_index("ix_payroll_contract_week", "payroll_records", ["contract_id", "week_ending"])

    op.create_table(
        "connector_configs",
        sa.Column("id", sa.Text(), primary_key=True, server_default=sa.text("gen_random_uuid()::text")),
        sa.Column("name", sa.Text(), nullable=False, unique=True),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("connection_config", postgresql.JSONB(), nullable=False),
        sa.Column("schedule_cron", sa.Text(), nullable=True),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sync_status", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("metadata", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_connector_type", "connector_configs", ["type"])
    op.create_index("ix_connector_active", "connector_configs", ["is_active"])


def downgrade() -> None:
    op.drop_index("ix_connector_active", table_name="connector_configs")
    op.drop_index("ix_connector_type", table_name="connector_configs")
    op.drop_table("connector_configs")
    op.drop_index("ix_payroll_contract_week", table_name="payroll_records")
    op.drop_index("ix_payroll_decision", table_name="payroll_records")
    op.drop_index("ix_payroll_employee", table_name="payroll_records")
    op.drop_index("ix_payroll_trade", table_name="payroll_records")
    op.drop_index("ix_payroll_week_ending", table_name="payroll_records")
    op.execute("DROP TABLE IF EXISTS payroll_records")
    op.drop_index("ix_ingestion_created", table_name="ingestion_jobs")
    op.drop_index("ix_ingestion_contract", table_name="ingestion_jobs")
    op.drop_index("ix_ingestion_type", table_name="ingestion_jobs")
    op.drop_index("ix_ingestion_status", table_name="ingestion_jobs")
    op.drop_table("ingestion_jobs")
    op.drop_index("ix_decisions_contract_created", table_name="decisions")
    op.drop_index("ix_decisions_contract_id", table_name="decisions")
    op.drop_constraint("fk_decisions_contract", "decisions", type_="foreignkey")
    op.drop_column("decisions", "contract_id")
    op.drop_index("ix_contracts_source", table_name="contracts")
    op.drop_index("ix_contracts_locality", table_name="contracts")
    op.drop_index("ix_contracts_dates", table_name="contracts")
    op.drop_index("ix_contracts_contractor", table_name="contracts")
    op.drop_index("ix_contracts_status", table_name="contracts")
    op.drop_table("contracts")
