import asyncio

from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import AsyncSessionLocal
from app.services import call_completion_service, call_service, vapi_service


async def recover_stale_calls() -> None:
    async with AsyncSessionLocal() as db:
        try:
            stale_calls = await call_service.get_stale_in_progress_calls(db)
            if not stale_calls:
                return

            print(f"Found {len(stale_calls)} stale calls to recover")

            for call in stale_calls:
                await _recover_single_call(db, call)

        except Exception as e:
            print(f"Error recovering stale calls: {e}")


async def _recover_single_call(db: AsyncSession, call) -> None:
    if call.vapi_call_id is None:
        await call_completion_service.fail_call(
            db, call.id, "No VAPI call ID - likely failed before transfer"
        )
        return

    try:
        vapi_data = await vapi_service.get_call(call.vapi_call_id)
        if vapi_data is None:
            await call_completion_service.fail_call(
                db, call.id, "Could not fetch VAPI data"
            )
            return

        vapi_status = vapi_data.get("status", "")
        if vapi_status == "ended":
            await call_completion_service.complete_call_with_vapi_data(
                db, call.id, vapi_data
            )
        else:
            await call_completion_service.fail_call(
                db, call.id, f"VAPI call status: {vapi_status}"
            )

    except Exception as e:
        print(f"Error recovering call {call.id}: {e}")
        await call_completion_service.fail_call(db, call.id, str(e))


async def run_stale_call_recovery_loop(interval_seconds: int = 300) -> None:
    while True:
        await asyncio.sleep(interval_seconds)
        await recover_stale_calls()
