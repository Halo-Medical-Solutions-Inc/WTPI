from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "006_add_teams_to_practice"
down_revision: Union[str, None] = "005_add_display_data"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "practice",
        sa.Column("teams", JSONB, nullable=False, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("practice", "teams")
