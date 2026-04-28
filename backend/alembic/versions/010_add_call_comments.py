from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "010_add_call_comments"
down_revision: Union[str, None] = "009_add_flagged_to_calls"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "call_comments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("call_id", UUID(as_uuid=True), sa.ForeignKey("calls.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    # Migrate existing notes to a comment (user_id will be null for legacy notes)
    op.execute("""
        INSERT INTO call_comments (id, call_id, user_id, content, created_at)
        SELECT gen_random_uuid(), id, NULL, notes, updated_at
        FROM calls
        WHERE notes IS NOT NULL AND notes != ''
    """)
    op.drop_column("calls", "notes")


def downgrade() -> None:
    op.add_column("calls", sa.Column("notes", sa.Text(), nullable=True))
    # Restore notes from most recent comment per call
    op.execute("""
        UPDATE calls c
        SET notes = (
            SELECT cc.content
            FROM call_comments cc
            WHERE cc.call_id = c.id
            ORDER BY cc.created_at DESC
            LIMIT 1
        )
    """)
    op.drop_table("call_comments")
