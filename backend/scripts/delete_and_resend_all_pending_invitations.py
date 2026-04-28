import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import delete, select

from app.config import settings
from app.database.session import AsyncSessionLocal
from app.models.invitation import Invitation
from app.services.invitation_service import create_invitation
from app.services.user_service import get_user_by_email


async def delete_and_resend_all_pending_invitations() -> None:
    print("Deleting all pending invitations and resending them with correct URL...")
    print("-" * 80)
    print(f"Frontend URL configured: {settings.FRONTEND_URL}")
    print("-" * 80)

    async with AsyncSessionLocal() as db:
        # Query for all pending invitations (not accepted, not canceled):
        pending_query = (
            select(Invitation)
            .where(
                Invitation.accepted_at.is_(None),
                Invitation.canceled_at.is_(None),
            )
            .order_by(Invitation.created_at.desc())
        )
        pending_result = await db.execute(pending_query)
        pending_invitations = list(pending_result.scalars().all())

        if not pending_invitations:
            print("No pending invitations found.")
            print("-" * 80)
            return

        print(f"Found {len(pending_invitations)} pending invitation(s) to process.\n")

        # Store invitation details before deletion
        invitations_to_resend = []
        skipped = []
        
        for invitation in pending_invitations:
            # Check if user already exists (shouldn't happen, but just in case)
            existing_user = await get_user_by_email(db, invitation.email)
            if existing_user:
                skipped.append({
                    "email": invitation.email,
                    "reason": "User already exists"
                })
                continue
            
            invitations_to_resend.append({
                "email": invitation.email,
                "role": invitation.role,
                "created_by": invitation.created_by,
            })

        if skipped:
            print(f"Skipping {len(skipped)} invitation(s) (users already exist):")
            for skip in skipped:
                print(f"  - {skip['email']}: {skip['reason']}")
            print()

        # Delete all pending invitations
        print("Deleting all pending invitations...")
        delete_query = delete(Invitation).where(
            Invitation.accepted_at.is_(None),
            Invitation.canceled_at.is_(None),
        )
        await db.execute(delete_query)
        await db.commit()
        print(f"Deleted {len(pending_invitations)} pending invitation(s).\n")

        # Resend invitations with correct URL
        print("Resending invitations with correct frontend URL...")
        print("-" * 80)
        successful = 0
        failed = 0

        for i, invite_data in enumerate(invitations_to_resend, 1):
            try:
                new_invitation = await create_invitation(
                    db=db,
                    email=invite_data["email"],
                    role=invite_data["role"],
                    created_by=invite_data["created_by"],
                )
                print(f"{i}. ✓ Resent invitation to {invite_data['email']} ({invite_data['role'].value})")
                successful += 1
            except Exception as e:
                print(f"{i}. ✗ Failed to resend invitation to {invite_data['email']}: {str(e)}")
                failed += 1

        print("-" * 80)
        print(f"Summary:")
        print(f"  - Successfully resent: {successful}")
        print(f"  - Failed: {failed}")
        print(f"  - Skipped: {len(skipped)}")
        print(f"  - Total processed: {len(invitations_to_resend)}")
        print("-" * 80)
        print("Operation complete!")
        print(f"\nAll invitations now use frontend URL: {settings.FRONTEND_URL}")


if __name__ == "__main__":
    asyncio.run(delete_and_resend_all_pending_invitations())
