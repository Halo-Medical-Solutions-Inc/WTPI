import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.messaging import (
    Conversation,
    ConversationMember,
    ConversationType,
    Message,
    MessageReaction,
)
from app.models.user import User, UserRole

DEFAULT_CHANNEL_NAME = "West Texas Pain Institute"
SUPPORT_CHANNEL_NAME = "Platform Support"
HALOHEALTH_EMAIL_SUFFIX = "@halohealth.app"


async def get_conversations_for_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    user_role: Optional[UserRole] = None,
) -> List[Dict[str, Any]]:
    member_subq = (
        select(ConversationMember.conversation_id)
        .where(ConversationMember.user_id == user_id)
        .subquery()
    )

    own_query = (
        select(Conversation)
        .where(Conversation.id.in_(select(member_subq.c.conversation_id)))
        .options(
            selectinload(Conversation.members).selectinload(ConversationMember.user),
        )
        .order_by(Conversation.updated_at.desc())
    )
    own_result = await db.execute(own_query)
    own_conversations = list(own_result.scalars().all())

    output: List[Dict[str, Any]] = []
    own_conv_ids: set[uuid.UUID] = set()
    for conv in own_conversations:
        own_conv_ids.add(conv.id)
        last_msg = await _get_last_message(db, conv.id)

        my_member = next(
            (m for m in conv.members if m.user_id == user_id), None
        )
        unread = 0
        if my_member is not None:
            unread = await _count_unread(db, conv.id, my_member.last_read_at)

        output.append(
            _build_conversation_dict(conv, last_msg, unread, is_observing=False)
        )

    if user_role == UserRole.SUPER_ADMIN:
        observed_query = (
            select(Conversation)
            .where(
                Conversation.type.in_(
                    [ConversationType.DIRECT, ConversationType.GROUP]
                ),
            )
            .options(
                selectinload(Conversation.members).selectinload(
                    ConversationMember.user
                ),
            )
            .order_by(Conversation.updated_at.desc())
        )
        if own_conv_ids:
            observed_query = observed_query.where(
                Conversation.id.notin_(own_conv_ids)
            )

        observed_result = await db.execute(observed_query)
        observed_conversations = list(observed_result.scalars().all())

        for conv in observed_conversations:
            last_msg = await _get_last_message(db, conv.id)
            output.append(
                _build_conversation_dict(conv, last_msg, 0, is_observing=True)
            )

        output.sort(key=lambda c: c["updated_at"], reverse=True)

    return output


async def get_conversation_by_id(
    db: AsyncSession,
    conversation_id: uuid.UUID,
) -> Optional[Conversation]:
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(
            selectinload(Conversation.members).selectinload(ConversationMember.user),
            selectinload(Conversation.messages).selectinload(Message.user),
        )
    )
    return result.scalar_one_or_none()


async def create_conversation(
    db: AsyncSession,
    name: Optional[str],
    conv_type: ConversationType,
    created_by_id: uuid.UUID,
    member_ids: List[uuid.UUID],
) -> Conversation:
    if conv_type == ConversationType.DIRECT:
        unique_check = list(set(member_ids))
        if created_by_id not in unique_check:
            unique_check.append(created_by_id)

        if len(unique_check) == 1:
            existing = await get_existing_self_dm(db, unique_check[0])
            if existing is not None:
                return existing
        elif len(unique_check) == 2:
            existing = await get_existing_dm(db, unique_check[0], unique_check[1])
            if existing is not None:
                return existing

    conv = Conversation(
        name=name,
        type=conv_type,
        created_by_id=created_by_id,
    )
    db.add(conv)
    await db.flush()

    unique_ids = list(set(member_ids))
    if created_by_id not in unique_ids:
        unique_ids.append(created_by_id)

    for uid in unique_ids:
        member = ConversationMember(
            conversation_id=conv.id,
            user_id=uid,
        )
        db.add(member)

    await db.commit()
    await db.refresh(conv)
    await db.refresh(conv, ["members", "messages"])
    for m in conv.members:
        await db.refresh(m, ["user"])
    return conv


async def get_existing_self_dm(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> Optional[Conversation]:
    member_count_subq = (
        select(
            ConversationMember.conversation_id,
            func.count(ConversationMember.id).label("cnt"),
        )
        .group_by(ConversationMember.conversation_id)
        .subquery()
    )

    user_convs = (
        select(ConversationMember.conversation_id)
        .where(ConversationMember.user_id == user_id)
        .subquery()
    )

    result = await db.execute(
        select(Conversation)
        .join(member_count_subq, Conversation.id == member_count_subq.c.conversation_id)
        .where(
            Conversation.type == ConversationType.DIRECT,
            Conversation.id.in_(select(user_convs.c.conversation_id)),
            member_count_subq.c.cnt == 1,
        )
        .options(
            selectinload(Conversation.members).selectinload(ConversationMember.user),
            selectinload(Conversation.messages).selectinload(Message.user),
        )
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_existing_dm(
    db: AsyncSession,
    user_a: uuid.UUID,
    user_b: uuid.UUID,
) -> Optional[Conversation]:
    subq_a = (
        select(ConversationMember.conversation_id)
        .where(ConversationMember.user_id == user_a)
        .subquery()
    )
    subq_b = (
        select(ConversationMember.conversation_id)
        .where(ConversationMember.user_id == user_b)
        .subquery()
    )

    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.type == ConversationType.DIRECT,
            Conversation.id.in_(select(subq_a.c.conversation_id)),
            Conversation.id.in_(select(subq_b.c.conversation_id)),
        )
        .options(
            selectinload(Conversation.members).selectinload(ConversationMember.user),
            selectinload(Conversation.messages).selectinload(Message.user),
        )
        .limit(1)
    )
    return result.scalar_one_or_none()


async def send_message(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
    content: str,
    reply_to_id: Optional[uuid.UUID] = None,
) -> Message:
    msg = Message(
        conversation_id=conversation_id,
        user_id=user_id,
        content=content.strip(),
        reply_to_id=reply_to_id,
    )
    db.add(msg)

    conv = await db.get(Conversation, conversation_id)
    if conv is not None:
        conv.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(msg)
    await db.refresh(msg, ["user", "reactions"])

    await mark_read(db, conversation_id, user_id)

    return msg


async def get_messages(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    limit: int = 50,
    before: Optional[str] = None,
) -> tuple[List[Message], bool]:
    query = (
        select(Message)
        .where(
            Message.conversation_id == conversation_id,
            Message.reply_to_id.is_(None),
        )
        .options(
            selectinload(Message.user),
            selectinload(Message.reactions).selectinload(MessageReaction.user),
        )
        .order_by(Message.created_at.desc())
        .limit(limit + 1)
    )
    if before is not None:
        query = query.where(Message.created_at < before)

    result = await db.execute(query)
    rows = list(result.scalars().all())

    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]

    rows.reverse()
    return rows, has_more


async def get_thread_messages(
    db: AsyncSession,
    parent_id: uuid.UUID,
) -> List[Message]:
    result = await db.execute(
        select(Message)
        .where(Message.reply_to_id == parent_id)
        .options(
            selectinload(Message.user),
            selectinload(Message.reactions).selectinload(MessageReaction.user),
        )
        .order_by(Message.created_at.asc())
    )
    return list(result.scalars().all())


async def get_reply_count(
    db: AsyncSession,
    message_id: uuid.UUID,
) -> int:
    result = await db.execute(
        select(func.count(Message.id)).where(Message.reply_to_id == message_id)
    )
    return result.scalar_one() or 0


async def mark_read(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    result = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if member is not None:
        member.last_read_at = datetime.now(timezone.utc)
        await db.commit()


async def get_unread_total(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> int:
    result = await db.execute(
        select(ConversationMember).where(
            ConversationMember.user_id == user_id
        )
    )
    members = list(result.scalars().all())

    total = 0
    for m in members:
        count = await _count_unread(db, m.conversation_id, m.last_read_at)
        total += count

    return total


async def add_member(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Optional[ConversationMember]:
    existing = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        return None

    member = ConversationMember(
        conversation_id=conversation_id,
        user_id=user_id,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    await db.refresh(member, ["user"])
    return member


async def remove_member(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    result = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        return False

    await db.delete(member)
    await db.commit()
    return True


async def upgrade_to_group(
    db: AsyncSession,
    conversation_id: uuid.UUID,
) -> None:
    conv = await db.get(Conversation, conversation_id)
    if conv is not None and conv.type == ConversationType.DIRECT:
        conv.type = ConversationType.GROUP
        await db.commit()


async def delete_conversation(
    db: AsyncSession,
    conversation_id: uuid.UUID,
) -> bool:
    result = await db.execute(
        select(Conversation.id).where(Conversation.id == conversation_id)
    )
    if result.scalar_one_or_none() is None:
        return False

    msg_ids = select(Message.id).where(
        Message.conversation_id == conversation_id
    ).scalar_subquery()

    await db.execute(
        delete(MessageReaction).where(MessageReaction.message_id.in_(msg_ids))
    )
    await db.execute(
        update(Message)
        .where(Message.conversation_id == conversation_id)
        .values(reply_to_id=None)
    )
    await db.execute(
        delete(Message).where(Message.conversation_id == conversation_id)
    )
    await db.execute(
        delete(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id
        )
    )
    await db.execute(
        delete(Conversation).where(Conversation.id == conversation_id)
    )
    await db.commit()
    return True


async def get_member_user_ids(
    db: AsyncSession,
    conversation_id: uuid.UUID,
) -> List[str]:
    result = await db.execute(
        select(ConversationMember.user_id)
        .join(User, ConversationMember.user_id == User.id)
        .where(
            ConversationMember.conversation_id == conversation_id,
            User.deleted_at.is_(None),
        )
    )
    return [str(uid) for uid in result.scalars().all()]


async def get_super_admin_user_ids(db: AsyncSession) -> List[str]:
    result = await db.execute(
        select(User.id).where(
            User.role == UserRole.SUPER_ADMIN,
            User.deleted_at.is_(None),
        )
    )
    return [str(uid) for uid in result.scalars().all()]


async def get_event_recipient_ids(
    db: AsyncSession,
    conversation_id: uuid.UUID,
) -> List[str]:
    member_ids = await get_member_user_ids(db, conversation_id)
    conv = await db.get(Conversation, conversation_id)
    if conv is None:
        return member_ids

    if conv.type not in (ConversationType.DIRECT, ConversationType.GROUP):
        return member_ids

    super_admin_ids = await get_super_admin_user_ids(db)
    combined = set(member_ids) | set(super_admin_ids)
    return list(combined)


async def can_user_view_conversation(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    user: User,
) -> bool:
    member_ids = await get_member_user_ids(db, conversation_id)
    if str(user.id) in member_ids:
        return True

    if user.role != UserRole.SUPER_ADMIN:
        return False

    conv = await db.get(Conversation, conversation_id)
    if conv is None:
        return False

    return conv.type in (ConversationType.DIRECT, ConversationType.GROUP)


async def is_user_member(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    member_ids = await get_member_user_ids(db, conversation_id)
    return str(user_id) in member_ids


async def ensure_defaults(db: AsyncSession) -> None:
    default_names = [DEFAULT_CHANNEL_NAME, SUPPORT_CHANNEL_NAME]

    for channel_name in default_names:
        result = await db.execute(
            select(Conversation).where(
                Conversation.is_default == True,
                Conversation.type == ConversationType.CHANNEL,
                Conversation.name == channel_name,
            )
        )
        channel = result.scalar_one_or_none()

        if channel is None:
            channel = Conversation(
                name=channel_name,
                type=ConversationType.CHANNEL,
                is_default=True,
            )
            db.add(channel)
            await db.flush()

        user_result = await db.execute(
            select(User.id).where(User.deleted_at.is_(None))
        )
        all_user_ids = [uid for uid in user_result.scalars().all()]

        member_result = await db.execute(
            select(ConversationMember.user_id).where(
                ConversationMember.conversation_id == channel.id
            )
        )
        existing_member_ids = set(member_result.scalars().all())

        for uid in all_user_ids:
            if uid not in existing_member_ids:
                db.add(
                    ConversationMember(
                        conversation_id=channel.id,
                        user_id=uid,
                    )
                )

    await db.commit()


async def is_halohealth_user(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> bool:
    user = await db.get(User, user_id)
    if user is None:
        return False
    return _email_is_halohealth(user.email)


async def is_support_channel(
    db: AsyncSession,
    conversation_id: uuid.UUID,
) -> bool:
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.is_default == True,
            Conversation.name == SUPPORT_CHANNEL_NAME,
        )
    )
    return result.scalar_one_or_none() is not None


def _email_is_halohealth(email: Optional[str]) -> bool:
    if not email or not email.strip():
        return False
    return email.strip().lower().endswith(HALOHEALTH_EMAIL_SUFFIX)


async def should_slack_notify_halohealth_dm(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    sender_id: uuid.UUID,
) -> bool:
    conv = await get_conversation_by_id(db, conversation_id)
    if conv is None:
        return False
    if conv.type not in (ConversationType.DIRECT, ConversationType.GROUP):
        return False
    sender = await db.get(User, sender_id)
    if sender is None or sender.deleted_at is not None:
        return False
    if _email_is_halohealth(sender.email):
        return False
    for m in conv.members:
        if m.user_id == sender_id:
            continue
        u = m.user
        if u is None or u.deleted_at is not None:
            continue
        if _email_is_halohealth(u.email):
            return True
    return False


async def has_super_admin_member(
    db: AsyncSession,
    conversation_id: uuid.UUID,
) -> bool:
    result = await db.execute(
        select(ConversationMember.id)
        .join(User, ConversationMember.user_id == User.id)
        .where(
            ConversationMember.conversation_id == conversation_id,
            User.role == UserRole.SUPER_ADMIN,
            User.deleted_at.is_(None),
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def add_user_to_defaults(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> None:
    result = await db.execute(
        select(Conversation).where(
            Conversation.is_default == True,
            Conversation.type == ConversationType.CHANNEL,
        )
    )
    default_channels = list(result.scalars().all())

    for channel in default_channels:
        existing = await db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == channel.id,
                ConversationMember.user_id == user_id,
            )
        )
        if existing.scalar_one_or_none() is None:
            db.add(
                ConversationMember(
                    conversation_id=channel.id,
                    user_id=user_id,
                )
            )

    await db.commit()


async def edit_message(
    db: AsyncSession,
    message_id: uuid.UUID,
    content: str,
) -> Optional[Message]:
    msg = await db.get(Message, message_id)
    if msg is None:
        return None

    msg.content = content.strip()
    msg.edited_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(msg)
    await db.refresh(msg, ["user", "reactions"])
    for r in msg.reactions:
        await db.refresh(r, ["user"])
    return msg


async def delete_message(
    db: AsyncSession,
    message_id: uuid.UUID,
) -> bool:
    msg = await db.get(Message, message_id)
    if msg is None:
        return False

    await db.execute(
        delete(MessageReaction).where(MessageReaction.message_id == message_id)
    )
    await db.delete(msg)
    await db.commit()
    return True


async def toggle_reaction(
    db: AsyncSession,
    message_id: uuid.UUID,
    user_id: uuid.UUID,
    emoji: str,
) -> tuple[bool, Optional[Message]]:
    msg = await db.get(Message, message_id)
    if msg is None:
        return False, None

    result = await db.execute(
        select(MessageReaction).where(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == user_id,
            MessageReaction.emoji == emoji,
        )
    )
    existing = result.scalar_one_or_none()

    if existing is not None:
        await db.delete(existing)
        added = False
    else:
        reaction = MessageReaction(
            message_id=message_id,
            user_id=user_id,
            emoji=emoji,
        )
        db.add(reaction)
        added = True

    await db.commit()
    await db.expire_all()

    refreshed = await get_message_by_id(db, message_id)
    return added, refreshed


async def get_message_by_id(
    db: AsyncSession,
    message_id: uuid.UUID,
) -> Optional[Message]:
    result = await db.execute(
        select(Message)
        .where(Message.id == message_id)
        .options(
            selectinload(Message.user),
            selectinload(Message.reactions).selectinload(MessageReaction.user),
        )
    )
    return result.scalar_one_or_none()


async def _get_last_message(
    db: AsyncSession,
    conversation_id: uuid.UUID,
) -> Optional[Message]:
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .options(selectinload(Message.user))
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _count_unread(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    last_read_at: Optional[datetime],
) -> int:
    query = select(func.count(Message.id)).where(
        Message.conversation_id == conversation_id
    )
    if last_read_at is not None:
        query = query.where(Message.created_at > last_read_at)

    result = await db.execute(query)
    return result.scalar_one() or 0


async def cleanup_user_conversations(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> Dict[str, List[str]]:
    result = await db.execute(
        select(ConversationMember.conversation_id).where(
            ConversationMember.user_id == user_id
        )
    )
    conv_ids = list(result.scalars().all())

    conversations_deleted: List[str] = []
    conversations_updated: List[str] = []

    for conv_id in conv_ids:
        conv = await db.execute(
            select(Conversation).where(Conversation.id == conv_id)
        )
        conv_obj = conv.scalar_one_or_none()
        if conv_obj is None:
            continue

        if conv_obj.type == ConversationType.DIRECT:
            await delete_conversation(db, conv_id)
            conversations_deleted.append(str(conv_id))
        else:
            await db.execute(
                delete(ConversationMember).where(
                    ConversationMember.conversation_id == conv_id,
                    ConversationMember.user_id == user_id,
                )
            )
            conversations_updated.append(str(conv_id))

    await db.commit()
    return {
        "deleted": conversations_deleted,
        "updated": conversations_updated,
    }


def _build_conversation_dict(
    conv: Conversation,
    last_msg: Optional[Message],
    unread: int,
    is_observing: bool = False,
) -> Dict[str, Any]:
    return {
        "id": str(conv.id),
        "name": conv.name,
        "type": conv.type.value,
        "is_default": conv.is_default,
        "created_by_id": str(conv.created_by_id) if conv.created_by_id else None,
        "member_ids": [
            str(m.user_id) for m in conv.members
            if m.user is not None and m.user.deleted_at is None
        ],
        "member_names": [
            m.user.full_name for m in conv.members
            if m.user is not None and m.user.deleted_at is None
        ],
        "last_message": last_msg.content if last_msg else None,
        "last_message_at": last_msg.created_at.isoformat() if last_msg else None,
        "last_message_by": (
            last_msg.user.full_name if last_msg and last_msg.user else None
        ),
        "unread_count": unread,
        "is_observing": is_observing,
        "created_at": conv.created_at.isoformat(),
        "updated_at": conv.updated_at.isoformat(),
    }
