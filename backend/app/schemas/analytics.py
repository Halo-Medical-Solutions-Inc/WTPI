from typing import Dict, List, Optional

from pydantic import BaseModel


class AnalyticsPeriod(BaseModel):
    start: str
    end: str


class AnalyticsCards(BaseModel):
    total_calls: int
    avg_call_duration_seconds: float
    review_completion_rate: float
    avg_review_time_minutes: float


class SankeyByIntent(BaseModel):
    total: int
    transferred: int
    transferred_extensions: Dict[str, int]
    non_transferred_intents: Dict[str, int]


class SankeyByDoctor(BaseModel):
    total: int
    auto_reviewed: int
    transferred: int
    transferred_extensions: Dict[str, int]
    non_transferred_doctors: Dict[str, int]
    all_doctors: Dict[str, int]


class SankeyData(BaseModel):
    by_intent: SankeyByIntent
    by_doctor: SankeyByDoctor


class PerformerStats(BaseModel):
    user_name: str
    reviews: int
    percentage: float


class DoctorBreakdownItem(BaseModel):
    doctor_name: str
    total_calls: int
    review_completion_rate: float
    avg_review_time_minutes: Optional[float]
    needs_review: int
    reviewed: int
    performers: List[PerformerStats]


class AnalyticsResponse(BaseModel):
    period: AnalyticsPeriod
    cards: AnalyticsCards
    sankey: SankeyData
    doctor_breakdown: List[DoctorBreakdownItem]
