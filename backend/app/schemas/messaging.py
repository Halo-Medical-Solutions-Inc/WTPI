import uuid
from typing import List, Optional

from pydantic import BaseModel

from app.models.messaging import ConversationType


class ConversationCreate(BaseModel):
    name: Optional[str] = None
    type: ConversationType
    member_ids: List[uuid.UUID] = []


class MessageCreate(BaseModel):
    content: str
    reply_to_id: Optional[uuid.UUID] = None


class MessageEdit(BaseModel):
    content: str


class MemberAdd(BaseModel):
    user_id: uuid.UUID


class ReactionToggle(BaseModel):
    emoji: str


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    user_id: str
    user_name: str
    user_role: str
    content: str
    created_at: str


class ConversationResponse(BaseModel):
    id: str
    name: Optional[str] = None
    type: ConversationType
    is_default: bool
    created_by_id: Optional[str] = None
    member_ids: List[str] = []
    member_names: List[str] = []
    last_message: Optional[str] = None
    last_message_at: Optional[str] = None
    last_message_by: Optional[str] = None
    unread_count: int = 0
    created_at: str
    updated_at: str
