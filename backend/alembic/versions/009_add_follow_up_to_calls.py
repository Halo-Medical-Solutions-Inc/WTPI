from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "009_add_flagged_to_calls"
down_revision: Union[str, None] = "008_add_notes_to_calls"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "calls",
        sa.Column(
            "is_flagged",
            sa.Boolean,
            nullable=False,
            server_default="false",
        ),
    )
    op.add_column(
        "calls",
        sa.Column(
            "flagged_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", name="fk_calls_flagged_by_users"),
            nullable=True,
        ),
    )
    op.add_column(
        "calls",
        sa.Column("flagged_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute("ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'flag_toggle'")


def downgrade() -> None:
    op.drop_column("calls", "flagged_at")
    op.drop_column("calls", "flagged_by")
    op.drop_column("calls", "is_flagged")
