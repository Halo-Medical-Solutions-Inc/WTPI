from typing import Any, Dict

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import (
    get_client_ip,
    get_current_user,
    get_user_agent,
    require_admin,
)
from app.database.session import get_db
from app.models.audit_log import AuditAction, EntityType
from app.models.user import User
from app.schemas.practice import (
    PracticeResponse,
    PracticeUpdate,
    TeamCreate,
    TeamMembersUpdate,
    TeamUpdate,
)
from app.services import audit_service, practice_service, publisher_service
from app.utils.errors import AppError

router = APIRouter(prefix="/api/practice", tags=["practice"])


def _success(data: Any = None, message: str = "Success") -> Dict[str, Any]:
    return {"success": True, "data": data, "message": message}


async def _publish_practice_update(db: AsyncSession) -> None:
    practice = await practice_service.get_practice(db)
    if practice:
        practice_data = PracticeResponse.model_validate(practice).model_dump(
            mode="json"
        )
        await publisher_service.publish_event("practice_updated", practice_data)


@router.get("")
async def get_practice(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    practice = await practice_service.get_practice(db)
    if practice is None:
        raise AppError("Practice not configured", 404)
    return _success(PracticeResponse.model_validate(practice).model_dump())


@router.patch("")
async def update_practice(
    request: Request,
    body: PracticeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Dict[str, Any]:
    practice = await practice_service.update_practice(db, body)
    if practice is None:
        raise AppError("Practice not configured", 404)

    await audit_service.create_audit_log(
        db=db,
        entity_type=EntityType.PRACTICE,
        action=AuditAction.UPDATE,
        user_id=current_user.id,
        user_email=current_user.email,
        entity_id=practice.id,
        details="Updated practice settings",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    await _publish_practice_update(db)

    return _success(PracticeResponse.model_validate(practice).model_dump())


@router.get("/teams")
async def get_teams(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    teams = await practice_service.get_teams(db)
    return _success([t.model_dump() for t in teams])


@router.post("/teams")
async def add_team(
    request: Request,
    body: TeamCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Dict[str, Any]:
    team = await practice_service.add_team(db, body)
    if team is None:
        raise AppError("Practice not configured", 404)

    practice = await practice_service.get_practice(db)
    if practice:
        await audit_service.create_audit_log(
            db=db,
            entity_type=EntityType.PRACTICE,
            action=AuditAction.UPDATE,
            user_id=current_user.id,
            user_email=current_user.email,
            entity_id=practice.id,
            details=f"Added team: {body.title}",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
        )

    await _publish_practice_update(db)

    return _success(team.model_dump())


@router.patch("/teams/{team_id}")
async def update_team(
    request: Request,
    team_id: str,
    body: TeamUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Dict[str, Any]:
    team = await practice_service.update_team(db, team_id, body)
    if team is None:
        raise AppError("Team not found", 404)

    practice = await practice_service.get_practice(db)
    if practice:
        await audit_service.create_audit_log(
            db=db,
            entity_type=EntityType.PRACTICE,
            action=AuditAction.UPDATE,
            user_id=current_user.id,
            user_email=current_user.email,
            entity_id=practice.id,
            details=f"Updated team: {body.title}",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
        )

    await _publish_practice_update(db)

    return _success(team.model_dump())


@router.delete("/teams/{team_id}")
async def delete_team(
    request: Request,
    team_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Dict[str, Any]:
    deleted = await practice_service.delete_team(db, team_id)
    if not deleted:
        raise AppError("Team not found", 404)

    practice = await practice_service.get_practice(db)
    if practice:
        await audit_service.create_audit_log(
            db=db,
            entity_type=EntityType.PRACTICE,
            action=AuditAction.UPDATE,
            user_id=current_user.id,
            user_email=current_user.email,
            entity_id=practice.id,
            details=f"Deleted team: {team_id}",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
        )

    await _publish_practice_update(db)

    return _success(message="Team deleted")


@router.post("/teams/{team_id}/test-email")
async def test_team_email(
    team_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    raise AppError("Daily email summaries are currently disabled", 400)


@router.put("/teams/{team_id}/members")
async def set_team_members(
    request: Request,
    team_id: str,
    body: TeamMembersUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    team = await practice_service.set_team_members(db, team_id, body.members)
    if team is None:
        raise AppError("Team not found", 404)

    practice = await practice_service.get_practice(db)
    if practice:
        await audit_service.create_audit_log(
            db=db,
            entity_type=EntityType.PRACTICE,
            action=AuditAction.UPDATE,
            user_id=current_user.id,
            user_email=current_user.email,
            entity_id=practice.id,
            details=f"Updated members for team: {team.title}",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
        )

    await _publish_practice_update(db)

    return _success(team.model_dump())
