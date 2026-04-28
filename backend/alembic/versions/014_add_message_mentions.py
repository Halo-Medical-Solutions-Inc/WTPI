from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "014_add_message_mentions"
down_revision: Union[str, None] = "013_add_comment_mentions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("comment_mentions", sa.Column("message_id", UUID(as_uuid=True), sa.ForeignKey("messages.id", ondelete="CASCADE"), nullable=True))
    op.add_column("comment_mentions", sa.Column("conversation_id", UUID(as_uuid=True), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=True))
    op.add_column("comment_mentions", sa.Column("source", sa.String(20), nullable=False, server_default="call_comment"))
    op.alter_column("comment_mentions", "comment_id", existing_type=UUID(as_uuid=True), nullable=True)
    op.alter_column("comment_mentions", "call_id", existing_type=UUID(as_uuid=True), nullable=True)
    op.create_index("ix_comment_mentions_source", "comment_mentions", ["source"])
    op.create_index("ix_comment_mentions_conversation_id", "comment_mentions", ["conversation_id"])


def downgrade() -> None:
    op.drop_index("ix_comment_mentions_conversation_id", table_name="comment_mentions")
    op.drop_index("ix_comment_mentions_source", table_name="comment_mentions")
    op.drop_column("comment_mentions", "source")
    op.drop_column("comment_mentions", "conversation_id")
    op.drop_column("comment_mentions", "message_id")
    op.alter_column("comment_mentions", "call_id", existing_type=UUID(as_uuid=True), nullable=False)
    op.alter_column("comment_mentions", "comment_id", existing_type=UUID(as_uuid=True), nullable=False)
