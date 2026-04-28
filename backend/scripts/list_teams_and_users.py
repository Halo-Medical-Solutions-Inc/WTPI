import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select

from app.database.session import AsyncSessionLocal
from app.models.practice import Practice
from app.models.user import User


async def list_teams_and_users() -> None:
    print("Querying practices and users...")
    print("=" * 80)

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Practice))
        practices = result.scalars().all()

        if not practices:
            print("No practices found in the database.")
            return

        user_result = await db.execute(
            select(User).where(User.deleted_at.is_(None))
        )
        users = user_result.scalars().all()

        print(f"Found {len(practices)} practice(s) and {len(users)} active user(s)\n")

        for practice_idx, practice in enumerate(practices, 1):
            print(f"\n{'=' * 80}")
            print(f"PRACTICE #{practice_idx}: {practice.practice_name}")
            print(f"{'=' * 80}")
            print(f"Practice ID: {practice.id}")
            print(f"Practice Region: {practice.practice_region}")
            print(f"Max Concurrent Calls: {practice.max_concurrent_calls}")
            print(f"Active Calls: {len(practice.active_call_ids)}")
            print(f"Created At: {practice.created_at}")
            print(f"Updated At: {practice.updated_at}")
            print("-" * 80)

        print(f"\n{'=' * 80}")
        print("ALL USERS")
        print(f"{'=' * 80}")

        if not users:
            print("No users found in the database.")
        else:
            print(f"\nFound {len(users)} active user(s):\n")

            for user_idx, user in enumerate(users, 1):
                print(f"  User #{user_idx}: {user.full_name}")
                print(f"    Email: {user.email}")
                print(f"    User ID: {user.id}")
                print(f"    Role: {user.role.value}")
                print(f"    Region: {user.region or 'N/A'}")
                print(f"    Created At: {user.created_at}")
                print()

    print("=" * 80)
    print("Query complete!")


if __name__ == "__main__":
    asyncio.run(list_teams_and_users())
