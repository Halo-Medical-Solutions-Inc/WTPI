import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, update

from app.database.session import AsyncSessionLocal
from app.models.call import Call


async def undelete_all_calls() -> None:
    async with AsyncSessionLocal() as session:
        count_query = select(Call).where(Call.deleted_at.isnot(None))
        result = await session.execute(count_query)
        deleted_calls = list(result.scalars().all())

        print(f"Found {len(deleted_calls)} soft-deleted calls")

        if len(deleted_calls) == 0:
            print("No soft-deleted calls to restore")
            return

        stmt = update(Call).where(Call.deleted_at.isnot(None)).values(deleted_at=None)
        await session.execute(stmt)
        await session.commit()

        print(f"Successfully restored {len(deleted_calls)} calls")


if __name__ == "__main__":
    asyncio.run(undelete_all_calls())
