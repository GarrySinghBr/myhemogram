from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ResultIn(BaseModel):
    """Payload for creating/editing a single result, whether it came from the
    parser preview or was typed in by hand."""

    panel: Optional[str] = None
    group_name: Optional[str] = None
    analyte_name: str
    raw_name: Optional[str] = None
    value_text: str
    value_numeric: Optional[float] = None
    comparator: Optional[str] = None
    unit: Optional[str] = None
    ref_range_text: Optional[str] = None
    ref_low: Optional[float] = None
    ref_high: Optional[float] = None
    flag: Optional[str] = None
    notes: Optional[str] = None


class ResultOut(ResultIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    report_id: int


class ReportIn(BaseModel):
    collected_on: date
    requested_on: Optional[date] = None
    reported_on: Optional[date] = None
    ordering_physician: Optional[str] = None
    source_filename: Optional[str] = None
    results: list[ResultIn] = []


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    collected_on: date
    requested_on: Optional[date] = None
    reported_on: Optional[date] = None
    ordering_physician: Optional[str] = None
    source_filename: Optional[str] = None
    imported_at: datetime
    needs_review: bool
    results: list[ResultOut] = []


class ReportSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    collected_on: date
    ordering_physician: Optional[str] = None
    source_filename: Optional[str] = None
    needs_review: bool
    result_count: int
    abnormal_count: int


class ParsedResultPreview(ResultIn):
    needs_review: bool = False


class ParsePreview(BaseModel):
    collected_on: Optional[date] = None
    requested_on: Optional[date] = None
    reported_on: Optional[date] = None
    ordering_physician: Optional[str] = None
    panels: list[str] = []
    results: list[ParsedResultPreview] = []
    source_filename: Optional[str] = None
    upload_token: Optional[str] = None


class AnalyteSummary(BaseModel):
    analyte_name: str
    unit: Optional[str] = None
    latest_value_text: Optional[str] = None
    latest_value_numeric: Optional[float] = None
    latest_date: Optional[date] = None
    latest_flag: Optional[str] = None
    point_count: int


class TrendPoint(BaseModel):
    report_id: int
    collected_on: date
    value_text: str
    value_numeric: Optional[float] = None
    comparator: Optional[str] = None
    unit: Optional[str] = None
    ref_low: Optional[float] = None
    ref_high: Optional[float] = None
    flag: Optional[str] = None


class AnalyteTrend(BaseModel):
    analyte_name: str
    points: list[TrendPoint]


class CompareRow(BaseModel):
    analyte_name: str
    unit: Optional[str] = None
    values: dict[int, Optional[TrendPoint]]
    delta: Optional[float] = None
    percent_change: Optional[float] = None


class CompareOut(BaseModel):
    report_ids: list[int]
    rows: list[CompareRow]
