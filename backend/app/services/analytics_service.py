import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.call import Call, CallStatus
from app.models.user import User
from app.schemas.analytics import (
    AnalyticsCards,
    AnalyticsPeriod,
    AnalyticsResponse,
    DoctorBreakdownItem,
    PerformerStats,
    SankeyByDoctor,
    SankeyByIntent,
    SankeyData,
)
from app.services.call_service import decrypt_extraction_data, decrypt_vapi_data

SYSTEM_AUTO_REVIEW_UUID = uuid.UUID("9dd1b08b-7c96-4447-9f33-3c425319cefb")

EXTENSION_LABELS: Dict[str, str] = {}

PHONE_NUMBER_LABELS: Dict[str, str] = {
    "9153134443": "West Texas Pain Institute",
    "19153134443": "West Texas Pain Institute",
    "9156212512": "West Texas Pain Institute (AI Line)",
    "19156212512": "West Texas Pain Institute (AI Line)",
}


async def _get_provider_names_list(db: AsyncSession) -> List[str]:
    return [
        "Dr. Raul Lopez",
        "Ilyana Yee, NP",
        "Monica Ogaz, NP",
        "Lucia Fisher, NP",
        "Amanda Lopez, PA",
    ]


def _get_call_duration(vapi_data: Optional[Dict[str, Any]]) -> Optional[float]:
    if not vapi_data:
        return None
    duration = vapi_data.get("durationSeconds")
    if duration is not None:
        return float(duration)
    call_obj = vapi_data.get("call", {})
    if isinstance(call_obj, dict):
        duration = call_obj.get("durationSeconds")
        if duration is not None:
            return float(duration)
    return None


def _get_provider_name(
    extraction_data: Optional[Dict[str, Any]],
    vapi_data: Optional[Dict[str, Any]],
) -> str:
    if extraction_data:
        name = extraction_data.get("provider_name")
        if name:
            return name
    if vapi_data:
        analysis = vapi_data.get("analysis", {})
        if isinstance(analysis, dict):
            structured = analysis.get("structuredData", {})
            if isinstance(structured, dict):
                name = structured.get("provider_name")
                if name:
                    return name
    return "Not Provided"


def _get_primary_intent(
    extraction_data: Optional[Dict[str, Any]],
    vapi_data: Optional[Dict[str, Any]],
) -> str:
    if extraction_data:
        intent = extraction_data.get("primary_intent")
        if intent and intent != "Not Provided":
            return intent
    if vapi_data:
        analysis = vapi_data.get("analysis", {})
        if isinstance(analysis, dict):
            structured = analysis.get("structuredData", {})
            if isinstance(structured, dict):
                intent = structured.get("primary_intent")
                if intent and intent != "Not Provided":
                    return intent
    return "Unknown"


def _is_transferred(vapi_data: Optional[Dict[str, Any]]) -> bool:
    if not vapi_data:
        return False
    return vapi_data.get("endedReason") == "assistant-forwarded-call"


def _get_transfer_extension_label(vapi_data: Optional[Dict[str, Any]]) -> str:
    if not vapi_data:
        return "Unknown"

    messages = vapi_data.get("artifact", {}).get("messages", []) or vapi_data.get(
        "messages", []
    )
    transfer_call = None

    for msg in messages:
        if msg.get("role") == "tool_calls":
            for tool_call in msg.get("toolCalls", []):
                if (
                    tool_call.get("function", {}).get("name")
                    == "transfer_call_tool"
                ):
                    transfer_call = tool_call
                    break
        if transfer_call:
            break

    if transfer_call and transfer_call.get("function", {}).get("arguments"):
        try:
            args = json.loads(transfer_call["function"]["arguments"])
            destination = args.get("destination", "")
            destination_parts = destination.split(",")
            number = destination_parts[0] if destination_parts else ""
            extension = (
                destination_parts[1] if len(destination_parts) > 1 else ""
            )
            if extension:
                return EXTENSION_LABELS.get(extension, f"Ext {extension}")
            normalized_number = "".join(c for c in number if c.isdigit())
            return (
                PHONE_NUMBER_LABELS.get(normalized_number)
                or PHONE_NUMBER_LABELS.get(normalized_number[-10:])
                or "Main Line"
            )
        except Exception:
            return "Unknown"

    return "Unknown"


def _categorize_intent(intent: str) -> str:
    if not intent or intent == "Unknown":
        return "Uncategorized"

    lower = intent.lower()

    if "appointment" in lower:
        return "Appointments"
    if "prescription" in lower or "refill" in lower:
        return "Prescription Refills"
    if "test" in lower or "result" in lower:
        return "Test Results"
    if "referral" in lower:
        return "Referral Requests"
    if "medical record" in lower:
        return "Medical Records"
    if "billing" in lower or "insurance" in lower:
        return "Billing/Insurance"
    if "speak" in lower or "staff" in lower:
        return "Speak to Staff"
    if "symptom" in lower:
        return "Report Symptoms"
    if "prior" in lower or "authorization" in lower:
        return "Prior Authorization"
    if "spam" in lower or "wrong" in lower:
        return "Spam/Wrong Number"
    if "other" in lower:
        return "Other"

    return "Uncategorized"


async def get_analytics(
    db: AsyncSession,
    start_dt: datetime,
    end_dt: datetime,
) -> AnalyticsResponse:
    all_doctor_names = await _get_provider_names_list(db)

    query = select(Call).where(
        Call.deleted_at.is_(None),
        Call.status == CallStatus.COMPLETED,
        Call.created_at >= start_dt,
        Call.created_at <= end_dt,
    )
    result = await db.execute(query)
    calls = list(result.scalars().all())

    total_calls = len(calls)
    total_duration_seconds = 0.0
    duration_count = 0
    reviewed_count = 0
    review_times: List[float] = []

    doctor_stats: Dict[str, List[Dict[str, Any]]] = {}
    non_transferred_intent_counts: Dict[str, int] = {}
    non_transferred_doctor_counts: Dict[str, int] = {}
    all_doctor_counts: Dict[str, int] = {}
    transferred_extension_counts: Dict[str, int] = {}
    transferred_count = 0
    auto_reviewed_count = 0
    reviewer_ids: set[uuid.UUID] = set()

    for call in calls:
        vapi_data = decrypt_vapi_data(call)
        extraction_data = decrypt_extraction_data(call)

        duration = _get_call_duration(vapi_data)
        if duration is not None:
            total_duration_seconds += duration
            duration_count += 1

        if call.is_reviewed:
            reviewed_count += 1
            is_auto = call.reviewed_by == SYSTEM_AUTO_REVIEW_UUID
            if not is_auto and call.reviewed_at and call.created_at:
                diff_minutes = (call.reviewed_at - call.created_at).total_seconds() / 60.0
                review_times.append(diff_minutes)
            if call.reviewed_by:
                reviewer_ids.add(call.reviewed_by)

        provider = _get_provider_name(extraction_data, vapi_data)
        intent = _get_primary_intent(extraction_data, vapi_data)
        category = _categorize_intent(intent)
        was_transferred = _is_transferred(vapi_data)

        if provider not in doctor_stats:
            doctor_stats[provider] = []
        doctor_stats[provider].append({
            "is_reviewed": call.is_reviewed,
            "reviewed_by": call.reviewed_by,
            "review_time_minutes": (
                (call.reviewed_at - call.created_at).total_seconds() / 60.0
                if call.is_reviewed
                and call.reviewed_by != SYSTEM_AUTO_REVIEW_UUID
                and call.reviewed_at
                and call.created_at
                else None
            ),
            "duration_seconds": duration,
        })

        is_auto_reviewed = (
            call.is_reviewed and call.reviewed_by == SYSTEM_AUTO_REVIEW_UUID
        )

        if was_transferred:
            transferred_count += 1
            extension_label = _get_transfer_extension_label(vapi_data)
            transferred_extension_counts[extension_label] = (
                transferred_extension_counts.get(extension_label, 0) + 1
            )
        else:
            non_transferred_intent_counts[category] = (
                non_transferred_intent_counts.get(category, 0) + 1
            )

        if is_auto_reviewed:
            auto_reviewed_count += 1

        all_doctor_counts[provider] = all_doctor_counts.get(provider, 0) + 1

        if not was_transferred:
            non_transferred_doctor_counts[provider] = (
                non_transferred_doctor_counts.get(provider, 0) + 1
            )

    user_name_map: Dict[uuid.UUID, str] = {}
    human_reviewer_ids = {uid for uid in reviewer_ids if uid != SYSTEM_AUTO_REVIEW_UUID}
    if human_reviewer_ids:
        users_result = await db.execute(
            select(User).where(User.id.in_(human_reviewer_ids))
        )
        for u in users_result.scalars().all():
            user_name_map[u.id] = u.full_name
    user_name_map[SYSTEM_AUTO_REVIEW_UUID] = "Auto-Review"

    avg_duration = total_duration_seconds / duration_count if duration_count > 0 else 0.0
    review_rate = reviewed_count / total_calls if total_calls > 0 else 0.0
    avg_review_time = sum(review_times) / len(review_times) if review_times else 0.0

    cards = AnalyticsCards(
        total_calls=total_calls,
        avg_call_duration_seconds=round(avg_duration, 1),
        review_completion_rate=round(review_rate, 4),
        avg_review_time_minutes=round(avg_review_time, 1),
    )

    sankey = SankeyData(
        by_intent=SankeyByIntent(
            total=total_calls,
            transferred=transferred_count,
            transferred_extensions=transferred_extension_counts,
            non_transferred_intents=non_transferred_intent_counts,
        ),
        by_doctor=SankeyByDoctor(
            total=total_calls,
            auto_reviewed=auto_reviewed_count,
            transferred=transferred_count,
            transferred_extensions=transferred_extension_counts,
            non_transferred_doctors=non_transferred_doctor_counts,
            all_doctors=all_doctor_counts,
        ),
    )

    doctor_breakdown: List[DoctorBreakdownItem] = []

    for doc_name in all_doctor_names:
        doc_data = doctor_stats.get(doc_name, [])
        doc_total = len(doc_data)
        doc_reviewed = sum(1 for c in doc_data if c["is_reviewed"])
        doc_nr = doc_total - doc_reviewed
        doc_review_rate = doc_reviewed / doc_total if doc_total > 0 else 0.0

        doc_review_times = [
            c["review_time_minutes"] for c in doc_data if c["review_time_minutes"] is not None
        ]
        doc_avg_review = (
            round(sum(doc_review_times) / len(doc_review_times), 1) if doc_review_times else None
        )

        reviewer_counts: Dict[Optional[uuid.UUID], int] = {}
        for c in doc_data:
            if c["is_reviewed"]:
                rid = c.get("reviewed_by")
                reviewer_counts[rid] = reviewer_counts.get(rid, 0) + 1

        performers: List[PerformerStats] = []
        for rid, count in sorted(reviewer_counts.items(), key=lambda x: x[1], reverse=True):
            if rid is None:
                name = "Auto-Review"
            else:
                name = user_name_map.get(rid, "Unknown")
            pct = round((count / doc_reviewed * 100) if doc_reviewed > 0 else 0.0, 1)
            performers.append(PerformerStats(user_name=name, reviews=count, percentage=pct))

        doctor_breakdown.append(
            DoctorBreakdownItem(
                doctor_name=doc_name,
                total_calls=doc_total,
                review_completion_rate=round(doc_review_rate, 4),
                avg_review_time_minutes=doc_avg_review,
                needs_review=doc_nr,
                reviewed=doc_reviewed,
                performers=performers,
            )
        )

    doctor_breakdown.sort(key=lambda d: d.total_calls, reverse=True)

    return AnalyticsResponse(
        period=AnalyticsPeriod(
            start=start_dt.isoformat(),
            end=end_dt.isoformat(),
        ),
        cards=cards,
        sankey=sankey,
        doctor_breakdown=doctor_breakdown,
    )


async def get_sankey_calls(
    db: AsyncSession,
    start_dt: datetime,
    end_dt: datetime,
    filter_type: str,
    filter_value: str,
) -> List[Call]:
    query = select(Call).where(
        Call.deleted_at.is_(None),
        Call.status == CallStatus.COMPLETED,
        Call.created_at >= start_dt,
        Call.created_at <= end_dt,
    )
    result = await db.execute(query)
    calls = list(result.scalars().all())

    matched: List[Call] = []
    for call in calls:
        vapi_data = decrypt_vapi_data(call)
        extraction_data = decrypt_extraction_data(call)
        was_transferred = _is_transferred(vapi_data)

        if filter_type == "extension":
            if not was_transferred:
                continue
            label = _get_transfer_extension_label(vapi_data)
            if label == filter_value:
                matched.append(call)

        elif filter_type == "intent":
            if was_transferred:
                continue
            intent = _get_primary_intent(extraction_data, vapi_data)
            category = _categorize_intent(intent)
            if category == filter_value:
                matched.append(call)

        elif filter_type == "doctor":
            provider = _get_provider_name(extraction_data, vapi_data)
            if provider == filter_value:
                matched.append(call)

    matched.sort(key=lambda c: c.created_at, reverse=True)
    return matched
