import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.models.user import User, UserRole
from app.services import user_service
from app.utils.errors import AppError
from app.utils.jwt import decode_access_token

_ACTIVITY_THROTTLE = timedelta(minutes=5)


async def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if authorization is None or not authorization.startswith("Bearer "):
        raise AppError("Missing or invalid authorization header", 401)

    token = authorization.split(" ")[1]
    user_id = decode_access_token(token)

    if user_id is None:
        raise AppError("Invalid or expired token", 401)

    user = await user_service.get_user_by_id(db, user_id)
    if user is None:
        raise AppError("User not found", 401)

    # Update last_active_at (throttled to once per 5 minutes)
    now = datetime.now(timezone.utc)
    if user.last_active_at is None or (now - user.last_active_at) > _ACTIVITY_THROTTLE:
        user.last_active_at = now
        await db.commit()
        await db.refresh(user)

    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
        raise AppError("Admin access required", 403)
    return current_user


async def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.SUPER_ADMIN:
        raise AppError("Super admin access required", 403)
    return current_user


def get_client_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def get_user_agent(request: Request) -> Optional[str]:
    return request.headers.get("user-agent")
