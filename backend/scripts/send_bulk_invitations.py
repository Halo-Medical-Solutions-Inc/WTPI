import asyncio
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select

from app.database.session import AsyncSessionLocal
from app.models.invitation import Invitation
from app.models.user import User, UserRole
from app.services import invitation_service

# WTPI staff emails — update with actual addresses before running
STAFF_EMAILS: list[str] = [
    # Add WTPI staff emails here before running this script
]


async def get_admin_user(db) -> uuid.UUID:
    """Get the first admin/super_admin user to use as created_by."""
    query = select(User).where(
        User.role.in_([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
        User.deleted_at.is_(None)
    ).limit(1)
    result = await db.execute(query)
    admin = result.scalar_one_or_none()
    if admin is None:
        raise Exception("No admin user found in the database")
    return admin.id


async def check_existing_user(db, email: str) -> bool:
    """Check if user already exists."""
    query = select(User).where(User.email == email.lower())
    result = await db.execute(query)
    return result.scalar_one_or_none() is not None


async def check_pending_invitation(db, email: str) -> bool:
    """Check if pending invitation already exists."""
    invitation = await invitation_service.get_pending_invitation_by_email(db, email)
    return invitation is not None


async def send_invitations(db) -> None:
    """Send invitations to all staff emails."""
    admin_id = await get_admin_user(db)
    print(f"Using admin user ID: {admin_id}")
    print("-" * 60)
    
    success_count = 0
    skip_count = 0
    error_count = 0
    
    for email in STAFF_EMAILS:
        email_lower = email.lower()
        
        # Check if user already exists
        if await check_existing_user(db, email_lower):
            print(f"SKIP: {email_lower} - User already exists")
            skip_count += 1
            continue
        
        # Check if pending invitation exists
        if await check_pending_invitation(db, email_lower):
            print(f"SKIP: {email_lower} - Pending invitation already exists")
            skip_count += 1
            continue
        
        # Send invitation
        try:
            invitation = await invitation_service.create_invitation(
                db=db,
                email=email_lower,
                role=UserRole.STAFF,
                created_by=admin_id,
            )
            print(f"SENT: {email_lower} - Invitation sent successfully")
            success_count += 1
        except Exception as e:
            print(f"ERROR: {email_lower} - {str(e)}")
            error_count += 1
    
    print("-" * 60)
    print(f"Summary:")
    print(f"  Invitations sent: {success_count}")
    print(f"  Skipped: {skip_count}")
    print(f"  Errors: {error_count}")
    print(f"  Total: {len(STAFF_EMAILS)}")


async def main() -> None:
    print("=" * 60)
    print("Sending bulk invitations to WTPI staff")
    print("=" * 60)
    print(f"Total emails to process: {len(STAFF_EMAILS)}")
    print("-" * 60)
    
    async with AsyncSessionLocal() as db:
        await send_invitations(db)
    
    print("=" * 60)
    print("Operation complete!")


if __name__ == "__main__":
    asyncio.run(main())
