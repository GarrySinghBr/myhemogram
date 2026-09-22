"""Pydantic request/response shapes for the API.

The naming convention throughout is `<Thing>In` for what a client sends and
`<Thing>Out` for what we return - kept as separate classes (rather than one
schema reused both ways) so a response can safely include server-assigned
fields like `id` without also making them settable on the way in.
"""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ResultIn(BaseModel):
    """Payload for creating/editing a single result, whether it came from the
    parser preview or was typed in by hand.

    `needs_review` starts out set by the parser when it couldn't confidently
    read a value (see parser.py's ParsedResult.needs_review) and is cleared
    the moment a person edits that row through the UI - it's a "the machine
    wasn't sure about this one" flag, not a permanent property of the data.
    """

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
    needs_review: bool = False


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
    # True if any result on this report still has needs_review set - kept in
    # sync by the reports router whenever a result is added, edited, or
    # removed (see _sync_needs_review), not computed on read.
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


class ParsePreview(BaseModel):
    """What POST /reports/parse hands back: nothing here is saved yet - the
    frontend shows it as an editable review table and only persists it if
    the user confirms (POST /reports)."""

    collected_on: Optional[date] = None
    requested_on: Optional[date] = None
    reported_on: Optional[date] = None
    ordering_physician: Optional[str] = None
    panels: list[str] = []
    results: list[ResultIn] = []
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
