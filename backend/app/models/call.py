import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.models.base import Base


class CallStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ABANDONED = "ABANDONED"


class ExtractionStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


class Call(Base):
    __tablename__ = "calls"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    twilio_call_sid: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    number: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, index=True
    )
    vapi_call_id: Mapped[Optional[str]] = mapped_column(
        String(255), unique=True, nullable=True, index=True
    )
    vapi_data_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vapi_data_kid: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    extraction_data_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    extraction_data_kid: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    display_data_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    display_data_kid: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    extraction_status: Mapped[Optional[ExtractionStatus]] = mapped_column(
        Enum(ExtractionStatus, name="extraction_status", create_type=False),
        nullable=True,
    )
    status: Mapped[CallStatus] = mapped_column(
        Enum(CallStatus, name="call_status", create_type=False),
        nullable=False,
        default=CallStatus.IN_PROGRESS,
        index=True,
    )
    is_reviewed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false", index=True
    )
    reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    is_flagged: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    flagged_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    flagged_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    comments: Mapped[list["CallComment"]] = relationship(
        "CallComment",
        back_populates="call",
        order_by="CallComment.created_at",
        cascade="all, delete-orphan",
    )
