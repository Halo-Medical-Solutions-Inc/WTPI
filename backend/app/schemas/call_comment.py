import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class CallCommentCreate(BaseModel):
    content: str


class CallCommentResponse(BaseModel):
    id: uuid.UUID
    call_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    user_name: Optional[str] = None
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}
