"""Add extraction fields to calls table

Revision ID: 002_add_extraction_fields
Revises: 001_initial_schema
Create Date: 2026-01-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002_add_extraction_fields"
down_revision: Union[str, None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    extraction_status_enum = sa.Enum(
        "PENDING",
        "IN_PROGRESS",
        "COMPLETED",
        "FAILED",
        "SKIPPED",
        name="extraction_status",
    )
    extraction_status_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "calls",
        sa.Column("extraction_data_encrypted", sa.Text(), nullable=True),
    )
    op.add_column(
        "calls",
        sa.Column("extraction_data_kid", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "calls",
        sa.Column(
            "extraction_status",
            extraction_status_enum,
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("calls", "extraction_status")
    op.drop_column("calls", "extraction_data_kid")
    op.drop_column("calls", "extraction_data_encrypted")

    sa.Enum(name="extraction_status").drop(op.get_bind(), checkfirst=True)
