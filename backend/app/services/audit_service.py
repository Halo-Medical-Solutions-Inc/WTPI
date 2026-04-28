import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditAction, AuditLog, EntityType


async def create_audit_log(
    db: AsyncSession,
    entity_type: EntityType,
    action: AuditAction,
    user_id: Optional[uuid.UUID] = None,
    user_email: Optional[str] = None,
    entity_id: Optional[uuid.UUID] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    audit_log = AuditLog(
        user_id=user_id,
        user_email=user_email,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(audit_log)
    await db.commit()
    await db.refresh(audit_log)
    return audit_log
