"""005 — Create users table for JWT authentication.

Revision ID: 005
Revises: 004
Create Date: 2026-04-26 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.Text(), nullable=False, unique=True),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False, server_default="analyst"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_users_email", "users", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index("idx_users_email", table_name="users")
    op.drop_table("users")
