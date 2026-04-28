from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_admin
from app.database.session import get_db
from app.models.audit_log import AuditAction, AuditLog, EntityType
from app.models.user import User
from app.schemas.audit_log import AuditLogResponse

router = APIRouter(prefix="/api/audit-logs", tags=["audit-logs"])


def _success(data: Any = None, message: str = "Success") -> Dict[str, Any]:
    return {"success": True, "data": data, "message": message}


@router.get("")
async def list_audit_logs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
    entity_type: Optional[EntityType] = Query(None),
    action: Optional[AuditAction] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> Dict[str, Any]:
    query = select(AuditLog)

    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if action:
        query = query.where(AuditLog.action == action)
    if start_date:
        query = query.where(AuditLog.created_at >= start_date)
    if end_date:
        query = query.where(AuditLog.created_at <= end_date)

    query = query.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)

    result = await db.execute(query)
    logs = result.scalars().all()

    return _success(
        [AuditLogResponse.model_validate(log).model_dump() for log in logs]
    )
