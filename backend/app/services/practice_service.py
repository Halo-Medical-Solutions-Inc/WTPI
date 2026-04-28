import uuid
from typing import List, Optional, Tuple

from sqlalchemy import cast, select, update
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.practice import Practice
from app.schemas.practice import (
    PracticeUpdate,
    Team,
    TeamCreate,
    TeamUpdate,
)


async def get_practice(db: AsyncSession) -> Optional[Practice]:
    query = select(Practice).limit(1)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def update_practice(
    db: AsyncSession, data: PracticeUpdate
) -> Optional[Practice]:
    practice = await get_practice(db)
    if practice is None:
        return None
    if data.practice_name is not None:
        practice.practice_name = data.practice_name
    if data.practice_region is not None:
        practice.practice_region = data.practice_region
    if data.priority_config is not None:
        practice.priority_config = data.priority_config.model_dump()
    await db.commit()
    await db.refresh(practice)
    return practice


async def try_allocate_concurrency(
    db: AsyncSession, call_id: uuid.UUID
) -> Tuple[bool, int]:
    practice = await get_practice(db)
    if practice is None:
        return False, 0

    current_count = len(practice.active_call_ids)
    if current_count >= practice.max_concurrent_calls:
        return False, current_count + 1

    new_call_array = cast([call_id], ARRAY(UUID(as_uuid=True)))
    query = (
        update(Practice)
        .where(Practice.id == practice.id)
        .values(active_call_ids=Practice.active_call_ids + new_call_array)
    )
    await db.execute(query)
    await db.commit()
    return True, 0


async def release_concurrency(db: AsyncSession, call_id: uuid.UUID) -> None:
    practice = await get_practice(db)
    if practice is None:
        return

    new_ids = [cid for cid in practice.active_call_ids if cid != call_id]
    query = (
        update(Practice)
        .where(Practice.id == practice.id)
        .values(active_call_ids=new_ids)
    )
    await db.execute(query)
    await db.commit()


async def get_queue_position(db: AsyncSession) -> int:
    practice = await get_practice(db)
    if practice is None:
        return 1
    current_count = len(practice.active_call_ids)
    if current_count < practice.max_concurrent_calls:
        return 0
    return current_count - practice.max_concurrent_calls + 1


async def get_teams(db: AsyncSession) -> List[Team]:
    practice = await get_practice(db)
    if practice is None:
        return []
    teams_data = practice.teams or {}
    teams_list = teams_data.get("teams", [])
    return [Team(**t) for t in teams_list]


async def add_team(db: AsyncSession, data: TeamCreate) -> Optional[Team]:
    practice = await get_practice(db)
    if practice is None:
        return None

    teams_data = practice.teams or {"teams": []}
    teams_list = teams_data.get("teams", [])

    new_team = {
        "id": str(uuid.uuid4()),
        "title": data.title,
        "description": data.description,
        "members": [],
    }
    teams_list.append(new_team)

    new_teams_data = {"teams": teams_list}
    query = (
        update(Practice)
        .where(Practice.id == practice.id)
        .values(teams=new_teams_data)
    )
    await db.execute(query)
    await db.commit()

    return Team(**new_team)


async def update_team(
    db: AsyncSession, team_id: str, data: TeamUpdate
) -> Optional[Team]:
    practice = await get_practice(db)
    if practice is None:
        return None

    teams_data = practice.teams or {"teams": []}
    teams_list = teams_data.get("teams", [])

    updated_team = None
    for team in teams_list:
        if team["id"] == team_id:
            team["title"] = data.title
            team["description"] = data.description
            updated_team = Team(**team)
            break

    if updated_team is None:
        return None

    new_teams_data = {"teams": teams_list}
    query = (
        update(Practice)
        .where(Practice.id == practice.id)
        .values(teams=new_teams_data)
    )
    await db.execute(query)
    await db.commit()

    return updated_team


async def delete_team(db: AsyncSession, team_id: str) -> bool:
    practice = await get_practice(db)
    if practice is None:
        return False

    teams_data = practice.teams or {"teams": []}
    teams_list = teams_data.get("teams", [])

    original_len = len(teams_list)
    teams_list = [t for t in teams_list if t["id"] != team_id]

    if len(teams_list) == original_len:
        return False

    new_teams_data = {"teams": teams_list}
    query = (
        update(Practice)
        .where(Practice.id == practice.id)
        .values(teams=new_teams_data)
    )
    await db.execute(query)
    await db.commit()

    return True


async def set_team_members(
    db: AsyncSession, team_id: str, members: List[str]
) -> Optional[Team]:
    practice = await get_practice(db)
    if practice is None:
        return None

    teams_data = practice.teams or {"teams": []}
    teams_list = teams_data.get("teams", [])

    updated_team = None
    for team in teams_list:
        if team["id"] == team_id:
            team["members"] = members
            updated_team = Team(**team)
            break

    if updated_team is None:
        return None

    new_teams_data = {"teams": teams_list}
    query = (
        update(Practice)
        .where(Practice.id == practice.id)
        .values(teams=new_teams_data)
    )
    await db.execute(query)
    await db.commit()

    return updated_team
