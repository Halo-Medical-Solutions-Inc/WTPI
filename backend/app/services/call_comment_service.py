import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.call import Call
from app.models.call_comment import CallComment
from app.services import mention_service


async def get_call_comments(
    db: AsyncSession,
    call_id: uuid.UUID,
) -> List[CallComment]:
    result = await db.execute(
        select(CallComment)
        .where(CallComment.call_id == call_id)
        .options(selectinload(CallComment.user))
        .order_by(CallComment.created_at)
    )
    return list(result.scalars().all())


async def add_call_comment(
    db: AsyncSession,
    call_id: uuid.UUID,
    user_id: uuid.UUID,
    content: str,
) -> Optional[CallComment]:
    call = await db.get(Call, call_id)
    if call is None:
        return None

    comment = CallComment(
        call_id=call_id,
        user_id=user_id,
        content=content.strip(),
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    await db.refresh(comment, ["user"])

    await mention_service.create_mentions_for_comment(db, comment, user_id)

    return comment


async def delete_call_comment(
    db: AsyncSession,
    call_id: uuid.UUID,
    comment_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    result = await db.execute(
        select(CallComment).where(
            CallComment.id == comment_id,
            CallComment.call_id == call_id,
            CallComment.user_id == user_id,
        )
    )
    comment = result.scalar_one_or_none()
    if comment is None:
        return False
    await db.delete(comment)
    await db.commit()
    return True
