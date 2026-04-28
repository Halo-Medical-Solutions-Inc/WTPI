import asyncio
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import func, select, text

from app.database.session import AsyncSessionLocal
from app.models.call import Call
from app.services import call_service


async def diagnose() -> None:
    print("=" * 80)
    print("Call Query Diagnostic")
    print("=" * 80)

    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday = today - timedelta(days=1)
    seven_days_ago = today - timedelta(days=7)
    eight_days_ago = today - timedelta(days=8)

    async with AsyncSessionLocal() as db:
        # Total call counts
        total_result = await db.execute(
            select(func.count()).select_from(Call)
        )
        total = total_result.scalar()
        print(f"\nTotal calls in DB (including soft-deleted): {total}")

        active_result = await db.execute(
            select(func.count()).select_from(Call).where(Call.deleted_at.is_(None))
        )
        active = active_result.scalar()
        print(f"Active calls (not soft-deleted): {active}")

        deleted_result = await db.execute(
            select(func.count()).select_from(Call).where(Call.deleted_at.isnot(None))
        )
        deleted = deleted_result.scalar()
        print(f"Soft-deleted calls: {deleted}")

        # Calls per day for last 14 days
        print(f"\n--- Calls per day (last 14 days, active only) ---")
        for i in range(14):
            day_start = today - timedelta(days=i)
            day_end = day_start + timedelta(days=1)
            count_result = await db.execute(
                select(func.count()).select_from(Call).where(
                    Call.deleted_at.is_(None),
                    Call.created_at >= day_start,
                    Call.created_at < day_end,
                )
            )
            count = count_result.scalar()
            label = "TODAY" if i == 0 else ("YESTERDAY" if i == 1 else "")
            print(f"  {day_start.strftime('%Y-%m-%d')}: {count} calls  {label}")

        # Time the "today" range (last 7 days ending today)
        print(f"\n--- Query timing: 'Today' view (last 7 days: {seven_days_ago.date()} to {now.date()}) ---")
        t0 = time.perf_counter()
        today_calls = await call_service.get_calls(
            db, start_date=seven_days_ago, end_date=now,
        )
        t1 = time.perf_counter()
        print(f"  DB query: {len(today_calls)} calls in {(t1-t0)*1000:.1f}ms")

        # Time decryption
        t2 = time.perf_counter()
        for call in today_calls:
            call_service.decrypt_display_data(call)
        t3 = time.perf_counter()
        print(f"  Decrypt display_data: {(t3-t2)*1000:.1f}ms ({len(today_calls)} calls)")

        # Time the "yesterday" range (last 7 days ending yesterday)
        end_of_yesterday = yesterday + timedelta(days=1) - timedelta(microseconds=1)
        print(f"\n--- Query timing: 'Yesterday' view (7 days: {eight_days_ago.date()} to {yesterday.date()}) ---")
        t0 = time.perf_counter()
        yesterday_calls = await call_service.get_calls(
            db, start_date=eight_days_ago, end_date=end_of_yesterday,
        )
        t1 = time.perf_counter()
        print(f"  DB query: {len(yesterday_calls)} calls in {(t1-t0)*1000:.1f}ms")

        t2 = time.perf_counter()
        for call in yesterday_calls:
            call_service.decrypt_display_data(call)
        t3 = time.perf_counter()
        print(f"  Decrypt display_data: {(t3-t2)*1000:.1f}ms ({len(yesterday_calls)} calls)")

        # Check for calls with very large encrypted data
        print(f"\n--- Large encrypted data check ---")
        large_calls = await db.execute(
            select(
                Call.id,
                func.length(Call.display_data_encrypted).label("display_len"),
                func.length(Call.vapi_data_encrypted).label("vapi_len"),
                func.length(Call.extraction_data_encrypted).label("extract_len"),
            )
            .where(Call.deleted_at.is_(None))
            .order_by(func.length(Call.display_data_encrypted).desc().nulls_last())
            .limit(5)
        )
        rows = large_calls.all()
        for row in rows:
            print(f"  Call {row.id}: display={row.display_len or 0}B, vapi={row.vapi_len or 0}B, extraction={row.extract_len or 0}B")

        # Check DB-level query plan
        print(f"\n--- PostgreSQL EXPLAIN for yesterday query ---")
        explain_result = await db.execute(
            text(
                f"EXPLAIN ANALYZE SELECT * FROM calls "
                f"WHERE deleted_at IS NULL "
                f"AND created_at >= '{eight_days_ago.isoformat()}' "
                f"AND created_at <= '{end_of_yesterday.isoformat()}' "
                f"ORDER BY created_at DESC"
            )
        )
        for row in explain_result:
            print(f"  {row[0]}")

    print("\n" + "=" * 80)
    print("Done!")


if __name__ == "__main__":
    asyncio.run(diagnose())
