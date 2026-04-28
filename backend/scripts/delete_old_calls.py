import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import delete, select, func

from app.database.session import AsyncSessionLocal
from app.models.call import Call


async def delete_calls_before_date(db, cutoff_date: datetime) -> None:
    """Delete all calls created before the specified date."""
    # Count calls before deletion
    count_result = await db.execute(
        select(func.count(Call.id)).where(Call.created_at < cutoff_date)
    )
    count = count_result.scalar_one()
    
    if count == 0:
        print(f"No calls found before {cutoff_date.strftime('%Y-%m-%d')}.")
        return
    
    print(f"Found {count} call(s) created before {cutoff_date.strftime('%Y-%m-%d')}.")
    
    # Delete calls before the cutoff date
    await db.execute(delete(Call).where(Call.created_at < cutoff_date))
    await db.commit()
    
    print(f"Successfully deleted {count} call(s) from the database.")


async def main() -> None:
    # Set cutoff date to January 28, 2026 at 00:00:00 UTC
    cutoff_date = datetime(2026, 1, 28, 0, 0, 0, tzinfo=timezone.utc)
    
    print("Deleting calls created before January 28, 2026...")
    print("-" * 40)
    print(f"Cutoff date: {cutoff_date.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    print("-" * 40)
    
    async with AsyncSessionLocal() as db:
        await delete_calls_before_date(db, cutoff_date)
    
    print("-" * 40)
    print("Operation complete!")


if __name__ == "__main__":
    asyncio.run(main())
