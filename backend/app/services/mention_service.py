import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.call_comment import CallComment
from app.models.comment_mention import CommentMention
from app.models.messaging import Conversation, Message
from app.models.user import User
from app.services import call_service, publisher_service


def _parse_mentions_from_content(
    content: str,
    name_to_user: Dict[str, "User"],
) -> List["User"]:
    if "@" not in content:
        return []

    matched: List[User] = []
    lower_content = content.lower()
    i = 0
    while i < len(lower_content):
        if lower_content[i] == "@" and i + 1 < len(lower_content):
            best_user = None
            best_len = 0
            for name_lower, user in name_to_user.items():
                end = i + 1 + len(name_lower)
                if lower_content[i + 1 : end] == name_lower:
                    if end == len(lower_content) or not lower_content[end].isalnum():
                        if len(name_lower) > best_len:
                            best_len = len(name_lower)
                            best_user = user
            if best_user and best_user not in matched:
                matched.append(best_user)
                i += 1 + best_len
                continue
        i += 1

    return matched


async def create_mentions_for_comment(
    db: AsyncSession,
    comment: CallComment,
    author_id: uuid.UUID,
) -> List[CommentMention]:
    result = await db.execute(select(User))
    all_users = list(result.scalars().all())
    name_to_user = {u.full_name.lower(): u for u in all_users}

    mentioned_users = _parse_mentions_from_content(comment.content, name_to_user)
    if not mentioned_users:
        return []

    mentions: List[CommentMention] = []
    for user in mentioned_users:
        mention = CommentMention(
            comment_id=comment.id,
            call_id=comment.call_id,
            source="call_comment",
            user_id=user.id,
            mentioned_by=author_id,
        )
        db.add(mention)
        mentions.append(mention)

    await db.commit()
    for m in mentions:
        await db.refresh(m)

    call = await call_service.get_call_by_id(db, comment.call_id)
    display_data = call_service.decrypt_display_data(call) if call else None
    caller_name = (
        (display_data or {}).get("caller_name", "")
        or (display_data or {}).get("patient_name", "")
        or ""
    )

    author = await db.get(User, author_id)
    author_name = author.full_name if author else "Someone"

    target_ids = [str(u.id) for u in mentioned_users]
    await publisher_service.publish_to_users(
        "mention_created",
        {
            "source": "call_comment",
            "call_id": str(comment.call_id),
            "comment_id": str(comment.id),
            "mentioned_by_name": author_name,
            "caller_name": caller_name,
            "snippet": comment.content[:120],
        },
        user_ids=target_ids,
    )

    return mentions


async def create_mentions_for_message(
    db: AsyncSession,
    message: Message,
    conversation_id: uuid.UUID,
    author_id: uuid.UUID,
    member_ids: List[str],
) -> List[CommentMention]:
    member_uuids = {uuid.UUID(mid) for mid in member_ids}

    result = await db.execute(
        select(User).where(User.id.in_(member_uuids))
    )
    member_users = list(result.scalars().all())
    name_to_user = {u.full_name.lower(): u for u in member_users}

    plain_content = _strip_html(message.content)
    mentioned_users = _parse_mentions_from_content(plain_content, name_to_user)
    if not mentioned_users:
        return []

    mentions: List[CommentMention] = []
    for user in mentioned_users:
        mention = CommentMention(
            message_id=message.id,
            conversation_id=conversation_id,
            source="message",
            user_id=user.id,
            mentioned_by=author_id,
        )
        db.add(mention)
        mentions.append(mention)

    await db.commit()
    for m in mentions:
        await db.refresh(m)

    conv = await db.get(Conversation, conversation_id)
    conv_name = conv.name if conv and conv.name else None

    author = await db.get(User, author_id)
    author_name = author.full_name if author else "Someone"

    target_ids = [str(u.id) for u in mentioned_users]
    await publisher_service.publish_to_users(
        "mention_created",
        {
            "source": "message",
            "conversation_id": str(conversation_id),
            "conversation_name": conv_name,
            "message_id": str(message.id),
            "mentioned_by_name": author_name,
            "snippet": plain_content[:120],
        },
        user_ids=target_ids,
    )

    return mentions


def _strip_html(content: str) -> str:
    import html
    import re
    text = re.sub(r"<[^>]+>", " ", content)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


async def get_unread_count(db: AsyncSession, user_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count(CommentMention.id)).where(
            CommentMention.user_id == user_id,
            CommentMention.is_read == False,
        )
    )
    return result.scalar_one()


async def get_mentions(
    db: AsyncSession,
    user_id: uuid.UUID,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    result = await db.execute(
        select(CommentMention)
        .where(CommentMention.user_id == user_id)
        .options(
            selectinload(CommentMention.comment),
            selectinload(CommentMention.mentioner),
            selectinload(CommentMention.call),
            selectinload(CommentMention.message),
            selectinload(CommentMention.conversation),
        )
        .order_by(CommentMention.created_at.desc())
        .limit(limit)
    )
    mentions = list(result.scalars().all())

    items: List[Dict[str, Any]] = []
    for m in mentions:
        base: Dict[str, Any] = {
            "id": str(m.id),
            "source": m.source,
            "mentioned_by": str(m.mentioned_by),
            "mentioned_by_name": m.mentioner.full_name if m.mentioner else "Unknown",
            "is_read": m.is_read,
            "created_at": m.created_at.isoformat(),
        }

        if m.source in ("call_comment", "call_activity_comment", "call_activity_review", "call_activity_flag"):
            display_data: Optional[Dict[str, Any]] = None
            if m.call:
                display_data = call_service.decrypt_display_data(m.call)
            caller_name = (
                (display_data or {}).get("caller_name", "")
                or (display_data or {}).get("patient_name", "")
                or ""
            )
            content = ""
            if m.source == "call_comment" and m.comment:
                content = m.comment.content
            elif m.source == "call_activity_comment" and m.comment:
                content = m.comment.content
            elif m.source == "call_activity_review":
                content = "marked as reviewed"
            elif m.source == "call_activity_flag":
                content = "flagged this call"
            base.update({
                "call_id": str(m.call_id) if m.call_id else None,
                "comment_id": str(m.comment_id) if m.comment_id else None,
                "content": content,
                "caller_name": caller_name,
                "phone_number": (display_data or {}).get("phone_number", "") or "",
            })
        elif m.source == "message":
            conv_name = m.conversation.name if m.conversation and m.conversation.name else None
            plain = _strip_html(m.message.content) if m.message else ""
            base.update({
                "conversation_id": str(m.conversation_id) if m.conversation_id else None,
                "message_id": str(m.message_id) if m.message_id else None,
                "content": plain,
                "conversation_name": conv_name,
            })

        items.append(base)

    return items


async def mark_read(
    db: AsyncSession,
    mention_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    result = await db.execute(
        update(CommentMention)
        .where(
            CommentMention.id == mention_id,
            CommentMention.user_id == user_id,
        )
        .values(is_read=True)
    )
    await db.commit()
    return result.rowcount > 0


async def mark_unread(
    db: AsyncSession,
    mention_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    result = await db.execute(
        update(CommentMention)
        .where(
            CommentMention.id == mention_id,
            CommentMention.user_id == user_id,
        )
        .values(is_read=False)
    )
    await db.commit()
    return result.rowcount > 0


async def mark_all_read(db: AsyncSession, user_id: uuid.UUID) -> int:
    result = await db.execute(
        update(CommentMention)
        .where(
            CommentMention.user_id == user_id,
            CommentMention.is_read == False,
        )
        .values(is_read=True)
    )
    await db.commit()
    return result.rowcount


async def dismiss_mention(
    db: AsyncSession,
    mention_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    result = await db.execute(
        delete(CommentMention).where(
            CommentMention.id == mention_id,
            CommentMention.user_id == user_id,
        )
    )
    await db.commit()
    return result.rowcount > 0


async def clear_all(db: AsyncSession, user_id: uuid.UUID) -> int:
    result = await db.execute(
        delete(CommentMention).where(CommentMention.user_id == user_id)
    )
    await db.commit()
    return result.rowcount


async def notify_call_activity(
    db: AsyncSession,
    call_id: uuid.UUID,
    actor_id: uuid.UUID,
    action: str,
    snippet: str,
    comment_id: Optional[uuid.UUID] = None,
    exclude_user_ids: Optional[List[uuid.UUID]] = None,
) -> None:
    from app.models.call import Call

    commenter_result = await db.execute(
        select(CallComment.user_id)
        .where(CallComment.call_id == call_id, CallComment.user_id.isnot(None))
        .distinct()
    )
    interested: set[uuid.UUID] = {uid for uid in commenter_result.scalars().all()}

    call = await db.get(Call, call_id)
    if call:
        if call.reviewed_by:
            interested.add(call.reviewed_by)
        if call.flagged_by:
            interested.add(call.flagged_by)

    interested.discard(actor_id)
    for uid in exclude_user_ids or []:
        interested.discard(uid)

    if not interested:
        return

    source_map = {
        "comment": "call_activity_comment",
        "review": "call_activity_review",
        "flag": "call_activity_flag",
    }
    source = source_map.get(action, f"call_activity_{action}")

    for uid in interested:
        mention = CommentMention(
            call_id=call_id,
            comment_id=comment_id,
            source=source,
            user_id=uid,
            mentioned_by=actor_id,
        )
        db.add(mention)

    await db.commit()

    display_data = call_service.decrypt_display_data(call) if call else None
    caller_name = (
        (display_data or {}).get("caller_name", "")
        or (display_data or {}).get("patient_name", "")
        or ""
    )

    author = await db.get(User, actor_id)
    author_name = author.full_name if author else "Someone"

    target_ids = [str(uid) for uid in interested]
    await publisher_service.publish_to_users(
        "mention_created",
        {
            "source": source,
            "call_id": str(call_id),
            "mentioned_by_name": author_name,
            "caller_name": caller_name,
            "snippet": snippet[:120],
        },
        user_ids=target_ids,
    )
