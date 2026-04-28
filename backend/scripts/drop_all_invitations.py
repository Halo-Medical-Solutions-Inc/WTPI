import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import delete, func, select

from app.database.session import AsyncSessionLocal
from app.models.invitation import Invitation


async def drop_all_invitations(db) -> None:
    count_result = await db.execute(select(func.count(Invitation.id)))
    count = count_result.scalar_one()

    if count == 0:
        print("No invitations found in the database.")
        return

    print(f"Found {count} invitation(s) in the database.")

    await db.execute(delete(Invitation))
    await db.commit()

    print(f"Successfully deleted {count} invitation(s) from the database.")


async def main() -> None:
    print("Dropping all invitations from the database...")
    print("-" * 40)

    async with AsyncSessionLocal() as db:
        await drop_all_invitations(db)

    print("-" * 40)
    print("Operation complete!")


if __name__ == "__main__":
    asyncio.run(main())
