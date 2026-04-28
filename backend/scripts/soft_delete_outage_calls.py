"""Soft-delete failed calls from an outage window (extraction failed or call status FAILED)."""

import argparse
import asyncio
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, update, or_

from app.database.session import AsyncSessionLocal
from app.models.call import Call, CallStatus, ExtractionStatus


async def soft_delete_outage_calls(hours: int = 1) -> int:
    """Soft-delete failed calls from the last N hours. Returns count of deleted calls."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=hours)

    async with AsyncSessionLocal() as session:
        # Find failed calls in the window (not already deleted)
        count_query = (
            select(Call)
            .where(
                Call.deleted_at.is_(None),
                Call.created_at >= cutoff,
                Call.created_at <= now,
                or_(
                    Call.extraction_status == ExtractionStatus.FAILED,
                    Call.status == CallStatus.FAILED,
                ),
            )
        )
        result = await session.execute(count_query)
        calls = list(result.scalars().all())
        count = len(calls)

        if count == 0:
            return 0

        now_ts = datetime.now(timezone.utc)
        stmt = (
            update(Call)
            .where(
                Call.deleted_at.is_(None),
                Call.created_at >= cutoff,
                Call.created_at <= now,
                or_(
                    Call.extraction_status == ExtractionStatus.FAILED,
                    Call.status == CallStatus.FAILED,
                ),
            )
            .values(deleted_at=now_ts)
        )
        await session.execute(stmt)
        await session.commit()

        return count


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Soft-delete failed calls from an outage window"
    )
    parser.add_argument(
        "--hours",
        type=int,
        default=1,
        help="Number of hours to look back (default: 1)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Count matching calls without deleting",
    )
    args = parser.parse_args()

    async def run() -> None:
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(hours=args.hours)
        print(
            f"Outage window: last {args.hours} hour(s) "
            f"({cutoff.strftime('%Y-%m-%d %H:%M')} to {now.strftime('%Y-%m-%d %H:%M')} UTC)"
        )
        print("Criteria: extraction_status=FAILED OR status=FAILED")
        print("-" * 60)

        if args.dry_run:
            async with AsyncSessionLocal() as session:
                from sqlalchemy import func

                r = await session.execute(
                    select(func.count(Call.id)).where(
                        Call.deleted_at.is_(None),
                        Call.created_at >= cutoff,
                        Call.created_at <= now,
                        or_(
                            Call.extraction_status == ExtractionStatus.FAILED,
                            Call.status == CallStatus.FAILED,
                        ),
                    )
                )
                count = r.scalar_one()
            print(f"DRY RUN: Would soft-delete {count} call(s)")
            return

        count = await soft_delete_outage_calls(hours=args.hours)
        if count == 0:
            print("No failed calls found in the window.")
        else:
            print(f"Successfully soft-deleted {count} call(s)")

    asyncio.run(run())


if __name__ == "__main__":
    main()
