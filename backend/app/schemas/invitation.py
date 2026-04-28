import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class InvitationCreate(BaseModel):
    email: EmailStr
    role: UserRole


class InvitationAccept(BaseModel):
    token: str
    password: str
    full_name: str
    region: Optional[str] = None


class InvitationResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: UserRole
    expires_at: datetime
    accepted_at: Optional[datetime]
    canceled_at: Optional[datetime]
    created_at: datetime
    created_by: uuid.UUID

    model_config = {"from_attributes": True}


class InvitationVerifyResponse(BaseModel):
    valid: bool
    email: Optional[str] = None
    role: Optional[UserRole] = None
