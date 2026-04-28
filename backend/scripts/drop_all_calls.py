import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import delete

from app.database.session import AsyncSessionLocal
from app.models.call import Call


async def drop_all_calls(db) -> None:
    """Delete all calls from the database."""
    # Count calls before deletion
    from sqlalchemy import select, func
    count_result = await db.execute(select(func.count(Call.id)))
    count = count_result.scalar_one()
    
    if count == 0:
        print("No calls found in the database.")
        return
    
    print(f"Found {count} call(s) in the database.")
    
    # Delete all calls
    await db.execute(delete(Call))
    await db.commit()
    
    print(f"Successfully deleted {count} call(s) from the database.")


async def main() -> None:
    print("Dropping all calls from the database...")
    print("-" * 40)
    
    async with AsyncSessionLocal() as db:
        await drop_all_calls(db)
    
    print("-" * 40)
    print("Operation complete!")


if __name__ == "__main__":
    asyncio.run(main())
