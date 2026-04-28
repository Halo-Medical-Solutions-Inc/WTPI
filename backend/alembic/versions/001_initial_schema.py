"""Initial schema

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-01-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column(
            "role",
            sa.Enum("SUPER_ADMIN", "ADMIN", "STAFF", name="user_role"),
            nullable=False,
        ),
        sa.Column("region", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_role"), "users", ["role"], unique=False)

    op.create_table(
        "sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("refresh_token_hash", sa.String(length=255), nullable=False),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_sessions_refresh_token_hash"),
        "sessions",
        ["refresh_token_hash"],
        unique=True,
    )
    op.create_index(op.f("ix_sessions_user_id"), "sessions", ["user_id"], unique=False)

    op.create_table(
        "invitations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column(
            "role",
            sa.Enum("SUPER_ADMIN", "ADMIN", "STAFF", name="user_role"),
            nullable=False,
        ),
        sa.Column("token", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("canceled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_invitations_email"), "invitations", ["email"], unique=False
    )
    op.create_index(
        op.f("ix_invitations_token"), "invitations", ["token"], unique=True
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("user_email", sa.String(length=255), nullable=True),
        sa.Column(
            "entity_type",
            sa.Enum(
                "user", "invitation", "practice", "call", "session", name="entity_type"
            ),
            nullable=False,
        ),
        sa.Column("entity_id", sa.UUID(), nullable=True),
        sa.Column(
            "action",
            sa.Enum(
                "create",
                "update",
                "delete",
                "login",
                "logout",
                "password_change",
                "password_reset",
                "review_toggle",
                name="audit_action",
            ),
            nullable=False,
        ),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_audit_logs_action"), "audit_logs", ["action"], unique=False
    )
    op.create_index(
        op.f("ix_audit_logs_created_at"), "audit_logs", ["created_at"], unique=False
    )
    op.create_index(
        op.f("ix_audit_logs_entity_type"), "audit_logs", ["entity_type"], unique=False
    )
    op.create_index(
        op.f("ix_audit_logs_user_id"), "audit_logs", ["user_id"], unique=False
    )

    op.create_table(
        "practice",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("practice_name", sa.String(length=255), nullable=False),
        sa.Column("practice_region", sa.String(length=50), nullable=False),
        sa.Column("active_call_ids", postgresql.ARRAY(sa.UUID()), nullable=False),
        sa.Column("max_concurrent_calls", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "calls",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("twilio_call_sid", sa.String(length=255), nullable=False),
        sa.Column("vapi_call_id", sa.String(length=255), nullable=True),
        sa.Column("vapi_data_encrypted", sa.Text(), nullable=True),
        sa.Column("vapi_data_kid", sa.String(length=50), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "QUEUED",
                "IN_PROGRESS",
                "COMPLETED",
                "FAILED",
                "ABANDONED",
                name="call_status",
            ),
            nullable=False,
        ),
        sa.Column("is_reviewed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("reviewed_by", sa.Uuid(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_calls_created_at"), "calls", ["created_at"], unique=False
    )
    op.create_index(
        op.f("ix_calls_is_reviewed"), "calls", ["is_reviewed"], unique=False
    )
    op.create_index(op.f("ix_calls_status"), "calls", ["status"], unique=False)
    op.create_index(
        op.f("ix_calls_twilio_call_sid"), "calls", ["twilio_call_sid"], unique=True
    )
    op.create_index(
        op.f("ix_calls_vapi_call_id"), "calls", ["vapi_call_id"], unique=True
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_calls_vapi_call_id"), table_name="calls")
    op.drop_index(op.f("ix_calls_twilio_call_sid"), table_name="calls")
    op.drop_index(op.f("ix_calls_status"), table_name="calls")
    op.drop_index(op.f("ix_calls_is_reviewed"), table_name="calls")
    op.drop_index(op.f("ix_calls_created_at"), table_name="calls")
    op.drop_table("calls")
    op.drop_table("practice")
    op.drop_index(op.f("ix_audit_logs_user_id"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_entity_type"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_created_at"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_action"), table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index(op.f("ix_invitations_token"), table_name="invitations")
    op.drop_index(op.f("ix_invitations_email"), table_name="invitations")
    op.drop_table("invitations")
    op.drop_index(op.f("ix_sessions_user_id"), table_name="sessions")
    op.drop_index(op.f("ix_sessions_refresh_token_hash"), table_name="sessions")
    op.drop_table("sessions")
    op.drop_index(op.f("ix_users_role"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
