import uuid
from typing import Any, Dict

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.call import CallStatus, ExtractionStatus
from app.services import call_service, practice_service, publisher_service
from app.services import extraction_service


async def complete_call_with_vapi_data(
    db: AsyncSession,
    call_id: uuid.UUID,
    vapi_data: Dict[str, Any],
) -> None:
    call = await call_service.update_call_with_vapi_data(
        db=db,
        call_id=call_id,
        vapi_data=vapi_data,
        status=CallStatus.COMPLETED,
    )

    if call is None:
        print(f"Call {call_id} not found for completion")
        return

    display_data = call_service.build_display_data(vapi_data=vapi_data)
    await call_service.store_display_data(db, call, display_data)

    await call_service.update_extraction_status(db, call, ExtractionStatus.PENDING)

    await practice_service.release_concurrency(db, call_id)

    await publisher_service.publish_event(
        "call_updated",
        {
            "id": str(call.id),
            "vapi_call_id": call.vapi_call_id,
            "display_data": display_data,
            "status": call.status.value,
            "is_reviewed": call.is_reviewed,
            "is_flagged": call.is_flagged,
            "extraction_status": ExtractionStatus.PENDING.value,
            "updated_at": call.updated_at.isoformat(),
        },
    )

    print(f"Call {call_id} completed successfully")

    extraction_service.process_extraction_background(call_id)


async def fail_call(db: AsyncSession, call_id: uuid.UUID, reason: str) -> None:
    call = await call_service.mark_call_failed(db, call_id)

    if call is None:
        print(f"Call {call_id} not found for failure")
        return

    await practice_service.release_concurrency(db, call_id)

    await publisher_service.publish_event(
        "call_updated",
        {
            "id": str(call.id),
            "status": call.status.value,
            "is_reviewed": call.is_reviewed,
            "is_flagged": call.is_flagged,
            "failure_reason": reason,
        },
    )

    print(f"Call {call_id} marked as failed: {reason}")
