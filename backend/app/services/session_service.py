import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.session import Session


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def create_session(
    db: AsyncSession,
    user_id: uuid.UUID,
    refresh_token: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Session:
    session = Session(
        user_id=user_id,
        refresh_token_hash=_hash_token(refresh_token),
        ip_address=ip_address,
        user_agent=user_agent,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=settings.SESSION_EXPIRY_DAYS),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def validate_refresh_token(
    db: AsyncSession, refresh_token: str
) -> Optional[Session]:
    token_hash = _hash_token(refresh_token)
    query = select(Session).where(
        Session.refresh_token_hash == token_hash,
        Session.expires_at > datetime.now(timezone.utc),
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def revoke_session(db: AsyncSession, session_id: uuid.UUID) -> bool:
    query = delete(Session).where(Session.id == session_id)
    result = await db.execute(query)
    await db.commit()
    return result.rowcount > 0


async def revoke_all_user_sessions(db: AsyncSession, user_id: uuid.UUID) -> int:
    query = delete(Session).where(Session.user_id == user_id)
    result = await db.execute(query)
    await db.commit()
    return result.rowcount
