from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "008_add_notes_to_calls"
down_revision: Union[str, None] = "007_add_doctors_and_schedule"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "calls",
        sa.Column("notes", sa.Text, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("calls", "notes")
