import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, func

from app.database.session import AsyncSessionLocal
from app.models.call import Call, CallStatus


async def count_calls() -> None:
    """Count calls in the database and display statistics."""
    print("Querying calls from the database...")
    print("-" * 60)

    async with AsyncSessionLocal() as db:
        # Total calls (including deleted)
        total_result = await db.execute(select(func.count(Call.id)))
        total_count = total_result.scalar_one()

        # Active calls (not deleted)
        active_result = await db.execute(
            select(func.count(Call.id)).where(Call.deleted_at.is_(None))
        )
        active_count = active_result.scalar_one()

        # Deleted calls
        deleted_count = total_count - active_count

        print(f"Total calls: {total_count}")
        print(f"Active calls: {active_count}")
        print(f"Deleted calls: {deleted_count}")
        print("-" * 60)

        if active_count == 0:
            print("No active calls found in the database.")
            return

        # Count by status
        print("\nCalls by status:")
        for status in CallStatus:
            status_result = await db.execute(
                select(func.count(Call.id)).where(
                    Call.status == status, Call.deleted_at.is_(None)
                )
            )
            status_count = status_result.scalar_one()
            print(f"  {status.value}: {status_count}")

        # Count by reviewed status
        print("\nCalls by review status:")
        reviewed_result = await db.execute(
            select(func.count(Call.id)).where(
                Call.is_reviewed == True, Call.deleted_at.is_(None)
            )
        )
        reviewed_count = reviewed_result.scalar_one()

        not_reviewed_result = await db.execute(
            select(func.count(Call.id)).where(
                Call.is_reviewed == False, Call.deleted_at.is_(None)
            )
        )
        not_reviewed_count = not_reviewed_result.scalar_one()

        print(f"  Reviewed: {reviewed_count}")
        print(f"  Not reviewed: {not_reviewed_count}")

    print("-" * 60)
    print("Query complete!")


if __name__ == "__main__":
    asyncio.run(count_calls())
