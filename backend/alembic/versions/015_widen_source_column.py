from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "015_widen_source_column"
down_revision: Union[str, None] = "014_add_message_mentions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "comment_mentions",
        "source",
        existing_type=sa.String(20),
        type_=sa.String(40),
    )


def downgrade() -> None:
    op.alter_column(
        "comment_mentions",
        "source",
        existing_type=sa.String(40),
        type_=sa.String(20),
    )
