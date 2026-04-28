"""
One-off script: find calls IN_PROGRESS for more than 10 minutes,
mark them failed, release concurrency, and set is_reviewed=True (auto-review).
Also marks any already-FAILED unreviewed calls from the same window as reviewed.
"""
import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database.session import AsyncSessionLocal
from app.models.call import CallStatus
from app.services import call_completion_service, call_service


STALE_THRESHOLD_MINUTES = 10
FAIL_REASON = "Stale: in progress for more than 10 minutes"


async def main() -> None:
    async with AsyncSessionLocal() as db:
        stale = await call_service.get_stale_in_progress_calls(
            db, threshold_minutes=STALE_THRESHOLD_MINUTES
        )
        if stale:
            print(f"Found {len(stale)} call(s) in progress > {STALE_THRESHOLD_MINUTES} min. Failing and auto-reviewing.")
            for call in stale:
                print(f"  {call.id} (created {call.created_at})")
                await call_completion_service.fail_call(db, call.id, FAIL_REASON)
                await call_service.update_review_status(
                    db, call.id, is_reviewed=True, reviewed_by=None
                )
            print("Concurrency released for each failed call.")
        else:
            print("No calls in progress for more than 10 minutes.")

        # Mark any already-FAILED unreviewed calls (e.g. from a previous partial run) as reviewed
        threshold = datetime.now(timezone.utc) - timedelta(minutes=STALE_THRESHOLD_MINUTES)
        failed_unreviewed = await call_service.get_calls(
            db, end_date=threshold, status=CallStatus.FAILED, is_reviewed=False
        )
        if failed_unreviewed:
            print(f"Marking {len(failed_unreviewed)} already-failed unreviewed call(s) as reviewed.")
            for call in failed_unreviewed:
                await call_service.update_review_status(
                    db, call.id, is_reviewed=True, reviewed_by=None
                )
        print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
