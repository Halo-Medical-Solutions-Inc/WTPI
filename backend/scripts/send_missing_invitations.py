import asyncio
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select

from app.database.session import AsyncSessionLocal
from app.models.user import User, UserRole
from app.services.invitation_service import create_invitation, get_pending_invitation_by_email
from app.services.user_service import get_user_by_email


# Missing emails that need invitations — update with actual addresses before running
MISSING_EMAILS: list[str] = [
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


async def send_missing_invitations(db) -> None:
    """Send invitations only to missing emails."""
    admin_id = await get_admin_user(db)
    print(f"Using admin user ID: {admin_id}")
    print("-" * 80)
    
    success_count = 0
    skip_count = 0
    error_count = 0
    
    for email in MISSING_EMAILS:
        email_lower = email.lower()
        
        # Check if user already exists
        existing_user = await get_user_by_email(db, email_lower)
        if existing_user:
            print(f"SKIP: {email_lower} - User already exists")
            skip_count += 1
            continue
        
        # Check if pending invitation exists
        existing_invitation = await get_pending_invitation_by_email(db, email_lower)
        if existing_invitation:
            print(f"SKIP: {email_lower} - Pending invitation already exists")
            skip_count += 1
            continue
        
        # Send invitation
        try:
            invitation = await create_invitation(
                db=db,
                email=email_lower,
                role=UserRole.STAFF,
                created_by=admin_id,
            )
            print(f"✓ SENT: {email_lower} - Invitation sent successfully")
            success_count += 1
        except Exception as e:
            print(f"✗ ERROR: {email_lower} - {str(e)}")
            error_count += 1
    
    print("-" * 80)
    print(f"Summary:")
    print(f"  Invitations sent: {success_count}")
    print(f"  Skipped: {skip_count}")
    print(f"  Errors: {error_count}")
    print(f"  Total processed: {len(MISSING_EMAILS)}")


async def main() -> None:
    print("=" * 80)
    print("Sending invitations to missing staff members")
    print("=" * 80)
    print(f"Emails to process: {len(MISSING_EMAILS)}")
    for email in MISSING_EMAILS:
        print(f"  - {email}")
    print("-" * 80)
    
    async with AsyncSessionLocal() as db:
        await send_missing_invitations(db)
    
    print("=" * 80)
    print("Operation complete!")


if __name__ == "__main__":
    asyncio.run(main())
