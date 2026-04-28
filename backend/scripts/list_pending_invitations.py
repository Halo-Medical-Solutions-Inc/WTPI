import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select

from app.database.session import AsyncSessionLocal
from app.models.invitation import Invitation


async def list_pending_invitations() -> None:
    print("Querying pending invitations from the database...")
    print("-" * 80)

    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        
        # Query for valid pending invitations (not expired):
        # - Not accepted (accepted_at is None)
        # - Not canceled (canceled_at is None)
        # - Not expired (expires_at > now)
        valid_query = (
            select(Invitation)
            .where(
                Invitation.accepted_at.is_(None),
                Invitation.canceled_at.is_(None),
                Invitation.expires_at > now,
            )
            .order_by(Invitation.created_at.desc())
        )
        valid_result = await db.execute(valid_query)
        valid_invitations = list(valid_result.scalars().all())

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

        total_pending = len(valid_invitations) + len(expired_invitations)

        if total_pending == 0:
            print("No pending invitations found in the database.")
            print("-" * 80)
            return

        print(f"Found {total_pending} pending invitation(s):")
        print(f"  - {len(valid_invitations)} valid (not expired)")
        print(f"  - {len(expired_invitations)} expired (but not accepted/canceled)")
        print()

        if valid_invitations:
            print("=" * 80)
            print("VALID PENDING INVITATIONS (Not Expired):")
            print("=" * 80)
            for i, invitation in enumerate(valid_invitations, 1):
                print(f"{i}. Email: {invitation.email}")
                print(f"   ID: {invitation.id}")
                print(f"   Role: {invitation.role.value}")
                print(f"   Token: {invitation.token}")
                print(f"   Created At: {invitation.created_at}")
                print(f"   Expires At: {invitation.expires_at}")
                print(f"   Created By: {invitation.created_by}")
                
                # Calculate time until expiration
                time_until_expiry = invitation.expires_at - now
                days = time_until_expiry.days
                hours, remainder = divmod(time_until_expiry.seconds, 3600)
                minutes, _ = divmod(remainder, 60)
                print(f"   Time Until Expiry: {days} days, {hours} hours, {minutes} minutes")
                print()

        if expired_invitations:
            print("=" * 80)
            print("EXPIRED PENDING INVITATIONS (Not Accepted/Canceled):")
            print("=" * 80)
            for i, invitation in enumerate(expired_invitations, 1):
                print(f"{i}. Email: {invitation.email}")
                print(f"   ID: {invitation.id}")
                print(f"   Role: {invitation.role.value}")
                print(f"   Token: {invitation.token}")
                print(f"   Created At: {invitation.created_at}")
                print(f"   Expires At: {invitation.expires_at}")
                print(f"   Created By: {invitation.created_by}")
                
                # Calculate time since expiration
                time_since_expiry = now - invitation.expires_at
                days = time_since_expiry.days
                hours, remainder = divmod(time_since_expiry.seconds, 3600)
                minutes, _ = divmod(remainder, 60)
                print(f"   Expired: {days} days, {hours} hours, {minutes} minutes ago")
                print()

    print("-" * 80)
    print("Query complete!")


if __name__ == "__main__":
    asyncio.run(list_pending_invitations())
