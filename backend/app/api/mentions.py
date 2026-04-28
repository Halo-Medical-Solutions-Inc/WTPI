import uuid
from typing import Any, Dict

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.services import mention_service
from app.utils.errors import AppError

router = APIRouter(prefix="/api/mentions", tags=["mentions"])


def _success(data: Any = None, message: str = "Success") -> Dict[str, Any]:
    return {"success": True, "data": data, "message": message}


@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    count = await mention_service.get_unread_count(db, current_user.id)
    return _success({"count": count})


@router.get("")
async def get_mentions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    items = await mention_service.get_mentions(db, current_user.id)
    return _success(items)


@router.post("/{mention_id}/read")
async def mark_mention_read(
    mention_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    updated = await mention_service.mark_read(db, mention_id, current_user.id)
    if not updated:
        raise AppError("Mention not found", 404)
    return _success(message="Mention marked as read")


@router.post("/{mention_id}/unread")
async def mark_mention_unread(
    mention_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    updated = await mention_service.mark_unread(db, mention_id, current_user.id)
    if not updated:
        raise AppError("Mention not found", 404)
    return _success(message="Mention marked as unread")


@router.post("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    count = await mention_service.mark_all_read(db, current_user.id)
    return _success({"count": count}, message=f"Marked {count} mentions as read")


@router.delete("/{mention_id}")
async def dismiss_mention(
    mention_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    deleted = await mention_service.dismiss_mention(db, mention_id, current_user.id)
    if not deleted:
        raise AppError("Mention not found", 404)
    return _success(message="Mention dismissed")


@router.delete("")
async def clear_all(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    count = await mention_service.clear_all(db, current_user.id)
    return _success({"count": count}, message=f"Cleared {count} mentions")
