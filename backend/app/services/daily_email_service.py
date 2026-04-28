import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List

import pytz
import yagmail

from app.config import settings
from app.database.session import AsyncSessionLocal
from app.models.call import Call
from app.services import call_service, practice_service, user_service


REVIEW_WINDOW_DAYS = 7


def _format_phone_number(number: str) -> str:
    if number and len(number) == 12 and number.startswith("+1"):
        return f"({number[2:5]}) {number[5:8]}-{number[8:12]}"
    return number or ""


def _format_call_time(created_at: datetime, timezone: str) -> str:
    try:
        tz = pytz.timezone(timezone)
        local_time = created_at.astimezone(tz)
        return local_time.strftime("%b %d, %Y at %I:%M %p")
    except Exception:
        return created_at.strftime("%b %d, %Y at %I:%M %p")


def _build_team_section_html(
    team_title: str,
    calls: List[Dict[str, Any]],
) -> str:
    rows_html = ""
    for call_data in calls:
        call_time = call_data.get("time", "Unknown")
        caller_name = call_data.get("caller_name", "Unknown")
        phone_number = call_data.get("phone_number", "")
        summary = call_data.get("summary", "No summary available")
        call_id = call_data.get("call_id", "")

        view_link = (
            f"{settings.FRONTEND_URL}/search?call={call_id}"
            if call_id
            else f"{settings.FRONTEND_URL}/search"
        )

        rows_html += f'<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;">{caller_name}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">{phone_number}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">{call_time}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">{summary}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;"><a href="{view_link}" style="color:#2563eb;">Review</a></td></tr>'

    call_word = "call" if len(calls) == 1 else "calls"

    return f'''<div style="margin-bottom:24px;">
<p style="margin:0 0 8px 0;font-size:14px;font-weight:bold;color:#1f2937;border-bottom:2px solid #e5e7eb;padding-bottom:4px;">{team_title} &mdash; {len(calls)} {call_word} need review</p>
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px;">
<tr style="background:#f5f5f5;"><th style="padding:8px 12px;text-align:left;font-weight:600;border-bottom:1px solid #eee;">Name</th><th style="padding:8px 12px;text-align:left;font-weight:600;border-bottom:1px solid #eee;">Phone</th><th style="padding:8px 12px;text-align:left;font-weight:600;border-bottom:1px solid #eee;">Date &amp; Time</th><th style="padding:8px 12px;text-align:left;font-weight:600;border-bottom:1px solid #eee;">Summary</th><th style="padding:8px 12px;text-align:left;font-weight:600;border-bottom:1px solid #eee;"></th></tr>
{rows_html}
</table>
</div>'''


def _build_consolidated_email_html(
    teams_data: List[Dict[str, Any]],
    date_str: str,
) -> str:
    total_calls = sum(len(t["calls"]) for t in teams_data)
    call_word = "call" if total_calls == 1 else "calls"

    sections_html = ""
    for team_data in teams_data:
        sections_html += _build_team_section_html(
            team_data["team_title"],
            team_data["calls"],
        )

    return f'''<!DOCTYPE html><html><body style="margin:0;padding:8px;font-family:Arial,sans-serif;font-size:13px;color:#333;">
<p style="margin:0 0 4px 0;font-size:16px;font-weight:bold;">Daily Summary - {date_str}</p>
<p style="margin:0 0 16px 0;font-size:12px;color:#666;"><b>{total_calls}</b> {call_word} need review</p>
{sections_html}
<p style="margin:12px 0 0 0;font-size:11px;color:#999;">{settings.FROM_NAME}</p>
</body></html>'''


def _build_single_team_email_html(
    team_title: str,
    calls: List[Dict[str, Any]],
    date_str: str,
) -> str:
    return _build_consolidated_email_html(
        [{"team_title": team_title, "calls": calls}],
        date_str,
    )


def _build_team_section_text(
    team_title: str,
    calls: List[Dict[str, Any]],
) -> str:
    call_word = "call" if len(calls) == 1 else "calls"
    divider = "-" * 50

    calls_text = ""
    for i, call_data in enumerate(calls, 1):
        call_time = call_data.get("time", "Unknown")
        caller_name = call_data.get("caller_name", "Unknown")
        summary = call_data.get("summary", "No summary available")
        call_id = call_data.get("call_id", "")
        view_link = (
            f"{settings.FRONTEND_URL}/search?call={call_id}"
            if call_id
            else f"{settings.FRONTEND_URL}/search"
        )
        calls_text += f"""
{i}. {caller_name}
   {call_time}

   {summary}

   Review: {view_link}
"""

    return f"""{team_title} — {len(calls)} {call_word} need review
{divider}
{calls_text}
"""


def _build_consolidated_email_text(
    teams_data: List[Dict[str, Any]],
) -> str:
    total_calls = sum(len(t["calls"]) for t in teams_data)
    call_word = "call" if total_calls == 1 else "calls"
    divider = "=" * 50

    sections_text = ""
    for team_data in teams_data:
        sections_text += _build_team_section_text(
            team_data["team_title"],
            team_data["calls"],
        )
        sections_text += "\n"

    return f"""DAILY SUMMARY
{divider}

You have {total_calls} {call_word} that need review.

{divider}

{sections_text}
Sent by {settings.FROM_NAME}
"""


def _build_call_data(
    call: Call,
    timezone: str,
    display_data: Dict[str, Any],
) -> Dict[str, Any]:
    return {
        "call_id": str(call.id),
        "created_at": call.created_at,
        "time": _format_call_time(call.created_at, timezone),
        "caller_name": display_data.get("caller_name") or "Unknown",
        "phone_number": _format_phone_number(display_data.get("phone_number") or ""),
        "priority": display_data.get("priority") or "Medium",
        "summary": display_data.get("summary") or "No summary",
    }


async def send_daily_summary_emails() -> None:
    print("[DAILY EMAIL] Starting daily summary email job")

    async with AsyncSessionLocal() as db:
        practice = await practice_service.get_practice(db)
        if practice is None:
            print("[DAILY EMAIL] No practice configured, skipping")
            return

        timezone = practice.practice_region or "America/Los_Angeles"
        tz = pytz.timezone(timezone)
        now = datetime.now(tz)

        start_date = now - timedelta(days=REVIEW_WINDOW_DAYS)
        now_utc = now.astimezone(pytz.UTC)

        calls = await call_service.get_calls(
            db,
            start_date=start_date.astimezone(pytz.UTC),
            end_date=now_utc,
            is_reviewed=False,
            limit=5000,
        )

        if not calls:
            print("[DAILY EMAIL] No unreviewed calls found, skipping")
            return

        teams = await practice_service.get_teams(db)
        if not teams:
            print("[DAILY EMAIL] No teams configured, skipping")
            return

        team_id_to_title: Dict[str, str] = {t.id: t.title for t in teams}
        team_title_to_id: Dict[str, str] = {t.title: t.id for t in teams}

        calls_with_display: List[tuple[Call, Dict[str, Any]]] = []
        for call in calls:
            display_data = call_service.decrypt_display_data(call) or {}
            calls_with_display.append((call, display_data))

        calls_by_team: Dict[str, List[tuple[Call, Dict[str, Any]]]] = {}
        for call, display_data in calls_with_display:
            call_teams = display_data.get("call_teams") or []
            for team_name in call_teams:
                resolved_id = team_title_to_id.get(team_name)
                if not resolved_id:
                    continue
                if resolved_id not in calls_by_team:
                    calls_by_team[resolved_id] = []
                calls_by_team[resolved_id].append((call, display_data))

        user_to_teams: Dict[str, List[str]] = {}
        for team in teams:
            if not team.members:
                continue
            for user_id_str in team.members:
                if user_id_str not in user_to_teams:
                    user_to_teams[user_id_str] = []
                user_to_teams[user_id_str].append(team.id)

        date_str = now.strftime("%b %d, %Y")

        for user_id_str, team_ids in user_to_teams.items():
            try:
                user_uuid = uuid.UUID(user_id_str)
                user = await user_service.get_user_by_id(db, user_uuid)
                if not user or not user.email:
                    continue
            except Exception as e:
                print(f"[DAILY EMAIL] Error getting user {user_id_str}: {e}")
                continue

            teams_data: List[Dict[str, Any]] = []
            total_calls = 0

            for team_id in team_ids:
                team_calls = calls_by_team.get(team_id, [])
                if not team_calls:
                    continue

                call_data_list = [
                    _build_call_data(call, timezone, display_data)
                    for call, display_data in team_calls
                ]
                call_data_list.sort(key=lambda x: x["created_at"])

                team_title = team_id_to_title.get(team_id, "Unknown Team")
                teams_data.append({
                    "team_title": team_title,
                    "calls": call_data_list,
                })
                total_calls += len(call_data_list)

            if not teams_data:
                continue

            call_word = "call" if total_calls == 1 else "calls"
            subject = f"Daily Call Summary - {total_calls} {call_word} need review"
            html_content = _build_consolidated_email_html(teams_data, date_str)

            try:
                yag = yagmail.SMTP(settings.SMTP_EMAIL, settings.SMTP_PASSWORD)
                yag.send(
                    to=[user.email],
                    subject=subject,
                    contents=html_content,
                )
                team_names_str = ", ".join(t["team_title"] for t in teams_data)
                print(
                    f"[DAILY EMAIL] Sent consolidated summary to {user.email} "
                    f"({total_calls} calls across {len(teams_data)} teams: {team_names_str})"
                )
            except Exception as e:
                print(f"[DAILY EMAIL] Failed to send email to {user.email}: {e}")

    print("[DAILY EMAIL] Daily summary email job completed")


async def send_test_email_for_team(team_id: str, recipient_email: str) -> bool:
    print(f"[TEST EMAIL] Sending test email for team {team_id} to {recipient_email}")

    async with AsyncSessionLocal() as db:
        practice = await practice_service.get_practice(db)
        if practice is None:
            print("[TEST EMAIL] No practice configured")
            return False

        timezone = practice.practice_region or "America/Los_Angeles"
        tz = pytz.timezone(timezone)
        now = datetime.now(tz)

        teams = await practice_service.get_teams(db)
        team = next((t for t in teams if t.id == team_id), None)
        if team is None:
            print(f"[TEST EMAIL] Team {team_id} not found")
            return False

        start_date = now - timedelta(days=REVIEW_WINDOW_DAYS)
        now_utc = now.astimezone(pytz.UTC)

        calls = await call_service.get_calls(
            db,
            start_date=start_date.astimezone(pytz.UTC),
            end_date=now_utc,
            is_reviewed=False,
            limit=5000,
        )

        team_calls: List[tuple[Call, Dict[str, Any]]] = []
        for call in calls:
            display_data = call_service.decrypt_display_data(call) or {}
            call_teams = display_data.get("call_teams") or []
            if team.title in call_teams:
                team_calls.append((call, display_data))

        if not team_calls:
            call_data_list = [
                {
                    "call_id": "",
                    "created_at": now,
                    "time": _format_call_time(now, timezone),
                    "caller_name": "Test Caller",
                    "phone_number": "(555) 123-4567",
                    "priority": "Medium",
                    "summary": "This is a test email - no real unreviewed calls found.",
                }
            ]
        else:
            call_data_list = [
                _build_call_data(call, timezone, display_data)
                for call, display_data in team_calls
            ]

        call_data_list.sort(key=lambda x: x.get("created_at") or now)
        subject = f"[TEST] Daily Call Summary - {team.title} ({len(call_data_list)} calls)"
        date_str = now.strftime("%b %d, %Y")
        html_content = _build_single_team_email_html(team.title, call_data_list, date_str)

        try:
            yag = yagmail.SMTP(settings.SMTP_EMAIL, settings.SMTP_PASSWORD)
            yag.send(
                to=[recipient_email],
                subject=subject,
                contents=html_content,
            )
            print(f"[TEST EMAIL] Successfully sent test email to {recipient_email}")
            return True
        except Exception as e:
            print(f"[TEST EMAIL] Failed to send test email: {e}")
            return False
