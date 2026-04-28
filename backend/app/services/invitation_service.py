import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.invitation import Invitation
from app.models.user import User, UserRole
from app.services import email_service, user_service
from app.utils.errors import AppError


def _generate_token() -> str:
    return secrets.token_urlsafe(32)


async def create_invitation(
    db: AsyncSession,
    email: str,
    role: UserRole,
    created_by: uuid.UUID,
) -> Invitation:
    existing_user = await user_service.get_user_by_email(db, email)
    if existing_user:
        raise AppError("User with this email already exists", 400)

    existing_invitation = await get_pending_invitation_by_email(db, email)
    if existing_invitation:
        raise AppError("Pending invitation already exists for this email", 400)

    invitation = Invitation(
        email=email.lower(),
        role=role,
        token=_generate_token(),
        expires_at=datetime.now(timezone.utc)
        + timedelta(hours=settings.INVITATION_EXPIRY_HOURS),
        created_by=created_by,
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)

    await email_service.send_invitation_email(
        invitation.email, invitation.token, invitation.role.value
    )
    return invitation


async def get_pending_invitation_by_email(
    db: AsyncSession, email: str
) -> Optional[Invitation]:
    query = select(Invitation).where(
        Invitation.email == email.lower(),
        Invitation.accepted_at.is_(None),
        Invitation.canceled_at.is_(None),
        Invitation.expires_at > datetime.now(timezone.utc),
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_invitation_by_id(
    db: AsyncSession, invitation_id: uuid.UUID
) -> Optional[Invitation]:
    query = select(Invitation).where(Invitation.id == invitation_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def verify_token(db: AsyncSession, token: str) -> Optional[Invitation]:
    query = select(Invitation).where(Invitation.token == token)
    result = await db.execute(query)
    invitation = result.scalar_one_or_none()
    if invitation is None:
        return None
    return invitation


async def accept_invitation(
    db: AsyncSession,
    token: str,
    password: str,
    full_name: str,
    region: Optional[str] = None,
) -> User:
    invitation = await verify_token(db, token)
    if invitation is None:
        raise AppError("Invalid invitation token", 400)
    if not invitation.is_valid:
        raise AppError("Invitation has expired or been used", 400)

    user = await user_service.create_user(
        db=db,
        email=invitation.email,
        password=password,
        full_name=full_name,
        role=invitation.role,
        region=region,
    )

    invitation.accepted_at = datetime.now(timezone.utc)
    await db.commit()

    return user


async def cancel_invitation(
    db: AsyncSession, invitation_id: uuid.UUID
) -> Optional[Invitation]:
    query = select(Invitation).where(Invitation.id == invitation_id)
    result = await db.execute(query)
    invitation = result.scalar_one_or_none()
    if invitation is None:
        return None
    if invitation.accepted_at is not None:
        raise AppError("Cannot cancel accepted invitation", 400)
    invitation.canceled_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(invitation)
    return invitation


async def resend_invitation(
    db: AsyncSession, invitation_id: uuid.UUID
) -> Optional[Invitation]:
    query = select(Invitation).where(Invitation.id == invitation_id)
    result = await db.execute(query)
    invitation = result.scalar_one_or_none()
    if invitation is None:
        return None
    if invitation.accepted_at is not None:
        raise AppError("Cannot resend accepted invitation", 400)
    if invitation.canceled_at is not None:
        raise AppError("Cannot resend canceled invitation", 400)

    invitation.token = _generate_token()
    invitation.expires_at = datetime.now(timezone.utc) + timedelta(
        hours=settings.INVITATION_EXPIRY_HOURS
    )
    await db.commit()
    await db.refresh(invitation)

    await email_service.send_invitation_email(
        invitation.email, invitation.token, invitation.role.value
    )
    return invitation


async def list_pending_invitations(db: AsyncSession) -> List[Invitation]:
    query = (
        select(Invitation)
        .where(
            Invitation.accepted_at.is_(None),
            Invitation.canceled_at.is_(None),
        )
        .order_by(Invitation.created_at.desc())
    )
    result = await db.execute(query)
    return list(result.scalars().all())
