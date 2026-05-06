import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.database.session import get_db
from app.models.messaging import ConversationType
from app.models.user import User, UserRole
from app.schemas.messaging import ConversationCreate, MemberAdd, MessageCreate, MessageEdit, ReactionToggle
from app.services import mention_service, messaging_service, slack_notify_service
from app.services.publisher_service import publish_to_users
from app.utils.errors import AppError

router = APIRouter(prefix="/api/messages", tags=["messages"])


def _success(data: Any = None, message: str = "Success") -> Dict[str, Any]:
    return {"success": True, "data": data, "message": message}


def _serialize_message(msg: Any, reply_count: int = 0) -> Dict[str, Any]:
    reactions: list[Dict[str, Any]] = []
    if hasattr(msg, "reactions") and msg.reactions:
        for r in msg.reactions:
            reactions.append({
                "id": str(r.id),
                "emoji": r.emoji,
                "user_id": str(r.user_id),
                "user_name": r.user.full_name if r.user else "Unknown",
            })
    return {
        "id": str(msg.id),
        "conversation_id": str(msg.conversation_id),
        "user_id": str(msg.user_id),
        "user_name": msg.user.full_name if msg.user else "Unknown",
        "user_role": msg.user.role.value if msg.user else "STAFF",
        "content": msg.content,
        "reply_to_id": str(msg.reply_to_id) if msg.reply_to_id else None,
        "reply_count": reply_count,
        "edited_at": msg.edited_at.isoformat() if msg.edited_at else None,
        "reactions": reactions,
        "created_at": msg.created_at.isoformat(),
    }


@router.get("/conversations")
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    conversations = await messaging_service.get_conversations_for_user(
        db, current_user.id, current_user.role
    )
    return _success(conversations)


@router.post("/conversations")
async def create_conversation(
    body: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    if body.type == ConversationType.CHANNEL and not body.name:
        raise AppError("Channel name is required", 400)

    if body.type == ConversationType.DIRECT:
        is_self = len(body.member_ids) == 1 and body.member_ids[0] == current_user.id
        if not is_self and len(body.member_ids) != 2:
            raise AppError("Direct messages require exactly 2 members", 400)

    conv = await messaging_service.create_conversation(
        db=db,
        name=body.name,
        conv_type=body.type,
        created_by_id=current_user.id,
        member_ids=[uid for uid in body.member_ids],
    )

    recipient_ids = await messaging_service.get_event_recipient_ids(db, conv.id)

    last_msg = None
    if conv.messages:
        last_msg = conv.messages[-1]

    conv_data = messaging_service._build_conversation_dict(conv, last_msg, 0)

    await publish_to_users("conversation_created", conv_data, recipient_ids)

    return _success(conv_data, message="Conversation created")


@router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: uuid.UUID,
    before: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    can_view = await messaging_service.can_user_view_conversation(
        db, conversation_id, current_user
    )
    if not can_view:
        raise AppError("Not a member of this conversation", 403)

    messages, has_more = await messaging_service.get_messages(
        db, conversation_id, limit=limit, before=before
    )
    serialized = []
    for m in messages:
        rc = await messaging_service.get_reply_count(db, m.id)
        serialized.append(_serialize_message(m, reply_count=rc))
    return _success({"messages": serialized, "has_more": has_more})


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: uuid.UUID,
    body: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    if not body.content or not body.content.strip():
        raise AppError("Message content is required", 400)

    member_ids = await messaging_service.get_member_user_ids(db, conversation_id)
    if str(current_user.id) not in member_ids:
        raise AppError("Not a member of this conversation", 403)

    reply_to = None
    if hasattr(body, "reply_to_id") and body.reply_to_id:
        reply_to = body.reply_to_id

    msg = await messaging_service.send_message(
        db=db,
        conversation_id=conversation_id,
        user_id=current_user.id,
        content=body.content,
        reply_to_id=reply_to,
    )

    serialized = _serialize_message(msg)

    recipient_ids = await messaging_service.get_event_recipient_ids(
        db, conversation_id
    )
    await publish_to_users(
        "message_created",
        serialized,
        recipient_ids,
    )

    await mention_service.create_mentions_for_message(
        db=db,
        message=msg,
        conversation_id=conversation_id,
        author_id=current_user.id,
        member_ids=member_ids,
    )

    is_halo_user = await messaging_service.is_halohealth_user(db, current_user.id)
    should_notify = False
    if not is_halo_user and await messaging_service.is_support_channel(db, conversation_id):
        should_notify = True
    if not is_halo_user and await messaging_service.should_slack_notify_halohealth_dm(
        db, conversation_id, current_user.id
    ):
        should_notify = True
    if should_notify:
        try:
            await slack_notify_service.notify_platform_support_message(
                author_name=current_user.full_name or "Someone",
                content=body.content.strip(),
                conversation_id=conversation_id,
            )
        except Exception as exc:
            print(f"Slack notify error: {exc}")

    return _success(serialized, message="Message sent")


@router.get("/conversations/{conversation_id}/messages/{message_id}/replies")
async def get_thread_messages(
    conversation_id: uuid.UUID,
    message_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    can_view = await messaging_service.can_user_view_conversation(
        db, conversation_id, current_user
    )
    if not can_view:
        raise AppError("Not a member of this conversation", 403)

    parent = await messaging_service.get_message_by_id(db, message_id)
    if parent is None:
        raise AppError("Message not found", 404)

    replies = await messaging_service.get_thread_messages(db, message_id)
    return _success({
        "parent": _serialize_message(parent),
        "replies": [_serialize_message(r) for r in replies],
    })


@router.post("/conversations/{conversation_id}/read")
async def mark_as_read(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    await messaging_service.mark_read(db, conversation_id, current_user.id)
    return _success(message="Marked as read")


@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    total = await messaging_service.get_unread_total(db, current_user.id)
    return _success({"total": total})


@router.post("/conversations/{conversation_id}/members")
async def add_conversation_member(
    conversation_id: uuid.UUID,
    body: MemberAdd,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    conv = await messaging_service.get_conversation_by_id(db, conversation_id)
    if conv is None:
        raise AppError("Conversation not found", 404)

    member_ids = [str(m.user_id) for m in conv.members]
    if str(current_user.id) not in member_ids:
        raise AppError("Not a member of this conversation", 403)

    if conv.type == ConversationType.DIRECT:
        await messaging_service.upgrade_to_group(db, conversation_id)

    member = await messaging_service.add_member(db, conversation_id, body.user_id)
    if member is None:
        raise AppError("User is already a member", 400)

    recipient_ids = await messaging_service.get_event_recipient_ids(
        db, conversation_id
    )
    await publish_to_users(
        "conversation_member_added",
        {
            "conversation_id": str(conversation_id),
            "user_id": str(body.user_id),
            "user_name": member.user.full_name if member.user else "Unknown",
        },
        recipient_ids,
    )

    return _success(message="Member added")


@router.delete("/conversations/{conversation_id}/members/{user_id}")
async def remove_conversation_member(
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    conv = await messaging_service.get_conversation_by_id(db, conversation_id)
    if conv is None:
        raise AppError("Conversation not found", 404)

    is_self = user_id == current_user.id
    is_creator = conv.created_by_id == current_user.id
    is_super = current_user.role == UserRole.SUPER_ADMIN

    if not is_self and not is_creator and not is_super:
        raise AppError("Not authorized to remove this member", 403)

    removed = await messaging_service.remove_member(db, conversation_id, user_id)
    if not removed:
        raise AppError("Member not found", 404)

    return _success(message="Member removed")


@router.patch("/messages/{message_id}")
async def edit_message(
    message_id: uuid.UUID,
    body: MessageEdit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    if not body.content or not body.content.strip():
        raise AppError("Message content is required", 400)

    msg = await messaging_service.get_message_by_id(db, message_id)
    if msg is None:
        raise AppError("Message not found", 404)

    if msg.user_id != current_user.id:
        raise AppError("Can only edit your own messages", 403)

    updated = await messaging_service.edit_message(db, message_id, body.content)
    if updated is None:
        raise AppError("Message not found", 404)

    rc = await messaging_service.get_reply_count(db, message_id)
    recipient_ids = await messaging_service.get_event_recipient_ids(
        db, updated.conversation_id
    )
    serialized = _serialize_message(updated, reply_count=rc)
    await publish_to_users("message_updated", serialized, recipient_ids)

    return _success(serialized, message="Message edited")


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    msg = await messaging_service.get_message_by_id(db, message_id)
    if msg is None:
        raise AppError("Message not found", 404)

    is_owner = msg.user_id == current_user.id
    is_super = current_user.role == UserRole.SUPER_ADMIN
    if not is_owner and not is_super:
        raise AppError("Not authorized to delete this message", 403)

    conversation_id = msg.conversation_id
    recipient_ids = await messaging_service.get_event_recipient_ids(
        db, conversation_id
    )

    deleted = await messaging_service.delete_message(db, message_id)
    if not deleted:
        raise AppError("Message not found", 404)

    await publish_to_users(
        "message_deleted",
        {"id": str(message_id), "conversation_id": str(conversation_id)},
        recipient_ids,
    )

    return _success(message="Message deleted")


@router.post("/messages/{message_id}/reactions")
async def toggle_reaction(
    message_id: uuid.UUID,
    body: ReactionToggle,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    msg = await messaging_service.get_message_by_id(db, message_id)
    if msg is None:
        raise AppError("Message not found", 404)

    member_ids = await messaging_service.get_member_user_ids(
        db, msg.conversation_id
    )
    if str(current_user.id) not in member_ids:
        raise AppError("Not a member of this conversation", 403)

    added, updated_msg = await messaging_service.toggle_reaction(
        db, message_id, current_user.id, body.emoji
    )
    if updated_msg is None:
        raise AppError("Message not found", 404)

    rc = await messaging_service.get_reply_count(db, message_id)
    serialized = _serialize_message(updated_msg, reply_count=rc)

    recipient_ids = await messaging_service.get_event_recipient_ids(
        db, msg.conversation_id
    )
    await publish_to_users(
        "message_reactions_updated",
        serialized,
        recipient_ids,
    )

    action = "added" if added else "removed"
    return _success(serialized, message=f"Reaction {action}")


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    conv = await messaging_service.get_conversation_by_id(db, conversation_id)
    if conv is None:
        raise AppError("Conversation not found", 404)

    if conv.is_default:
        raise AppError("Cannot delete the default channel", 400)

    is_creator = conv.created_by_id == current_user.id
    is_super = current_user.role == UserRole.SUPER_ADMIN
    is_member = any(m.user_id == current_user.id for m in conv.members)
    is_dm_or_group = conv.type in (ConversationType.DIRECT, ConversationType.GROUP)

    if not is_super and not is_creator and not (is_dm_or_group and is_member):
        raise AppError("Not authorized to delete this conversation", 403)

    recipient_ids = await messaging_service.get_event_recipient_ids(
        db, conversation_id
    )

    deleted = await messaging_service.delete_conversation(db, conversation_id)
    if not deleted:
        raise AppError("Conversation not found", 404)

    await publish_to_users(
        "conversation_deleted",
        {"id": str(conversation_id)},
        recipient_ids,
    )

    return _success(message="Conversation deleted")
