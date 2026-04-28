import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select

from app.database.session import AsyncSessionLocal
from app.models.practice import Practice
from app.models.user import User, UserRole
from app.utils.password import hash_password


PRACTICE_DATA = {
    "practice_name": "West Texas Pain Institute",
    "practice_region": "America/Denver",
    "max_concurrent_calls": 10,
}

SUPER_ADMIN_USERS = [
    {
        "email": "keshav@halohealth.app",
        "password": "Keshav2004!",
        "full_name": "Keshav Soni",
    },
    {
        "email": "mandika@halohealth.app",
        "password": "Halohealth2025!",
        "full_name": "Mandika",
    },
]


async def seed_practice(db) -> None:
    result = await db.execute(select(Practice).limit(1))
    existing = result.scalar_one_or_none()

    if existing:
        print(f"Practice already exists: {existing.practice_name}")
        return

    practice = Practice(
        practice_name=PRACTICE_DATA["practice_name"],
        practice_region=PRACTICE_DATA["practice_region"],
        max_concurrent_calls=PRACTICE_DATA["max_concurrent_calls"],
        active_call_ids=[],
    )
    db.add(practice)
    await db.commit()
    print(f"Created practice: {practice.practice_name}")


async def seed_super_admins(db) -> None:
    for user_data in SUPER_ADMIN_USERS:
        result = await db.execute(
            select(User).where(User.email == user_data["email"].lower())
        )
        existing = result.scalar_one_or_none()

        if existing:
            print(f"User already exists: {existing.email}")
            continue

        user = User(
            email=user_data["email"].lower(),
            password_hash=hash_password(user_data["password"]),
            full_name=user_data["full_name"],
            role=UserRole.SUPER_ADMIN,
            region="America/Denver",
        )
        db.add(user)
        await db.commit()
        print(f"Created super admin: {user.email}")


async def main() -> None:
    print("Seeding initial data...")
    print("-" * 40)

    async with AsyncSessionLocal() as db:
        await seed_practice(db)
        await seed_super_admins(db)

    print("-" * 40)
    print("Seeding complete!")


if __name__ == "__main__":
    asyncio.run(main())
