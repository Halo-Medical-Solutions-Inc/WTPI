"""Add server default to is_reviewed column

Revision ID: 003_fix_is_reviewed_default
Revises: 002_add_extraction_fields
Create Date: 2026-01-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003_fix_is_reviewed_default"
down_revision: Union[str, None] = "002_add_extraction_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "calls",
        "is_reviewed",
        server_default=sa.text("false"),
    )


def downgrade() -> None:
    op.alter_column(
        "calls",
        "is_reviewed",
        server_default=None,
    )
