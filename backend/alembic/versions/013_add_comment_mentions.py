from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "013_add_comment_mentions"
down_revision: Union[str, None] = "012_add_messaging"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "comment_mentions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("comment_id", UUID(as_uuid=True), sa.ForeignKey("call_comments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("call_id", UUID(as_uuid=True), sa.ForeignKey("calls.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mentioned_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_comment_mentions_user_unread", "comment_mentions", ["user_id", "is_read", "created_at"])
    op.create_index("ix_comment_mentions_call_id", "comment_mentions", ["call_id"])


def downgrade() -> None:
    op.drop_index("ix_comment_mentions_call_id", table_name="comment_mentions")
    op.drop_index("ix_comment_mentions_user_unread", table_name="comment_mentions")
    op.drop_table("comment_mentions")
