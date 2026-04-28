"""Add display_data fields to calls table

Revision ID: 005_add_display_data
Revises: 004_add_last_active_at_to_users
Create Date: 2026-02-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005_add_display_data"
down_revision: Union[str, None] = "004_add_last_active_at_to_users"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "calls",
        sa.Column("display_data_encrypted", sa.Text(), nullable=True),
    )
    op.add_column(
        "calls",
        sa.Column("display_data_kid", sa.String(length=50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("calls", "display_data_kid")
    op.drop_column("calls", "display_data_encrypted")
