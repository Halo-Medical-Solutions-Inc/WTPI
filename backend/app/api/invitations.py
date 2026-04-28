import uuid
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
from app.models.user import User, UserRole
from app.schemas.invitation import (
    InvitationAccept,
    InvitationCreate,
    InvitationResponse,
    InvitationVerifyResponse,
)
from app.schemas.user import UserResponse
from app.services import audit_service, invitation_service, publisher_service, session_service
from app.utils.errors import AppError
from app.utils.jwt import create_access_token, create_refresh_token

router = APIRouter(prefix="/api/invitations", tags=["invitations"])


def _success(data: Any = None, message: str = "Success") -> Dict[str, Any]:
    return {"success": True, "data": data, "message": message}


@router.post("")
async def create_invitation(
    request: Request,
    body: InvitationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Dict[str, Any]:
    if current_user.role == UserRole.ADMIN and body.role == UserRole.SUPER_ADMIN:
        raise AppError("Cannot invite super admin", 403)

    invitation = await invitation_service.create_invitation(
        db=db,
        email=body.email,
        role=body.role,
        created_by=current_user.id,
    )

    await audit_service.create_audit_log(
        db=db,
        entity_type=EntityType.INVITATION,
        action=AuditAction.CREATE,
        user_id=current_user.id,
        user_email=current_user.email,
        entity_id=invitation.id,
        details=f"Invited {invitation.email} as {invitation.role.value}",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    invitation_data = InvitationResponse.model_validate(invitation).model_dump(mode="json")
    await publisher_service.publish_event("invitation_created", invitation_data)

    return _success(invitation_data, "Invitation sent")


@router.get("")
async def list_invitations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    invitations = await invitation_service.list_pending_invitations(db)
    return _success(
        [InvitationResponse.model_validate(i).model_dump() for i in invitations]
    )


@router.get("/verify")
async def verify_invitation(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    invitation = await invitation_service.verify_token(db, token)

    if invitation and invitation.is_valid:
        return _success(
            InvitationVerifyResponse(
                valid=True,
                email=invitation.email,
                role=invitation.role,
            ).model_dump()
        )

    return _success(InvitationVerifyResponse(valid=False).model_dump())


@router.post("/accept")
async def accept_invitation(
    request: Request,
    body: InvitationAccept,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    invitation = await invitation_service.verify_token(db, body.token)
    if invitation is None:
        raise AppError("Invalid invitation token", 400)

    user = await invitation_service.accept_invitation(
        db=db,
        token=body.token,
        password=body.password,
        full_name=body.full_name,
        region=body.region,
    )

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id, uuid.uuid4())
    await session_service.create_session(
        db=db,
        user_id=user.id,
        refresh_token=refresh_token,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    await audit_service.create_audit_log(
        db=db,
        entity_type=EntityType.USER,
        action=AuditAction.CREATE,
        user_id=user.id,
        user_email=user.email,
        entity_id=user.id,
        details="User created via invitation acceptance",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    user_data = UserResponse.model_validate(user).model_dump(mode="json")
    await publisher_service.publish_event("user_created", user_data)

    updated_invitation = await invitation_service.get_invitation_by_id(db, invitation.id)
    if updated_invitation:
        invitation_data = InvitationResponse.model_validate(updated_invitation).model_dump(mode="json")
        await publisher_service.publish_event("invitation_accepted", invitation_data)

    return _success(
        data={
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        },
        message="Invitation accepted successfully",
    )


@router.delete("/{invitation_id}")
async def cancel_invitation(
    request: Request,
    invitation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Dict[str, Any]:
    invitation = await invitation_service.cancel_invitation(db, invitation_id)
    if invitation is None:
        raise AppError("Invitation not found", 404)

    await audit_service.create_audit_log(
        db=db,
        entity_type=EntityType.INVITATION,
        action=AuditAction.DELETE,
        user_id=current_user.id,
        user_email=current_user.email,
        entity_id=invitation_id,
        details=f"Canceled invitation for {invitation.email}",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    invitation_data = InvitationResponse.model_validate(invitation).model_dump(mode="json")
    await publisher_service.publish_event("invitation_canceled", invitation_data)

    return _success(message="Invitation canceled")


@router.post("/{invitation_id}/resend")
async def resend_invitation(
    request: Request,
    invitation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Dict[str, Any]:
    invitation = await invitation_service.resend_invitation(db, invitation_id)
    if invitation is None:
        raise AppError("Invitation not found", 404)

    await audit_service.create_audit_log(
        db=db,
        entity_type=EntityType.INVITATION,
        action=AuditAction.UPDATE,
        user_id=current_user.id,
        user_email=current_user.email,
        entity_id=invitation_id,
        details=f"Resent invitation to {invitation.email}",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    return _success(
        InvitationResponse.model_validate(invitation).model_dump(),
        "Invitation resent",
    )
