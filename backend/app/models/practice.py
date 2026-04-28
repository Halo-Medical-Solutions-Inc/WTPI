import uuid
from datetime import datetime
from typing import Any, Dict, List

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base


class Practice(Base):
    __tablename__ = "practice"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    practice_name: Mapped[str] = mapped_column(String(255), nullable=False)
    practice_region: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default="America/Los_Angeles"
    )
    active_call_ids: Mapped[List[uuid.UUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)), nullable=False, server_default="{}"
    )
    max_concurrent_calls: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="10"
    )
    teams: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default="{}"
    )
    priority_config: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default="{}"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
