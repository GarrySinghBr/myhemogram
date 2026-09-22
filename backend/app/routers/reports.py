"""Report CRUD, plus the two-step PDF import flow.

Importing a PDF is deliberately split into two requests instead of one:

  1. POST /reports/parse - upload the file, parse it, get back a preview.
     Nothing is written to the database. The uploaded file is written to a
     staging directory (keyed by a random token) so we don't have to ask the
     browser to re-upload it once the user has reviewed the parsed data.
  2. POST /reports - the user has edited the preview in the UI (fixed a
     misread value, deleted a bogus row, whatever) and confirms; *that*
     payload is what actually gets saved. If it came from a parsed PDF, the
     staged file is moved into permanent storage at this point.

This means the parser can misfire and the user simply never gets to step 2 -
nothing bad is persisted - and it means we're never guessing at how to
silently "fix" a bad parse server-side.
"""
import os
import shutil
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import PDF_DIR, get_db
from ..parser import parse_date, parse_pdf

router = APIRouter(prefix="/api", tags=["reports"])

STAGING_DIR = os.path.join(PDF_DIR, "_staging")
os.makedirs(STAGING_DIR, exist_ok=True)


@router.post("/reports/parse", response_model=schemas.ParsePreview)
async def parse_report(file: UploadFile):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")

    token = uuid.uuid4().hex
    staged_path = os.path.join(STAGING_DIR, f"{token}.pdf")
    with open(staged_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        parsed = parse_pdf(staged_path)
    except Exception as exc:  # noqa: BLE001 - surfaced to the user as a 422, not a 500
        os.remove(staged_path)
        raise HTTPException(422, f"Could not parse this PDF: {exc}") from exc

    results = [
        schemas.ResultIn(
            panel=r.panel,
            group_name=r.group_name,
            analyte_name=r.analyte_name,
            raw_name=r.raw_name,
            value_text=r.value_text,
            value_numeric=r.value_numeric,
            comparator=r.comparator,
            unit=r.unit,
            ref_range_text=r.ref_range_text,
            ref_low=r.ref_low,
            ref_high=r.ref_high,
            flag=r.flag,
            notes=r.notes,
            needs_review=r.needs_review,
        )
        for r in parsed.results
    ]
    return schemas.ParsePreview(
        collected_on=parse_date(parsed.collected_on),
        requested_on=parse_date(parsed.requested_on),
        reported_on=parse_date(parsed.reported_on),
        ordering_physician=parsed.ordering_physician,
        panels=parsed.panels,
        results=results,
        source_filename=file.filename,
        upload_token=token,
    )


def _result_counts(report: models.Report) -> tuple[int, int]:
    total = len(report.results)
    abnormal = sum(1 for r in report.results if r.flag)
    return total, abnormal


def _sync_needs_review(report: models.Report) -> None:
    """Report.needs_review just mirrors "does any result still need a
    look" - recomputed here instead of stored redundantly, so it can never
    drift out of sync with the results that determine it. Call this after
    any change to a report's result set."""
    report.needs_review = any(r.needs_review for r in report.results)


@router.get("/reports", response_model=list[schemas.ReportSummaryOut])
def list_reports(db: Session = Depends(get_db)):
    reports = db.query(models.Report).order_by(models.Report.collected_on.desc()).all()
    out = []
    for r in reports:
        total, abnormal = _result_counts(r)
        out.append(
            schemas.ReportSummaryOut(
                id=r.id,
                collected_on=r.collected_on,
                ordering_physician=r.ordering_physician,
                source_filename=r.source_filename,
                needs_review=r.needs_review,
                result_count=total,
                abnormal_count=abnormal,
            )
        )
    return out


@router.post("/reports", response_model=schemas.ReportOut)
def create_report(payload: schemas.ReportIn, upload_token: str | None = None, db: Session = Depends(get_db)):
    report = models.Report(
        collected_on=payload.collected_on,
        requested_on=payload.requested_on,
        reported_on=payload.reported_on,
        ordering_physician=payload.ordering_physician,
        source_filename=payload.source_filename,
    )
    db.add(report)
    db.flush()  # assigns report.id, needed as the FK below

    for r in payload.results:
        db.add(models.Result(report_id=report.id, **r.model_dump()))
    db.flush()  # populate report.results before _sync_needs_review reads it
    _sync_needs_review(report)

    # A parsed-PDF report carries the token handed out by /reports/parse;
    # a manually-entered one has none, so there's nothing to move.
    if upload_token:
        staged_path = os.path.join(STAGING_DIR, f"{upload_token}.pdf")
        if os.path.exists(staged_path):
            filename = f"{report.id}.pdf"
            dest = os.path.join(PDF_DIR, filename)
            shutil.move(staged_path, dest)
            report.source_pdf_path = dest
            report.source_filename = report.source_filename or filename

    db.commit()
    db.refresh(report)
    return report


@router.get("/reports/{report_id}", response_model=schemas.ReportOut)
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.get(models.Report, report_id)
    if not report:
        raise HTTPException(404, "Report not found")
    return report


@router.put("/reports/{report_id}", response_model=schemas.ReportOut)
def update_report(report_id: int, payload: schemas.ReportIn, db: Session = Depends(get_db)):
    """Updates report-level metadata only (date, physician, ...) - individual
    results have their own endpoints below rather than being replaced
    wholesale here, so editing one value never risks clobbering the rest."""
    report = db.get(models.Report, report_id)
    if not report:
        raise HTTPException(404, "Report not found")
    report.collected_on = payload.collected_on
    report.requested_on = payload.requested_on
    report.reported_on = payload.reported_on
    report.ordering_physician = payload.ordering_physician
    db.commit()
    db.refresh(report)
    return report


@router.delete("/reports/{report_id}", status_code=204)
def delete_report(report_id: int, db: Session = Depends(get_db)):
    report = db.get(models.Report, report_id)
    if not report:
        raise HTTPException(404, "Report not found")
    if report.source_pdf_path and os.path.exists(report.source_pdf_path):
        os.remove(report.source_pdf_path)
    db.delete(report)  # cascades to its results, see models.Report.results
    db.commit()


@router.get("/reports/{report_id}/pdf")
def get_report_pdf(report_id: int, db: Session = Depends(get_db)):
    report = db.get(models.Report, report_id)
    if not report or not report.source_pdf_path or not os.path.exists(report.source_pdf_path):
        raise HTTPException(404, "No source PDF archived for this report")
    return FileResponse(report.source_pdf_path, media_type="application/pdf")


@router.post("/reports/{report_id}/results", response_model=schemas.ResultOut)
def add_result(report_id: int, payload: schemas.ResultIn, db: Session = Depends(get_db)):
    report = db.get(models.Report, report_id)
    if not report:
        raise HTTPException(404, "Report not found")
    result = models.Result(report_id=report_id, **payload.model_dump())
    db.add(result)
    db.flush()
    _sync_needs_review(report)
    db.commit()
    db.refresh(result)
    return result


@router.put("/results/{result_id}", response_model=schemas.ResultOut)
def update_result(result_id: int, payload: schemas.ResultIn, db: Session = Depends(get_db)):
    result = db.get(models.Result, result_id)
    if not result:
        raise HTTPException(404, "Result not found")
    data = payload.model_dump()
    # Someone editing a row through the UI is a human confirming/correcting
    # it, which is exactly what needs_review was flagging as missing.
    data["needs_review"] = False
    for key, value in data.items():
        setattr(result, key, value)
    _sync_needs_review(result.report)
    db.commit()
    db.refresh(result)
    return result


@router.delete("/results/{result_id}", status_code=204)
def delete_result(result_id: int, db: Session = Depends(get_db)):
    result = db.get(models.Result, result_id)
    if not result:
        raise HTTPException(404, "Result not found")
    report = result.report
    db.delete(result)
    db.flush()
    _sync_needs_review(report)
    db.commit()
