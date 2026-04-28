from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "016_add_priority_config"
down_revision: Union[str, None] = "015_widen_source_column"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("practice", sa.Column("priority_config", JSONB, nullable=False, server_default="{}"))


def downgrade() -> None:
    op.drop_column("practice", "priority_config")
