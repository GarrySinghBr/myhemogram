from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db

router = APIRouter(prefix="/api", tags=["analytes"])


@router.get("/analytes", response_model=list[schemas.AnalyteSummary])
def list_analytes(db: Session = Depends(get_db)):
    rows = (
        db.query(models.Result, models.Report.collected_on)
        .join(models.Report, models.Result.report_id == models.Report.id)
        .order_by(models.Report.collected_on.asc())
        .all()
    )
    by_name: dict[str, dict] = {}
    for result, collected_on in rows:
        entry = by_name.setdefault(
            result.analyte_name,
            {"unit": None, "count": 0, "latest": None, "latest_date": None},
        )
        entry["count"] += 1
        entry["unit"] = result.unit or entry["unit"]
        if entry["latest_date"] is None or collected_on >= entry["latest_date"]:
            entry["latest_date"] = collected_on
            entry["latest"] = result

    out = []
    for name, entry in sorted(by_name.items(), key=lambda kv: kv[0].lower()):
        latest: models.Result = entry["latest"]
        out.append(
            schemas.AnalyteSummary(
                analyte_name=name,
                unit=entry["unit"],
                latest_value_text=latest.value_text if latest else None,
                latest_value_numeric=latest.value_numeric if latest else None,
                latest_date=entry["latest_date"],
                latest_flag=latest.flag if latest else None,
                point_count=entry["count"],
            )
        )
    return out


@router.get("/analytes/{analyte_name}/trend", response_model=schemas.AnalyteTrend)
def analyte_trend(analyte_name: str, db: Session = Depends(get_db)):
    rows = (
        db.query(models.Result, models.Report.collected_on, models.Report.id)
        .join(models.Report, models.Result.report_id == models.Report.id)
        .filter(models.Result.analyte_name == analyte_name)
        .order_by(models.Report.collected_on.asc())
        .all()
    )
    points = [
        schemas.TrendPoint(
            report_id=report_id,
            collected_on=collected_on,
            value_text=result.value_text,
            value_numeric=result.value_numeric,
            comparator=result.comparator,
            unit=result.unit,
            ref_low=result.ref_low,
            ref_high=result.ref_high,
            flag=result.flag,
        )
        for result, collected_on, report_id in rows
    ]
    return schemas.AnalyteTrend(analyte_name=analyte_name, points=points)


@router.get("/compare", response_model=schemas.CompareOut)
def compare_reports(report_ids: str = Query(..., description="Comma-separated report ids"), db: Session = Depends(get_db)):
    ids = [int(x) for x in report_ids.split(",") if x.strip()]
    reports = {
        r.id: r
        for r in db.query(models.Report).filter(models.Report.id.in_(ids)).all()
    }
    ordered_ids = [i for i in ids if i in reports]

    by_analyte: dict[str, dict] = {}
    for rid in ordered_ids:
        report = reports[rid]
        for result in report.results:
            entry = by_analyte.setdefault(result.analyte_name, {"unit": result.unit, "values": {}})
            entry["values"][rid] = schemas.TrendPoint(
                report_id=rid,
                collected_on=report.collected_on,
                value_text=result.value_text,
                value_numeric=result.value_numeric,
                comparator=result.comparator,
                unit=result.unit,
                ref_low=result.ref_low,
                ref_high=result.ref_high,
                flag=result.flag,
            )
            entry["unit"] = entry["unit"] or result.unit

    rows = []
    for name, entry in sorted(by_analyte.items(), key=lambda kv: kv[0].lower()):
        values = entry["values"]
        delta = percent = None
        if len(ordered_ids) >= 2:
            first, last = values.get(ordered_ids[0]), values.get(ordered_ids[-1])
            if first and last and first.value_numeric is not None and last.value_numeric is not None:
                delta = last.value_numeric - first.value_numeric
                if first.value_numeric != 0:
                    percent = (delta / first.value_numeric) * 100
        rows.append(
            schemas.CompareRow(
                analyte_name=name,
                unit=entry["unit"],
                values={rid: values.get(rid) for rid in ordered_ids},
                delta=delta,
                percent_change=percent,
            )
        )

    return schemas.CompareOut(report_ids=ordered_ids, rows=rows)
