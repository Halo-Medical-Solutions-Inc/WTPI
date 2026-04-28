import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import load_only

from app.models.call import Call, CallStatus, ExtractionStatus
from app.schemas.call import CallSearchRequest, CallSearchResultItem
from app.utils.encryption import decrypt_for_display, encrypt_for_storage


async def create_call(
    db: AsyncSession, twilio_call_sid: str, number: Optional[str] = None
) -> Call:
    call = Call(
        twilio_call_sid=twilio_call_sid,
        number=number,
        status=CallStatus.IN_PROGRESS,
    )
    db.add(call)
    await db.commit()
    await db.refresh(call)
    return call


async def find_completed_calls_by_number(
    db: AsyncSession, number: str, within_hours: int = 24
) -> List[Call]:
    if not number or not number.strip():
        return []

    cutoff = datetime.now(timezone.utc) - timedelta(hours=within_hours)

    query = (
        select(Call)
        .where(
            Call.number == number,
            Call.status == CallStatus.COMPLETED,
            Call.deleted_at.is_(None),
            Call.created_at >= cutoff,
        )
        .limit(1)
    )
    result = await db.execute(query)
    return list(result.scalars().all())


async def find_call_by_twilio_sid(
    db: AsyncSession, twilio_call_sid: str
) -> Optional[Call]:
    query = select(Call).where(
        Call.twilio_call_sid == twilio_call_sid,
        Call.deleted_at.is_(None),
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def find_call_by_vapi_id(db: AsyncSession, vapi_call_id: str) -> Optional[Call]:
    query = select(Call).where(
        Call.vapi_call_id == vapi_call_id,
        Call.deleted_at.is_(None),
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def update_call_with_vapi_id(
    db: AsyncSession, call_id: uuid.UUID, vapi_call_id: str
) -> Optional[Call]:
    query = select(Call).where(Call.id == call_id)
    result = await db.execute(query)
    call = result.scalar_one_or_none()
    if call is None:
        return None
    call.vapi_call_id = vapi_call_id
    await db.commit()
    await db.refresh(call)
    return call


async def update_call_with_vapi_data(
    db: AsyncSession, call_id: uuid.UUID, vapi_data: Dict[str, Any], status: CallStatus
) -> Optional[Call]:
    query = select(Call).where(Call.id == call_id)
    result = await db.execute(query)
    call = result.scalar_one_or_none()
    if call is None:
        return None

    encrypted_data, kid = encrypt_for_storage(json.dumps(vapi_data))
    call.vapi_data_encrypted = encrypted_data
    call.vapi_data_kid = kid
    call.status = status
    await db.commit()
    await db.refresh(call)
    return call


_LIST_COLUMNS = load_only(
    Call.id,
    Call.twilio_call_sid,
    Call.vapi_call_id,
    Call.status,
    Call.is_reviewed,
    Call.reviewed_by,
    Call.reviewed_at,
    Call.is_flagged,
    Call.flagged_by,
    Call.flagged_at,
    Call.created_at,
    Call.updated_at,
    Call.extraction_status,
    Call.display_data_encrypted,
    Call.display_data_kid,
    Call.extraction_data_encrypted,
    Call.extraction_data_kid,
    Call.deleted_at,
)


async def get_calls(
    db: AsyncSession,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    status: Optional[CallStatus] = None,
    is_reviewed: Optional[bool] = None,
    limit: Optional[int] = None,
) -> List[Call]:
    query = select(Call).options(_LIST_COLUMNS).where(Call.deleted_at.is_(None))

    if start_date:
        query = query.where(Call.created_at >= start_date)
    if end_date:
        query = query.where(Call.created_at <= end_date)
    if status:
        query = query.where(Call.status == status)
    if is_reviewed is not None:
        query = query.where(Call.is_reviewed == is_reviewed)

    query = query.order_by(Call.created_at.desc())
    if limit is not None:
        query = query.limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_call_by_id(db: AsyncSession, call_id: uuid.UUID) -> Optional[Call]:
    query = select(Call).where(Call.id == call_id, Call.deleted_at.is_(None))
    result = await db.execute(query)
    return result.scalar_one_or_none()


def decrypt_vapi_data(call: Call) -> Optional[Dict[str, Any]]:
    if call.vapi_data_encrypted is None or call.vapi_data_kid is None:
        return None
    decrypted = decrypt_for_display(call.vapi_data_encrypted, call.vapi_data_kid)
    if decrypted is None:
        return None
    return json.loads(decrypted)


async def update_review_status(
    db: AsyncSession,
    call_id: uuid.UUID,
    is_reviewed: bool,
    reviewed_by: Optional[uuid.UUID] = None,
) -> Optional[Call]:
    call = await get_call_by_id(db, call_id)
    if call is None:
        return None
    call.is_reviewed = is_reviewed
    if is_reviewed:
        call.reviewed_by = reviewed_by
        call.reviewed_at = datetime.now(timezone.utc)
    else:
        call.reviewed_by = None
        call.reviewed_at = None
    await db.commit()
    await db.refresh(call)
    return call


async def update_flag_status(
    db: AsyncSession,
    call_id: uuid.UUID,
    is_flagged: bool,
    flagged_by: Optional[uuid.UUID] = None,
) -> Optional[Call]:
    call = await get_call_by_id(db, call_id)
    if call is None:
        return None
    call.is_flagged = is_flagged
    if is_flagged:
        call.flagged_by = flagged_by
        call.flagged_at = datetime.now(timezone.utc)
    else:
        call.flagged_by = None
        call.flagged_at = None
    await db.commit()
    await db.refresh(call)
    return call


async def get_stale_in_progress_calls(
    db: AsyncSession, threshold_minutes: int = 30
) -> List[Call]:
    threshold = datetime.now(timezone.utc) - __import__("datetime").timedelta(
        minutes=threshold_minutes
    )
    query = select(Call).where(
        Call.status == CallStatus.IN_PROGRESS,
        Call.created_at < threshold,
        Call.deleted_at.is_(None),
    )
    result = await db.execute(query)
    return list(result.scalars().all())


async def mark_call_failed(db: AsyncSession, call_id: uuid.UUID) -> Optional[Call]:
    call = await get_call_by_id(db, call_id)
    if call is None:
        return None
    call.status = CallStatus.FAILED
    await db.commit()
    await db.refresh(call)
    return call


async def soft_delete_call(db: AsyncSession, call_id: uuid.UUID) -> bool:
    call = await get_call_by_id(db, call_id)
    if call is None:
        return False
    call.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return True


def _normalize_phone(phone: str) -> str:
    return "".join(c for c in phone if c.isdigit())


def _calculate_relevance(
    search_text: str, vapi_data: Optional[Dict[str, Any]], extraction_data: Optional[Dict[str, Any]]
) -> float:
    search_lower = search_text.lower()
    search_digits = _normalize_phone(search_text)
    score = 0.0
    matches = 0

    phone_number = ""
    if vapi_data:
        call_obj = vapi_data.get("call", {})
        customer = call_obj.get("customer", {})
        phone_number = customer.get("number", "") or ""

    if search_digits and len(search_digits) >= 3:
        normalized_phone = _normalize_phone(phone_number)
        if normalized_phone and search_digits in normalized_phone:
            if search_digits == normalized_phone or search_digits == normalized_phone[-10:]:
                score += 100
                matches += 1
            elif normalized_phone.endswith(search_digits):
                score += 80
                matches += 1
            else:
                score += 60
                matches += 1

    extraction_fields = {}
    if extraction_data:
        extraction_fields = {
            "caller_name": extraction_data.get("caller_name", ""),
            "patient_name": extraction_data.get("patient_name", ""),
            "caller_affiliation": extraction_data.get("caller_affiliation", ""),
            "provider_name": extraction_data.get("provider_name", ""),
            "primary_intent": extraction_data.get("primary_intent", ""),
            "summary": extraction_data.get("summary", ""),
        }

    vapi_fields = {}
    if vapi_data:
        analysis = vapi_data.get("analysis", {})
        structured = analysis.get("structuredData", {})
        vapi_fields = {
            "caller_name": structured.get("caller_name", ""),
            "patient_name": structured.get("patient_name", "") or structured.get("subject_name", ""),
            "caller_affiliation": structured.get("caller_affiliation", ""),
            "provider_name": structured.get("provider_name", ""),
            "primary_intent": structured.get("primary_intent", ""),
            "summary": structured.get("summary", "") or structured.get("free_text_summary", ""),
            "callback_number": structured.get("callback_number", ""),
            "analysis_summary": analysis.get("summary", ""),
        }

    high_priority_fields = ["caller_name", "patient_name", "provider_name"]
    medium_priority_fields = ["caller_affiliation", "primary_intent", "callback_number"]
    low_priority_fields = ["summary", "analysis_summary"]

    for field in high_priority_fields:
        val = str(extraction_fields.get(field, "") or vapi_fields.get(field, "")).lower()
        if val and search_lower in val:
            if val == search_lower:
                score += 90
            elif val.startswith(search_lower) or val.endswith(search_lower):
                score += 70
            else:
                score += 50
            matches += 1

    for field in medium_priority_fields:
        val = str(extraction_fields.get(field, "") or vapi_fields.get(field, "")).lower()
        if val and search_lower in val:
            score += 30
            matches += 1

    for field in low_priority_fields:
        val = str(extraction_fields.get(field, "") or vapi_fields.get(field, "")).lower()
        if val and search_lower in val:
            score += 15
            matches += 1

    if matches > 1:
        score += matches * 5

    return min(score, 100)


async def search_calls(
    db: AsyncSession, request: CallSearchRequest
) -> List[CallSearchResultItem]:
    base_query = select(Call).where(Call.deleted_at.is_(None))

    if request.start_date:
        base_query = base_query.where(Call.created_at >= request.start_date)
    if request.end_date:
        base_query = base_query.where(Call.created_at <= request.end_date)
    if request.status:
        base_query = base_query.where(Call.status == request.status)
    if request.is_reviewed is not None:
        base_query = base_query.where(Call.is_reviewed == request.is_reviewed)

    query = base_query.order_by(Call.created_at.desc()).limit(500)
    result = await db.execute(query)
    calls = list(result.scalars().all())

    scored_results = []
    search_text = request.query.strip() if request.query else ""

    for call in calls:
        vapi_data = decrypt_vapi_data(call)
        extraction_data = decrypt_extraction_data(call)

        if search_text:
            relevance = _calculate_relevance(search_text, vapi_data, extraction_data)
            if relevance == 0:
                continue
        else:
            relevance = 0.0

        scored_results.append(
            {
                "call": call,
                "vapi_data": vapi_data,
                "extraction_data": extraction_data,
                "relevance": relevance,
            }
        )

    scored_results.sort(key=lambda x: (-x["relevance"], x["call"].created_at), reverse=False)
    scored_results.sort(key=lambda x: x["relevance"], reverse=True)

    limited_results = scored_results[request.offset : request.offset + request.limit]

    call_responses = []
    for idx, item in enumerate(limited_results):
        call = item["call"]
        is_top = idx == 0 and item["relevance"] >= 50
        display = build_display_data(item["vapi_data"], item["extraction_data"])
        call_responses.append(
            CallSearchResultItem(
                id=call.id,
                twilio_call_sid=call.twilio_call_sid,
                vapi_call_id=call.vapi_call_id,
                status=call.status,
                is_reviewed=call.is_reviewed,
                reviewed_by=call.reviewed_by,
                reviewed_at=call.reviewed_at,
                is_flagged=call.is_flagged,
                flagged_by=call.flagged_by,
                flagged_at=call.flagged_at,
                created_at=call.created_at,
                updated_at=call.updated_at,
                display_data=display,
                vapi_data=item["vapi_data"],
                extraction_data=item["extraction_data"],
                extraction_status=call.extraction_status.value if call.extraction_status else None,
                relevance_score=item["relevance"],
                is_top_result=is_top,
            )
        )

    return call_responses


def decrypt_extraction_data(call: Call) -> Optional[Dict[str, Any]]:
    if call.extraction_data_encrypted is None or call.extraction_data_kid is None:
        return None
    decrypted = decrypt_for_display(call.extraction_data_encrypted, call.extraction_data_kid)
    if decrypted is None:
        return None
    return json.loads(decrypted)


def decrypt_display_data(call: Call) -> Optional[Dict[str, Any]]:
    if call.display_data_encrypted is None or call.display_data_kid is None:
        return None
    decrypted = decrypt_for_display(call.display_data_encrypted, call.display_data_kid)
    if decrypted is None:
        return None
    return json.loads(decrypted)


def build_display_data(
    vapi_data: Optional[Dict[str, Any]] = None,
    extraction_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    display: Dict[str, Any] = {}

    if vapi_data:
        call_obj = vapi_data.get("call", {})
        customer = call_obj.get("customer", {})
        display["phone_number"] = customer.get("number") or ""
        display["duration_seconds"] = (
            call_obj.get("durationSeconds") or vapi_data.get("durationSeconds")
        )

        analysis = vapi_data.get("analysis", {})
        structured = analysis.get("structuredData", {})
        display["caller_name"] = structured.get("caller_name") or ""
        display["patient_name"] = (
            structured.get("patient_name") or structured.get("subject_name") or ""
        )
        display["caller_affiliation"] = structured.get("caller_affiliation") or ""
        display["provider_name"] = structured.get("provider_name") or ""
        display["primary_intent"] = structured.get("primary_intent") or ""
        display["priority"] = (
            structured.get("priority") or structured.get("priority_level") or ""
        )
        display["summary"] = (
            structured.get("summary") or structured.get("free_text_summary") or ""
        )

    if extraction_data:
        for field in [
            "caller_name",
            "patient_name",
            "caller_affiliation",
            "provider_name",
            "primary_intent",
            "priority",
            "summary",
        ]:
            value = extraction_data.get(field)
            if value:
                display[field] = value

        call_teams = extraction_data.get("call_teams")
        if call_teams is not None:
            display["call_teams"] = call_teams

    return display


async def store_display_data(
    db: AsyncSession, call: Call, display_data: Dict[str, Any]
) -> None:
    encrypted_data, kid = encrypt_for_storage(json.dumps(display_data))
    call.display_data_encrypted = encrypted_data
    call.display_data_kid = kid
    await db.commit()
    await db.refresh(call)


async def store_extraction_data(
    db: AsyncSession, call: Call, extraction_data: Dict[str, Any]
) -> None:
    encrypted_data, kid = encrypt_for_storage(json.dumps(extraction_data))
    call.extraction_data_encrypted = encrypted_data
    call.extraction_data_kid = kid
    await db.commit()
    await db.refresh(call)


async def update_extraction_status(
    db: AsyncSession, call: Call, status: ExtractionStatus
) -> None:
    call.extraction_status = status
    await db.commit()
    await db.refresh(call)


async def update_call_teams(
    db: AsyncSession,
    call_id: uuid.UUID,
    call_teams: List[str],
) -> Optional[Call]:
    call = await get_call_by_id(db, call_id)
    if call is None:
        return None

    extraction_data = decrypt_extraction_data(call) or {}
    extraction_data["call_teams"] = call_teams
    await store_extraction_data(db, call, extraction_data)

    display_data = decrypt_display_data(call) or {}
    display_data["call_teams"] = call_teams
    await store_display_data(db, call, display_data)

    return call

