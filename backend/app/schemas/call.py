import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel

from app.models.call import CallStatus


class DisplayData(BaseModel):
    caller_name: Optional[str] = None
    patient_name: Optional[str] = None
    phone_number: Optional[str] = None
    duration_seconds: Optional[float] = None
    caller_affiliation: Optional[str] = None
    provider_name: Optional[str] = None
    primary_intent: Optional[str] = None
    priority: Optional[str] = None
    summary: Optional[str] = None
    call_teams: Optional[List[str]] = None


class CallResponse(BaseModel):
    id: uuid.UUID
    twilio_call_sid: str
    vapi_call_id: Optional[str]
    status: CallStatus
    is_reviewed: bool
    reviewed_by: Optional[uuid.UUID]
    reviewed_at: Optional[datetime]
    is_flagged: bool = False
    flagged_by: Optional[uuid.UUID] = None
    flagged_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    display_data: Optional[DisplayData] = None
    extraction_status: Optional[str] = None

    model_config = {"from_attributes": True}


class CallDetailResponse(BaseModel):
    id: uuid.UUID
    twilio_call_sid: str
    vapi_call_id: Optional[str]
    status: CallStatus
    is_reviewed: bool
    reviewed_by: Optional[uuid.UUID]
    reviewed_at: Optional[datetime]
    is_flagged: bool = False
    flagged_by: Optional[uuid.UUID] = None
    flagged_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    display_data: Optional[DisplayData] = None
    vapi_data: Optional[Dict[str, Any]] = None
    extraction_data: Optional[Dict[str, Any]] = None
    extraction_status: Optional[str] = None

    model_config = {"from_attributes": True}


class CallReviewUpdate(BaseModel):
    is_reviewed: bool


class CallFlagUpdate(BaseModel):
    is_flagged: bool


class CallTeamsUpdate(BaseModel):
    call_teams: List[str]


class CallSearchRequest(BaseModel):
    query: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[CallStatus] = None
    is_reviewed: Optional[bool] = None
    limit: int = 50
    offset: int = 0


class CallSearchResultItem(BaseModel):
    id: uuid.UUID
    twilio_call_sid: str
    vapi_call_id: Optional[str]
    status: CallStatus
    is_reviewed: bool
    reviewed_by: Optional[uuid.UUID]
    reviewed_at: Optional[datetime]
    is_flagged: bool = False
    flagged_by: Optional[uuid.UUID] = None
    flagged_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    display_data: Optional[DisplayData] = None
    vapi_data: Optional[Dict[str, Any]] = None
    extraction_data: Optional[Dict[str, Any]] = None
    extraction_status: Optional[str] = None
    relevance_score: float = 0.0
    is_top_result: bool = False

    model_config = {"from_attributes": True}


class CallSearchResult(BaseModel):
    calls: List[CallDetailResponse]
    total: int
