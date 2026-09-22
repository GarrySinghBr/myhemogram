"""ORM models: one lab report (a single PDF, or one manual entry session)
containing many individual analyte results.

There's deliberately no separate "analyte" table. An analyte's identity is
just its name string, matched case-sensitively across reports wherever we
need history (trends, compare) - see routers/analytes.py. That keeps the
parser free to surface a test we've never seen before without it needing to
be registered anywhere first, at the cost of two reports spelling the same
analyte differently being treated as unrelated. Reasonable trade-off for a
single lab's report template; would need reconciling if this ever ingested
reports from multiple labs with different naming conventions.
"""
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    collected_on: Mapped[date] = mapped_column(Date, index=True)
    requested_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    reported_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    ordering_physician: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    source_filename: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    # None for a manually-entered report; set once the original upload is
    # archived under data/pdfs/ (see routers/reports.py::create_report).
    source_pdf_path: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    imported_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    needs_review: Mapped[bool] = mapped_column(default=False)

    # delete-orphan: deleting a report (or dropping a result out of this
    # collection) removes its results too - there's no scenario where a
    # result should outlive the report it belongs to.
    results: Mapped[list["Result"]] = relationship(
        back_populates="report", cascade="all, delete-orphan", order_by="Result.id"
    )


class Result(Base):
    __tablename__ = "results"

    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id"), index=True)

    panel: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    group_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    analyte_name: Mapped[str] = mapped_column(String(200), index=True)
    raw_name: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)

    value_text: Mapped[str] = mapped_column(String(200))
    value_numeric: Mapped[Optional[float]] = mapped_column(nullable=True)
    comparator: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    ref_range_text: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    ref_low: Mapped[Optional[float]] = mapped_column(nullable=True)
    ref_high: Mapped[Optional[float]] = mapped_column(nullable=True)

    flag: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Set by the parser when it couldn't confidently read this row; cleared
    # by the API the moment someone edits the row (see routers/reports.py).
    needs_review: Mapped[bool] = mapped_column(default=False)

    report: Mapped["Report"] = relationship(back_populates="results")
