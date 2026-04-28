import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.audit_log import AuditAction, EntityType


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID]
    user_email: Optional[str]
    entity_type: EntityType
    entity_id: Optional[uuid.UUID]
    action: AuditAction
    details: Optional[str]
    ip_address: Optional[str]
    user_agent: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
