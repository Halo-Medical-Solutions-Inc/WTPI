import asyncio
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select

from app.database.session import AsyncSessionLocal
from app.config import settings
from app.models.user import User, UserRole
from app.services.invitation_service import create_invitation, get_pending_invitation_by_email
from app.services.user_service import get_user_by_email


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


async def send_single_invitation(email: str) -> None:
    """Send invitation to a single email."""
    print(f"Sending invitation to: {email}")
    print(f"Frontend URL: {settings.FRONTEND_URL}")
    print("-" * 80)
    
    async with AsyncSessionLocal() as db:
        email_lower = email.lower()
        
        # Check if user already exists
        existing_user = await get_user_by_email(db, email_lower)
        if existing_user:
            print(f"✗ SKIP: User already exists with email {email_lower}")
            return
        
        # Check if pending invitation exists
        existing_invitation = await get_pending_invitation_by_email(db, email_lower)
        if existing_invitation:
            print(f"✗ SKIP: Pending invitation already exists for {email_lower}")
            return
        
        # Send invitation
        try:
            admin_id = await get_admin_user(db)
            invitation = await create_invitation(
                db=db,
                email=email_lower,
                role=UserRole.STAFF,
                created_by=admin_id,
            )
            print(f"✓ SUCCESS: Invitation sent to {email_lower}")
            print(f"  Invitation ID: {invitation.id}")
            print(f"  Expires at: {invitation.expires_at}")
        except Exception as e:
            print(f"✗ ERROR: Failed to send invitation - {str(e)}")


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python send_single_invitation.py <email>")
        sys.exit(1)
    
    email = sys.argv[1]
    asyncio.run(send_single_invitation(email))
