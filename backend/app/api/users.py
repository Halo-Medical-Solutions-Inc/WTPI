import uuid
from typing import Any, Dict, List

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
from app.models.user import User, UserRole
from app.schemas.user import (
    ChangePasswordRequest,
    UserResponse,
    UserSettingsUpdate,
    UserUpdate,
)
from app.services import audit_service, publisher_service, user_service
from app.utils.errors import AppError

router = APIRouter(prefix="/api/users", tags=["users"])


def _success(data: Any = None, message: str = "Success") -> Dict[str, Any]:
    return {"success": True, "data": data, "message": message}


@router.get("")
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    users = await user_service.list_users(db)
    return _success([UserResponse.model_validate(u).model_dump() for u in users])


@router.get("/{user_id}")
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Dict[str, Any]:
    user = await user_service.get_user_by_id(db, user_id)
    if user is None:
        raise AppError("User not found", 404)
    return _success(UserResponse.model_validate(user).model_dump())


@router.patch("/me")
async def update_me(
    request: Request,
    body: UserSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    user = await user_service.update_own_settings(db, current_user.id, body)
    if user is None:
        raise AppError("User not found", 404)

    await audit_service.create_audit_log(
        db=db,
        entity_type=EntityType.USER,
        action=AuditAction.UPDATE,
        user_id=current_user.id,
        user_email=current_user.email,
        entity_id=current_user.id,
        details="Updated own settings",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    user_data = UserResponse.model_validate(user).model_dump(mode="json")
    await publisher_service.publish_event("user_updated", user_data)

    return _success(user_data)


@router.post("/me/change-password")
async def change_password(
    request: Request,
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    await user_service.change_password(
        db, current_user.id, body.current_password, body.new_password
    )

    await audit_service.create_audit_log(
        db=db,
        entity_type=EntityType.USER,
        action=AuditAction.PASSWORD_CHANGE,
        user_id=current_user.id,
        user_email=current_user.email,
        entity_id=current_user.id,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    return _success(message="Password changed successfully")


@router.patch("/{user_id}")
async def update_user(
    request: Request,
    user_id: uuid.UUID,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Dict[str, Any]:
    if user_id == current_user.id and body.role is not None:
        raise AppError("Cannot change your own role", 400)

    target_user = await user_service.get_user_by_id(db, user_id)
    if target_user is None:
        raise AppError("User not found", 404)

    if current_user.role == UserRole.ADMIN:
        if target_user.role == UserRole.SUPER_ADMIN:
            raise AppError("Cannot modify super admin", 403)
        if body.role == UserRole.SUPER_ADMIN:
            raise AppError("Cannot promote to super admin", 403)

    user = await user_service.update_user(db, user_id, body)

    await audit_service.create_audit_log(
        db=db,
        entity_type=EntityType.USER,
        action=AuditAction.UPDATE,
        user_id=current_user.id,
        user_email=current_user.email,
        entity_id=user_id,
        details=f"Updated user {target_user.email}",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    user_data = UserResponse.model_validate(user).model_dump(mode="json")
    await publisher_service.publish_event("user_updated", user_data)

    return _success(user_data)


@router.delete("/{user_id}")
async def delete_user(
    request: Request,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Dict[str, Any]:
    if user_id == current_user.id:
        raise AppError("Cannot delete yourself", 400)

    target_user = await user_service.get_user_by_id(db, user_id)
    if target_user is None:
        raise AppError("User not found", 404)

    if target_user.role == UserRole.SUPER_ADMIN and current_user.role != UserRole.SUPER_ADMIN:
        raise AppError("Cannot delete super admin", 403)

    success = await user_service.soft_delete_user(db, user_id)
    if not success:
        raise AppError("Failed to delete user", 500)

    await audit_service.create_audit_log(
        db=db,
        entity_type=EntityType.USER,
        action=AuditAction.DELETE,
        user_id=current_user.id,
        user_email=current_user.email,
        entity_id=user_id,
        details=f"Deleted user {target_user.email}",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    await publisher_service.publish_event("user_deleted", {"id": str(user_id)})

    return _success(message="User deleted successfully")
