from datetime import datetime
from typing import Any, Dict, List
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Request

from app.utils.business_hours import get_time_period, is_off_hours
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database.session import get_db
from app.models.call import CallStatus
from app.prompts import build_time_aware_prompt
from app.services import (
    call_completion_service,
    call_service,
    practice_service,
    publisher_service,
)

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.get("/off-hours")
async def off_hours() -> Dict[str, Any]:
    if is_off_hours():
        return {
            "status": "CLOSED",
            "message": "The office is currently closed. Do NOT transfer the call.",
        }
    return {
        "status": "OPEN",
        "message": "The office is currently open. You may transfer the call.",
    }


@router.post("/twilio/inbound")
async def twilio_inbound(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    form_data = await request.form()
    call_sid = form_data.get("CallSid", "")
    from_number = form_data.get("From", "")

    if not call_sid:
        twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Invalid request</Say><Hangup/></Response>'
        return Response(content=twiml, media_type="application/xml")

    call = await call_service.create_call(db, str(call_sid), number=str(from_number))

    allocated, queue_position = await practice_service.try_allocate_concurrency(
        db, call.id
    )

    if not allocated:
        await call_service.mark_call_failed(db, call.id)
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>We are currently experiencing high call volume. You are number {queue_position} in the queue. Please hold or call back later.</Say>
    <Hangup/>
</Response>"""
        return Response(content=twiml, media_type="application/xml")

    await publisher_service.publish_event(
        "call_created",
        {
            "id": str(call.id),
            "twilio_call_sid": call.twilio_call_sid,
            "status": call.status.value,
            "created_at": call.created_at.isoformat(),
        },
    )

    twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Redirect method="POST">https://api.vapi.ai/twilio/inbound_call</Redirect>
</Response>"""

    return Response(content=twiml, media_type="application/xml")


@router.post("/vapi")
async def vapi_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    try:
        body = await request.json()
    except Exception:
        return {"success": False, "message": "Invalid JSON"}

    message_type = body.get("message", {}).get("type", "")

    if message_type == "assistant-request":
        return await _handle_assistant_request(db, body)

    if message_type == "end-of-call-report":
        await _handle_end_of_call(db, body)
        return {"success": True}

    if message_type == "status-update":
        await _handle_status_update(db, body)
        return {"success": True}

    if message_type == "tool-calls":
        return _handle_tool_calls(body)

    return {"success": True}


def _build_model_override(prompt: str) -> Dict[str, Any]:
    return {
        "provider": "openai",
        "model": "gpt-5.2-chat-latest",
        "toolIds": [],
        "messages": [{"role": "system", "content": prompt}],
    }


_VOICE_OVERRIDE: Dict[str, Any] = {
    "provider": "11labs",
    "voiceId": "uMM5TEnpKKgD758knVJO",
    "model": "eleven_multilingual_v2",
}


_FIRST_MESSAGE_AUDIO: Dict[str, str] = {
    "regular": "first-message.wav",
    "lunch": "first-message-lunch.wav",
    "after_hours": "first-message-after-hours.wav",
}


def _first_message_url(time_period: str) -> str:
    base_url = settings.FRONTEND_URL.rstrip("/")
    audio_file = _FIRST_MESSAGE_AUDIO.get(
        time_period, _FIRST_MESSAGE_AUDIO["regular"]
    )
    return f"{base_url}/{audio_file}"


async def _handle_assistant_request(
    db: AsyncSession, body: Dict[str, Any]
) -> Dict[str, Any]:
    time_period = get_time_period()
    audio_url = _first_message_url(time_period)

    prompt = build_time_aware_prompt(time_period=time_period)

    overrides: Dict[str, Any] = {
        "model": _build_model_override(prompt),
        "voice": _VOICE_OVERRIDE,
        "firstMessage": audio_url,
    }

    return {
        "assistantId": settings.VAPI_ASSISTANT_ID,
        "assistantOverrides": overrides,
    }


async def _handle_end_of_call(db: AsyncSession, body: Dict[str, Any]) -> None:
    message = body.get("message", {})
    call_data = message.get("call", {})
    vapi_call_id = call_data.get("id", "")

    if not vapi_call_id:
        print("VAPI end-of-call: missing call ID")
        return

    call = await call_service.find_call_by_vapi_id(db, vapi_call_id)
    if call is None:
        print(f"VAPI end-of-call: call not found for VAPI ID {vapi_call_id}")
        return

    await call_completion_service.complete_call_with_vapi_data(db, call.id, message)


def _handle_tool_calls(body: Dict[str, Any]) -> Dict[str, Any]:
    message = body.get("message", {})
    tool_call_list: List[Dict[str, Any]] = message.get("toolCallList", [])

    results = []
    for tool_call in tool_call_list:
        tool_call_id = tool_call.get("id", "")
        function_info = tool_call.get("function", {})
        function_name = function_info.get("name", "")

        if function_name == "get_current_time":
            result = _get_current_time_result()
        else:
            result = f"Unknown tool: {function_name}"

        results.append({"toolCallId": tool_call_id, "result": result})

    return {"results": results}


def _get_current_time_result() -> str:
    pacific = ZoneInfo("America/Los_Angeles")
    now = datetime.now(pacific)

    day_name = now.strftime("%A")
    date_str = now.strftime("%B %d, %Y")
    time_str = now.strftime("%I:%M %p").lstrip("0")

    is_weekday = now.weekday() < 5
    is_business_hours = is_weekday and 9 <= now.hour < 17

    if is_business_hours:
        status = "The office is currently OPEN."
    elif is_weekday and now.hour < 9:
        status = "The office is currently CLOSED. It opens today at 9:00 AM PST."
    elif is_weekday and now.hour >= 17:
        next_day = "Monday" if now.weekday() == 4 else "tomorrow"
        status = f"The office is currently CLOSED. It opens next on {next_day} at 9:00 AM PST."
    else:
        status = "The office is currently CLOSED (weekend). It opens Monday at 9:00 AM PST."

    return f"{day_name}, {date_str}, {time_str} PST. {status}"


async def _handle_status_update(db: AsyncSession, body: Dict[str, Any]) -> None:
    message = body.get("message", {})
    call_data = message.get("call", {})
    vapi_call_id = call_data.get("id", "")
    status = message.get("status", "")

    phone_call_provider_id = call_data.get("phoneCallProviderId", "")
    if phone_call_provider_id:
        call = await call_service.find_call_by_twilio_sid(db, phone_call_provider_id)
        if call and not call.vapi_call_id:
            updated_call = await call_service.update_call_with_vapi_id(
                db, call.id, vapi_call_id
            )
            print(f"Linked VAPI call {vapi_call_id} to Twilio call {phone_call_provider_id}")

            if updated_call:
                await publisher_service.publish_event(
                    "call_updated",
                    {
                        "id": str(updated_call.id),
                        "vapi_call_id": updated_call.vapi_call_id,
                        "status": updated_call.status.value,
                        "updated_at": updated_call.updated_at.isoformat()
                        if updated_call.updated_at
                        else None,
                    },
                )
