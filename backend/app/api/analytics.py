import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.services import call_service
from app.services.analytics_service import get_analytics, get_sankey_calls
from app.utils.errors import AppError

router = APIRouter(prefix="/api", tags=["analytics"])


@router.get("/analytics")
async def get_analytics_endpoint(
    start_datetime: str = Query(...),
    end_datetime: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    try:
        start_dt = datetime.fromisoformat(start_datetime.replace("Z", "+00:00"))
    except ValueError:
        raise AppError("Invalid start_datetime format. Use ISO 8601.")

    try:
        end_dt = datetime.fromisoformat(end_datetime.replace("Z", "+00:00"))
    except ValueError:
        raise AppError("Invalid end_datetime format. Use ISO 8601.")

    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)
    if end_dt.tzinfo is None:
        end_dt = end_dt.replace(tzinfo=timezone.utc)

    if start_dt >= end_dt:
        raise AppError("start_datetime must be before end_datetime")

    analytics = await get_analytics(db, start_dt, end_dt)

    return {
        "success": True,
        "data": analytics.model_dump(mode="json"),
        "message": None,
    }


def _build_call_responses(calls: list) -> List[Dict[str, Any]]:
    results = []
    for call in calls:
        vapi_data = call_service.decrypt_vapi_data(call)
        extraction_data = call_service.decrypt_extraction_data(call)
        display_data = call_service.decrypt_display_data(call)
        if display_data is None and (vapi_data or extraction_data):
            display_data = call_service.build_display_data(vapi_data, extraction_data)
        results.append(
            {
                "id": call.id,
                "twilio_call_sid": call.twilio_call_sid,
                "vapi_call_id": call.vapi_call_id,
                "status": call.status,
                "is_reviewed": call.is_reviewed,
                "reviewed_by": call.reviewed_by,
                "reviewed_at": call.reviewed_at,
                "created_at": call.created_at,
                "updated_at": call.updated_at,
                "display_data": display_data,
                "vapi_data": vapi_data,
                "extraction_data": extraction_data,
                "extraction_status": call.extraction_status.value
                if call.extraction_status
                else None,
            }
        )
    return results


@router.get("/analytics/calls")
async def get_analytics_calls(
    start_datetime: str = Query(...),
    end_datetime: str = Query(...),
    filter_type: str = Query(...),
    filter_value: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    if filter_type not in ("intent", "extension", "doctor"):
        raise AppError("filter_type must be one of: intent, extension, doctor")

    try:
        start_dt = datetime.fromisoformat(start_datetime.replace("Z", "+00:00"))
    except ValueError:
        raise AppError("Invalid start_datetime format. Use ISO 8601.")

    try:
        end_dt = datetime.fromisoformat(end_datetime.replace("Z", "+00:00"))
    except ValueError:
        raise AppError("Invalid end_datetime format. Use ISO 8601.")

    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)
    if end_dt.tzinfo is None:
        end_dt = end_dt.replace(tzinfo=timezone.utc)

    if start_dt >= end_dt:
        raise AppError("start_datetime must be before end_datetime")

    calls = await get_sankey_calls(db, start_dt, end_dt, filter_type, filter_value)
    call_responses = await asyncio.to_thread(_build_call_responses, calls)

    return {
        "success": True,
        "data": call_responses,
        "message": None,
    }
