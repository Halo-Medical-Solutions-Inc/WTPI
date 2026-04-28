from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "011_add_number_to_calls"
down_revision: Union[str, None] = "010_add_call_comments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("calls", sa.Column("number", sa.String(50), nullable=True))
    op.create_index("ix_calls_number", "calls", ["number"])


def downgrade() -> None:
    op.drop_index("ix_calls_number", table_name="calls")
    op.drop_column("calls", "number")
