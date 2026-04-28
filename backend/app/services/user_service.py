import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserSettingsUpdate, UserUpdate
from app.utils.errors import AppError
from app.utils.password import hash_password, verify_password


async def create_user(
    db: AsyncSession,
    email: str,
    password: str,
    full_name: str,
    role: UserRole = UserRole.STAFF,
    region: Optional[str] = None,
) -> User:
    existing = await get_user_by_email(db, email)
    if existing:
        raise AppError("Email already registered", 400)

    deleted_user = await get_user_by_email(db, email, include_deleted=True)
    if deleted_user:
        deleted_user.password_hash = hash_password(password)
        deleted_user.full_name = full_name
        deleted_user.role = role
        deleted_user.region = region
        deleted_user.deleted_at = None
        await db.commit()
        await db.refresh(deleted_user)
        return deleted_user

    user = User(
        email=email.lower(),
        password_hash=hash_password(password),
        full_name=full_name,
        role=role,
        region=region,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def get_user_by_email(
    db: AsyncSession, email: str, include_deleted: bool = False
) -> Optional[User]:
    query = select(User).where(User.email == email.lower())
    if not include_deleted:
        query = query.where(User.deleted_at.is_(None))
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_user_by_id(
    db: AsyncSession, user_id: uuid.UUID, include_deleted: bool = False
) -> Optional[User]:
    query = select(User).where(User.id == user_id)
    if not include_deleted:
        query = query.where(User.deleted_at.is_(None))
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def authenticate_user(
    db: AsyncSession, email: str, password: str
) -> Optional[User]:
    user = await get_user_by_email(db, email)
    if user is None:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


async def list_users(db: AsyncSession, include_deleted: bool = False) -> List[User]:
    query = select(User).order_by(User.created_at.desc())
    if not include_deleted:
        query = query.where(User.deleted_at.is_(None))
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_user(
    db: AsyncSession, user_id: uuid.UUID, data: UserUpdate
) -> Optional[User]:
    user = await get_user_by_id(db, user_id)
    if user is None:
        return None
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.role is not None:
        user.role = data.role
    if data.region is not None:
        user.region = data.region
    await db.commit()
    await db.refresh(user)
    return user


async def update_own_settings(
    db: AsyncSession, user_id: uuid.UUID, data: UserSettingsUpdate
) -> Optional[User]:
    user = await get_user_by_id(db, user_id)
    if user is None:
        return None
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.region is not None:
        user.region = data.region
    await db.commit()
    await db.refresh(user)
    return user


async def soft_delete_user(db: AsyncSession, user_id: uuid.UUID) -> bool:
    user = await get_user_by_id(db, user_id)
    if user is None:
        return False
    user.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return True


async def update_password(
    db: AsyncSession, user_id: uuid.UUID, new_password: str
) -> bool:
    user = await get_user_by_id(db, user_id)
    if user is None:
        return False
    user.password_hash = hash_password(new_password)
    await db.commit()
    return True


async def change_password(
    db: AsyncSession, user_id: uuid.UUID, current_password: str, new_password: str
) -> bool:
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise AppError("User not found", 404)
    if not verify_password(current_password, user.password_hash):
        raise AppError("Current password is incorrect", 400)
    user.password_hash = hash_password(new_password)
    await db.commit()
    return True
