import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select

from app.database.session import AsyncSessionLocal
from app.models.call import Call
from app.services import call_service


async def backfill_display_data() -> None:
    async with AsyncSessionLocal() as db:
        query = select(Call).where(
            Call.deleted_at.is_(None),
            Call.display_data_encrypted.is_(None),
        )
        result = await db.execute(query)
        calls = list(result.scalars().all())

        print(f"Found {len(calls)} calls without display_data")

        updated = 0
        skipped = 0

        for call in calls:
            vapi_data = call_service.decrypt_vapi_data(call)
            extraction_data = call_service.decrypt_extraction_data(call)

            if not vapi_data and not extraction_data:
                skipped += 1
                continue

            display_data = call_service.build_display_data(
                vapi_data=vapi_data, extraction_data=extraction_data
            )
            await call_service.store_display_data(db, call, display_data)
            updated += 1

            if updated % 50 == 0:
                print(f"  Updated {updated} calls...")

        print(f"Done. Updated: {updated}, Skipped (no data): {skipped}")


if __name__ == "__main__":
    asyncio.run(backfill_display_data())
