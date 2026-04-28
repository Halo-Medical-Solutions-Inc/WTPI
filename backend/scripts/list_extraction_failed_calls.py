"""List calls where extraction failed (extraction_status = FAILED)."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select

from app.database.session import AsyncSessionLocal
from app.models.call import Call, ExtractionStatus
from app.services import call_service


async def list_extraction_failed_calls() -> None:
    """Query and list calls where extraction failed to generate."""
    print("Querying calls with extraction_status = FAILED...")
    print("-" * 80)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Call)
            .where(
                Call.extraction_status == ExtractionStatus.FAILED,
                Call.deleted_at.is_(None),
            )
            .order_by(Call.created_at.desc())
        )
        calls = list(result.scalars().all())

    print(f"Found {len(calls)} call(s) with extraction failed")
    print("-" * 80)

    for call in calls:
        vapi_data = call_service.decrypt_vapi_data(call) or {}
        ended_reason = vapi_data.get("endedReason", "")
        was_transferred = ended_reason == "assistant-forwarded-call"
        phone = vapi_data.get("call", {}).get("customer", {}).get("number", "N/A")

        print(f"Call ID: {call.id}")
        print(f"  Created: {call.created_at}")
        print(f"  Status: {call.status.value}")
        print(f"  Is Reviewed: {call.is_reviewed}")
        print(f"  Phone: {phone}")
        print(f"  Ended Reason: {ended_reason}")
        print(f"  Was Transferred: {was_transferred}")
        print("-" * 40)

    print(f"\nTotal: {len(calls)} extraction-failed calls")


if __name__ == "__main__":
    asyncio.run(list_extraction_failed_calls())
