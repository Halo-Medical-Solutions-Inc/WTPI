from typing import Sequence, Union

revision: str = "007_add_doctors_and_schedule"
down_revision: Union[str, None] = "006_add_teams_to_practice"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
