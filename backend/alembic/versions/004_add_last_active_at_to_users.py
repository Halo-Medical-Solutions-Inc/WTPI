"""Add last_active_at to users table

Revision ID: 004_add_last_active_at_to_users
Revises: 003_fix_is_reviewed_default
Create Date: 2026-01-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004_add_last_active_at_to_users"
down_revision: Union[str, None] = "003_fix_is_reviewed_default"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "last_active_at")
