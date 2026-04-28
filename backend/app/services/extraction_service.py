import asyncio
from typing import Any, Dict, Optional
from uuid import UUID

from app.database.session import AsyncSessionLocal
from app.models.call import ExtractionStatus
from app.services import practice_service
from app.services.claude_service import claude_service
from app.services.extraction_schema import (
    DEPARTMENT_STAFF_DIRECTORY,
    PROVIDER_STAFF_DIRECTORY,
    build_extraction_schema,
    build_staff_extension_map,
)
from app.services.publisher_service import publish_event


async def run_extraction(call_id: UUID) -> None:
    print(f"[EXTRACTION] Starting extraction for call {call_id}")

    from app.services import call_service

    async with AsyncSessionLocal() as db:
        call = await call_service.get_call_by_id(db, call_id)
        if not call:
            print(f"[EXTRACTION] Call {call_id} not found")
            return

        await call_service.update_extraction_status(
            db, call, ExtractionStatus.IN_PROGRESS
        )
        await _broadcast_extraction_update(call_id, ExtractionStatus.IN_PROGRESS)

    try:
        async with AsyncSessionLocal() as db:
            call = await call_service.get_call_by_id(db, call_id)
            if not call:
                return

            practice = await practice_service.get_practice(db)
            teams = await practice_service.get_teams(db)
            team_names = [t.title for t in teams] if teams else None
            priority_config = (practice.priority_config if practice else None) or {}

            provider_names = [
                "Dr. Raul Lopez",
                "Ilyana Yee, NP",
                "Monica Ogaz, NP",
                "Lucia Fisher, NP",
                "Amanda Lopez, PA",
                "Other",
                "Not Provided",
            ]

            staff_extension_map = build_staff_extension_map(
                PROVIDER_STAFF_DIRECTORY,
                DEPARTMENT_STAFF_DIRECTORY,
            )
            extraction_schema = build_extraction_schema(
                provider_names,
                team_names=team_names,
                staff_extension_map=staff_extension_map,
                priority_descriptions=priority_config if priority_config else None,
            )

            vapi_data = call_service.decrypt_vapi_data(call) or {}

            artifact = vapi_data.get("artifact", {})
            transcript = artifact.get("transcript", "")

            call_obj = vapi_data.get("call", {})
            assistant = call_obj.get("assistant", {})
            model = assistant.get("model", {})
            messages = model.get("messages", [])
            assistant_prompt = ""
            if messages and len(messages) > 0:
                assistant_prompt = messages[0].get("content", "")

            if not assistant_prompt:
                assistant_prompt = "You are a helpful medical receptionist."

            extraction_result = await claude_service.extract_call_data(
                transcript=transcript,
                assistant_prompt=assistant_prompt,
                extraction_schema=extraction_schema,
            )

            if extraction_result is not None:
                await call_service.store_extraction_data(db, call, extraction_result)
                await call_service.update_extraction_status(
                    db, call, ExtractionStatus.COMPLETED
                )

                display_data = call_service.build_display_data(
                    vapi_data=vapi_data, extraction_data=extraction_result
                )
                await call_service.store_display_data(db, call, display_data)

                print(f"[EXTRACTION] Extraction completed for call {call_id}")

                review_update = await _try_auto_review(db, call, extraction_result)

                update_payload: Dict[str, Any] = {}
                if review_update:
                    update_payload.update(review_update)

                await _broadcast_extraction_update(
                    call_id,
                    ExtractionStatus.COMPLETED,
                    extraction_result,
                    display_data,
                )
            else:
                await call_service.update_extraction_status(
                    db, call, ExtractionStatus.FAILED
                )
                print(f"[EXTRACTION] Extraction failed for call {call_id}")
                await _broadcast_extraction_update(
                    call_id, ExtractionStatus.FAILED
                )

    except Exception as e:
        print(f"[EXTRACTION] Error during extraction for call {call_id}: {e}")
        async with AsyncSessionLocal() as db:
            call = await call_service.get_call_by_id(db, call_id)
            if call:
                await call_service.update_extraction_status(
                    db, call, ExtractionStatus.FAILED
                )
        await _broadcast_extraction_update(call_id, ExtractionStatus.FAILED)


async def _try_auto_review(
    db: "AsyncSession",
    call: "Call",
    extraction_data: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    from app.services import call_service

    should_auto_review = extraction_data.get("auto_review", False)
    if not should_auto_review:
        return None

    reviewed_call = await call_service.update_review_status(
        db=db,
        call_id=call.id,
        is_reviewed=True,
    )
    if reviewed_call is None:
        return None

    print(f"[EXTRACTION] Auto-reviewed call {call.id}")

    return {
        "is_reviewed": True,
        "reviewed_by": None,
        "reviewed_at": reviewed_call.reviewed_at.isoformat()
        if reviewed_call.reviewed_at
        else None,
    }


async def _broadcast_extraction_update(
    call_id: UUID,
    status: ExtractionStatus,
    extraction_data: Optional[Dict[str, Any]] = None,
    display_data: Optional[Dict[str, Any]] = None,
    sms_fields: Optional[Dict[str, Any]] = None,
) -> None:
    update_data: Dict[str, Any] = {
        "id": str(call_id),
        "extraction_status": status.value,
    }
    if extraction_data is not None:
        update_data["extraction_data"] = extraction_data
    if display_data is not None:
        update_data["display_data"] = display_data
    if sms_fields:
        update_data.update(sms_fields)
    await publish_event("call_updated", update_data)


def process_extraction_background(call_id: UUID) -> None:
    asyncio.create_task(run_extraction(call_id))
