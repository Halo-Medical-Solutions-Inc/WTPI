import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import delete, select

from app.database.session import AsyncSessionLocal
from app.models.invitation import Invitation
from app.services.invitation_service import create_invitation


async def delete_and_resend_expired_invitations() -> None:
    print("Deleting expired invitations and resending them...")
    print("-" * 80)

    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        
        # Query for expired but not yet accepted/canceled invitations:
        expired_query = (
            select(Invitation)
            .where(
                Invitation.accepted_at.is_(None),
                Invitation.canceled_at.is_(None),
                Invitation.expires_at <= now,
            )
            .order_by(Invitation.created_at.desc())
        )
        expired_result = await db.execute(expired_query)
        expired_invitations = list(expired_result.scalars().all())

        if not expired_invitations:
            print("No expired pending invitations found.")
            print("-" * 80)
            return

        print(f"Found {len(expired_invitations)} expired invitation(s) to process.\n")

        # Store invitation details before deletion
        invitations_to_resend = []
        for invitation in expired_invitations:
            invitations_to_resend.append({
                "email": invitation.email,
                "role": invitation.role,
                "created_by": invitation.created_by,
            })

        # Delete expired invitations
        print("Deleting expired invitations...")
        delete_query = delete(Invitation).where(
            Invitation.accepted_at.is_(None),
            Invitation.canceled_at.is_(None),
            Invitation.expires_at <= now,
        )
        await db.execute(delete_query)
        await db.commit()
        print(f"Deleted {len(expired_invitations)} expired invitation(s).\n")

        # Resend invitations
        print("Resending invitations...")
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
        print(f"  - Total processed: {len(invitations_to_resend)}")
        print("-" * 80)
        print("Operation complete!")


if __name__ == "__main__":
    asyncio.run(delete_and_resend_expired_invitations())
