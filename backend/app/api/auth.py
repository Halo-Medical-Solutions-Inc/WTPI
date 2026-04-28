from typing import Any, Dict

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import (
    get_client_ip,
    get_current_user,
    get_user_agent,
)
from app.database.session import get_db
from app.models.audit_log import AuditAction, EntityType
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.schemas.user import UserResponse
from app.services import (
    audit_service,
    email_service,
    password_reset_service,
    session_service,
    user_service,
)
from app.utils.errors import AppError
from app.utils.jwt import create_access_token, create_refresh_token, decode_refresh_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _success(data: Any = None, message: str = "Success") -> Dict[str, Any]:
    return {"success": True, "data": data, "message": message}


@router.post("/login")
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    user = await user_service.authenticate_user(db, body.email, body.password)
    if user is None:
        raise AppError("Invalid email or password", 401)

    access_token = create_access_token(user.id)
    session = await session_service.create_session(
        db=db,
        user_id=user.id,
        refresh_token="placeholder",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    refresh_token = create_refresh_token(user.id, session.id)

    session.refresh_token_hash = __import__("hashlib").sha256(
        refresh_token.encode()
    ).hexdigest()
    await db.commit()

    await audit_service.create_audit_log(
        db=db,
        entity_type=EntityType.SESSION,
        action=AuditAction.LOGIN,
        user_id=user.id,
        user_email=user.email,
        entity_id=session.id,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    return _success(
        TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
        ).model_dump(),
        "Login successful",
    )


@router.post("/logout")
async def logout(
    request: Request,
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    payload = decode_refresh_token(body.refresh_token)
    if payload is None:
        raise AppError("Invalid refresh token", 401)

    session = await session_service.validate_refresh_token(db, body.refresh_token)
    if session is None:
        raise AppError("Session not found or expired", 401)

    await session_service.revoke_session(db, session.id)

    await audit_service.create_audit_log(
        db=db,
        entity_type=EntityType.SESSION,
        action=AuditAction.LOGOUT,
        user_id=payload["user_id"],
        entity_id=session.id,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    return _success(message="Logged out successfully")


@router.post("/refresh")
async def refresh(
    request: Request,
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    payload = decode_refresh_token(body.refresh_token)
    if payload is None:
        raise AppError("Invalid refresh token", 401)

    session = await session_service.validate_refresh_token(db, body.refresh_token)
    if session is None:
        raise AppError("Session not found or expired", 401)

    user = await user_service.get_user_by_id(db, payload["user_id"])
    if user is None:
        raise AppError("User not found", 401)

    await session_service.revoke_session(db, session.id)

    access_token = create_access_token(user.id)
    new_session = await session_service.create_session(
        db=db,
        user_id=user.id,
        refresh_token="placeholder",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    new_refresh_token = create_refresh_token(user.id, new_session.id)

    new_session.refresh_token_hash = __import__("hashlib").sha256(
        new_refresh_token.encode()
    ).hexdigest()
    await db.commit()

    return _success(
        TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
        ).model_dump(),
        "Token refreshed",
    )


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    return _success(UserResponse.model_validate(current_user).model_dump())


@router.post("/forgot-password")
async def forgot_password(
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    user = await user_service.get_user_by_email(db, body.email)
    if user is None:
        return _success(message="If email exists, reset link sent")

    token = await password_reset_service.create_reset_token(body.email)
    if token is None:
        raise AppError("Too many reset requests. Try again later.", 429)

    await email_service.send_password_reset_email(body.email, token)
    return _success(message="If email exists, reset link sent")


@router.get("/verify-reset-token")
async def verify_reset_token(token: str) -> Dict[str, Any]:
    email = await password_reset_service.verify_reset_token(token)
    if email is None:
        raise AppError("Invalid or expired reset token", 400)
    return _success({"email": email, "valid": True})


@router.post("/reset-password")
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    email = await password_reset_service.consume_reset_token(body.token)
    if email is None:
        raise AppError("Invalid or expired reset token", 400)

    user = await user_service.get_user_by_email(db, email)
    if user is None:
        raise AppError("User not found", 404)

    await user_service.update_password(db, user.id, body.new_password)
    await session_service.revoke_all_user_sessions(db, user.id)

    await audit_service.create_audit_log(
        db=db,
        entity_type=EntityType.USER,
        action=AuditAction.PASSWORD_RESET,
        user_id=user.id,
        user_email=user.email,
        entity_id=user.id,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    return _success(message="Password reset successful")
