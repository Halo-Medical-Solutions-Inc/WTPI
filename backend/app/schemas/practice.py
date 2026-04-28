import uuid
from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, field_validator


class Team(BaseModel):
    id: str
    title: str
    description: str
    members: List[str] = []


class TeamsConfig(BaseModel):
    teams: List[Team] = []


class TeamCreate(BaseModel):
    title: str
    description: str = ""


class TeamUpdate(BaseModel):
    title: str
    description: str = ""


class TeamMembersUpdate(BaseModel):
    members: List[str]


class PriorityConfig(BaseModel):
    low: str = ""
    medium: str = ""
    high: str = ""


class PracticeUpdate(BaseModel):
    practice_name: Optional[str] = None
    practice_region: Optional[str] = None
    priority_config: Optional[PriorityConfig] = None


class PracticeResponse(BaseModel):
    id: uuid.UUID
    practice_name: str
    practice_region: str
    active_call_ids: List[uuid.UUID]
    max_concurrent_calls: int
    teams: TeamsConfig
    priority_config: PriorityConfig
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("teams", mode="before")
    @classmethod
    def parse_teams(cls, v: Any) -> TeamsConfig:
        if isinstance(v, dict):
            return TeamsConfig(**v)
        return v

    @field_validator("priority_config", mode="before")
    @classmethod
    def parse_priority_config(cls, v: Any) -> PriorityConfig:
        if isinstance(v, dict):
            return PriorityConfig(**v)
        return v if v else PriorityConfig()

