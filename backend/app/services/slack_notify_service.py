import html
import re
import uuid

import httpx

from app.config import settings


def _preview_text(content: str, max_len: int) -> str:
    text = content
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</(p|div|h[1-6]|li|tr)\s*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    lines: list[str] = []
    for raw_line in text.split("\n"):
        line = re.sub(r"[ \t]+", " ", raw_line).strip()
        lines.append(line)
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text.strip()
    if len(text) > max_len:
        return text[: max_len - 1].rstrip() + "…"
    return text


def _first_name(full_name: str) -> str:
    parts = (full_name or "").strip().split(None, 1)
    return parts[0] if parts else "Someone"


def _safe_slack_plain(value: str) -> str:
    return re.sub(r"[*_`<>&|]", "", value).strip() or "—"


def _quoted_preview(preview: str) -> str:
    inner = preview.replace('"', "'")
    return f'"{inner}"'


def _messaging_slack_text(
    author_name: str,
    content: str,
    conversation_id: uuid.UUID,
) -> str:
    preview = _preview_text(content, 280)
    base = settings.FRONTEND_URL.rstrip("/")
    link = f"{base}/messages?conversation={conversation_id}"
    first = _safe_slack_plain(_first_name(author_name))
    practice = _safe_slack_plain(settings.FROM_NAME)
    quoted = _quoted_preview(preview)
    return (
        f"{practice} ({first})\n\n"
        f"{quoted}\n\n"
        f"→ <{link}|View in Halo>\n"
        f"<!channel>"
    )


async def _post_support_channel_text(text: str) -> None:
    token = settings.SLACK_BOT_TOKEN.strip()
    channel = settings.SLACK_SUPPORT_CHANNEL_ID.strip()
    if not token or not channel:
        return

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json; charset=utf-8",
    }
    payload = {
        "channel": channel,
        "text": text,
        "unfurl_links": False,
        "unfurl_media": False,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://slack.com/api/chat.postMessage",
                json=payload,
                headers=headers,
            )
    except httpx.RequestError as exc:
        print(f"Slack notify request error: {exc}")
        return

    try:
        data = response.json()
    except ValueError as exc:
        print(f"Slack notify invalid JSON: {exc}")
        return

    if response.status_code != 200:
        print(f"Slack notify HTTP {response.status_code}: {data}")
        return

    if not data.get("ok"):
        print(f"Slack chat.postMessage failed: {data.get('error')}")


async def notify_platform_support_message(
    author_name: str,
    content: str,
    conversation_id: uuid.UUID,
) -> None:
    text = _messaging_slack_text(author_name, content, conversation_id)
    await _post_support_channel_text(text)
