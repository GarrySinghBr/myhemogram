"""Parser for the recurring lab-report PDF format (GDML/OHIP style).

The report is a table: NAME | RESULT | REF RANGE (UNITS) | ALERT | STATUS,
split into panels (e.g. CHEMISTRY, HEMATOLOGY), each with its own "Collected
On" date, and sub-grouped under bold labels (e.g. CREATININE, FERRITIN).

This module reconstructs that table from word positions (pdfplumber) rather
than raw text, because interpretive comment paragraphs are interleaved with
real result rows in the same columns as the reference range, and because long
analyte names sometimes wrap across lines with no reliable delimiter.

Nothing here hardcodes a fixed list of analytes -- new/removed tests in a
future report of the same layout are picked up automatically, purely from
column position + a handful of structural/regex heuristics. The output is
meant to be reviewed (and corrected) by the user before being saved, since a
few edge cases (see comments below) can't be resolved with 100% certainty
from a single sample report.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import pdfplumber

# --- Column boundaries (x0 pixel position), calibrated from this report's own
# header row: "NAME | RESULT | REF RANGE (UNITS) | ALERT | STATUS" ---
COL_NAME_MAX = 160
COL_RESULT_MAX = 355
COL_REF_MAX = 445
COL_ALERT_MAX = 485
# >= COL_ALERT_MAX is STATUS (observed to always be blank in the sample, kept
# for completeness / future reports that populate it)

HEADER_LABELS = {"NAME", "RESULT", "REF", "RANGE", "(UNITS)", "ALERT", "STATUS"}
CHROME_STARTS = (
    "ORDER PHYSICIAN", "REPORTED TO", "REQUESTED ON", "REPORTED ON",
    "ACCESSION NUMBER", "REPORTED BY", "LIST OF ABBREVIATIONS",
    "ABBREVIATION", "DEFINITION", "COMMENTS", "RE:", "PAGE",
)

NUMERIC_START_RE = re.compile(r"^(?:[<>]=?)?\s*-?\d")
DATE_RE = re.compile(r"[A-Za-z]{3}/\d{2}/\d{4}")
PUA_RE = re.compile(r"[-]")  # private-use-area icon glyphs

# Small, fixed set of English function/descriptive words used only to decide
# whether a stray line of text is prose (an interpretive comment) rather than
# a reference-range/unit fragment. This is generic English, not tied to any
# specific analyte, so it doesn't need updating as new tests appear -- the
# real signal is "is this line mostly lowercase natural-language words".
EXTRA_STOPWORDS = {
    "control", "optimal", "sub", "non", "diabetic", "inadequate",
    "is", "of", "to", "in", "on", "at", "by", "no", "an", "as", "be", "if",
    "are", "or", "and", "use",
}


def _clean(text: str) -> str:
    return PUA_RE.sub("", text).strip()


def _is_wordy(token: str) -> bool:
    m = re.fullmatch(r"[A-Za-z]{2,}[.,:;]?", token)
    if not m:
        return False
    core = token.rstrip(".,:;")
    if core.lower() in EXTRA_STOPWORDS:
        return True
    # A short lowercase token is more likely a unit abbreviation (pg, fl, ug,
    # ...) than a real word, so only trust length>=4 words as "prose" here.
    return core.islower() and len(core) >= 4


def _line_is_prose(tokens: list[str]) -> bool:
    return sum(1 for t in tokens if _is_wordy(t)) >= 2


def _join_name(parts: list[str]) -> str:
    """Join wrapped NAME-column fragments. A short (<=2 char) continuation is
    usually a hard mid-word wrap (e.g. TESTOSTERO/NE -> TESTOSTERONE); a
    longer one is usually a genuinely separate word (e.g. HEMOGLOBIN/A1c)."""
    out = parts[0]
    for p in parts[1:]:
        out = out + p if len(p) <= 2 else out + " " + p
    return out


def _dedupe_join(fragments: list[str]) -> str:
    out: list[str] = []
    for frag in fragments:
        frag = frag.strip()
        if not frag:
            continue
        if out and out[-1].lower() == frag.lower():
            continue
        out.append(frag)
    return " ".join(out)


def _analyte_from_raw(raw_name: str) -> str:
    # A few names carry an inline group prefix ("RBC INDICES: MCV") -- the
    # part after the last colon is the actual analyte.
    return raw_name.split(":")[-1].strip() if ":" in raw_name else raw_name


@dataclass
class ParsedResult:
    panel: str
    group_name: Optional[str]
    analyte_name: str
    raw_name: str
    value_text: str
    value_numeric: Optional[float]
    comparator: Optional[str]
    unit: Optional[str]
    ref_range_text: Optional[str]
    ref_low: Optional[float]
    ref_high: Optional[float]
    flag: Optional[str]
    notes: Optional[str]
    needs_review: bool = False


@dataclass
class ParsedReport:
    collected_on: Optional[str]
    requested_on: Optional[str]
    reported_on: Optional[str]
    ordering_physician: Optional[str]
    panels: list[str] = field(default_factory=list)
    results: list[ParsedResult] = field(default_factory=list)


def _parse_value(text: str) -> tuple[Optional[float], Optional[str]]:
    m = re.match(r"^(<=|>=|<|>)?\s*(-?\d+\.?\d*)", text)
    if not m:
        return None, None
    comparator, num = m.groups()
    try:
        return float(num), comparator
    except ValueError:
        return None, comparator


def _parse_ref_range(text: Optional[str]) -> tuple[Optional[float], Optional[float], Optional[str]]:
    if not text:
        return None, None, None
    cleaned = text.strip()
    low = high = None
    m = re.search(r"(-?\d+\.?\d*)\s*-\s*(-?\d+\.?\d*)", cleaned)
    if m:
        low, high = float(m.group(1)), float(m.group(2))
    else:
        m2 = re.search(r">=?\s*(-?\d+\.?\d*)", cleaned)
        if m2:
            low = float(m2.group(1))
        m3 = re.search(r"<=?\s*(-?\d+\.?\d*)", cleaned)
        if m3:
            high = float(m3.group(1))
    unit = None
    for tok in reversed(cleaned.split()):
        if re.search(r"[A-Za-z]", tok) and tok.rstrip(":").upper() not in {"M", "F"}:
            unit = tok
            break
    return low, high, unit


def _extract_rows(pdf) -> list[list[tuple[str, float]]]:
    """One entry per visual row (list of (text, x0)) across all pages, with
    repeating page chrome (headers/footers/legend/boilerplate) stripped out."""
    rows: list[list[tuple[str, float]]] = []
    for page in pdf.pages:
        words = page.extract_words(use_text_flow=False, keep_blank_chars=False)
        by_top: dict[int, list[dict]] = {}
        for w in words:
            text = _clean(w["text"])
            if not text:
                continue
            by_top.setdefault(round(w["top"]), []).append({**w, "text": text})
        for top in sorted(by_top.keys()):
            ws = sorted(by_top[top], key=lambda w: w["x0"])
            line_text = " ".join(w["text"] for w in ws)
            upper = line_text.upper()
            if upper.startswith("LIST OF ABBREVIATIONS"):
                # Everything from here on is the abbreviation legend and
                # reviewer sign-off -- not test data, for the rest of the doc.
                return rows
            if any(upper.startswith(c) for c in CHROME_STARTS):
                continue
            if set(w["text"] for w in ws) <= HEADER_LABELS:
                continue
            if re.match(r"^Page \d+ of \d+$", line_text.strip()):
                continue
            rows.append([(w["text"], w["x0"]) for w in ws])
    return rows


def _row_cols(row: list[tuple[str, float]]) -> dict[str, list[str]]:
    cols: dict[str, list[str]] = {"name": [], "result": [], "ref": [], "alert": [], "status": []}
    for text, x0 in row:
        if x0 < COL_NAME_MAX:
            cols["name"].append(text)
        elif x0 < COL_RESULT_MAX:
            cols["result"].append(text)
        elif x0 < COL_REF_MAX:
            cols["ref"].append(text)
        elif x0 < COL_ALERT_MAX:
            cols["alert"].append(text)
        else:
            cols["status"].append(text)
    return cols


def _looks_like_result(name_tokens: list[str], result_tokens: list[str]) -> bool:
    """True if this row's own columns describe a real numeric result, either
    NAME + numeric RESULT, or a lone numeric token sitting in the NAME slot
    (some rows render the value there when the name was a group header)."""
    name_txt = " ".join(name_tokens)
    result_txt = " ".join(result_tokens)
    if name_txt and NUMERIC_START_RE.match(result_txt.strip()):
        return True
    if not result_tokens and len(name_tokens) == 1 and NUMERIC_START_RE.match(name_tokens[0]):
        return True
    return False


def parse_pdf(path: str) -> ParsedReport:
    with pdfplumber.open(path) as pdf:
        rows = _extract_rows(pdf)

    report = ParsedReport(collected_on=None, requested_on=None, reported_on=None, ordering_physician=None)

    current_panel: Optional[str] = None
    current_group: Optional[str] = None
    awaiting_group_value: Optional[str] = None
    just_set_group = False

    pending: Optional[ParsedResult] = None
    ref_fragments: list[str] = []
    note_fragments: list[str] = []
    in_notes = False

    def flush_pending():
        nonlocal pending, ref_fragments, note_fragments, in_notes
        if pending is not None:
            extra_ref = _dedupe_join(ref_fragments)
            if extra_ref:
                pending.ref_range_text = _dedupe_join(
                    ([pending.ref_range_text] if pending.ref_range_text else []) + [extra_ref]
                )
            if pending.ref_range_text:
                low, high, unit = _parse_ref_range(pending.ref_range_text)
                pending.ref_low = low if pending.ref_low is None else pending.ref_low
                pending.ref_high = high if pending.ref_high is None else pending.ref_high
                pending.unit = pending.unit or unit
            if note_fragments:
                pending.notes = _dedupe_join(note_fragments)
            report.results.append(pending)
        pending = None
        ref_fragments = []
        note_fragments = []
        in_notes = False

    n = len(rows)
    i = 0
    while i < n:
        row = rows[i]
        cols = _row_cols(row)
        name_txt = " ".join(cols["name"])
        result_txt = " ".join(cols["result"])
        ref_txt = " ".join(cols["ref"])
        alert_txt = " ".join(cols["alert"])
        full_row_text = " ".join(t for t, _ in row)

        # --- Panel header: an all-caps label followed shortly by "Collected On <date>" ---
        lookahead_text = " ".join(" ".join(t for t, _ in rows[j]) for j in range(i + 1, min(i + 3, n)))
        if (
            name_txt and not cols["result"] and not cols["ref"]
            and "Collected" in lookahead_text and "On" in lookahead_text
            and name_txt.strip().isupper()
        ):
            flush_pending()
            current_panel = name_txt.strip()
            current_group = None
            awaiting_group_value = None
            just_set_group = False
            report.panels.append(current_panel)
            for j in range(i + 1, min(i + 3, n)):
                dm = DATE_RE.search(" ".join(t for t, _ in rows[j]))
                if dm:
                    if report.collected_on is None:
                        report.collected_on = dm.group(0)
                    break
            i += 1
            continue

        # --- Ordering physician: a short "X. Lastname" line outside the table ---
        if re.match(r"^[A-Z]\.\s*[A-Za-z]+$", name_txt.strip()) and not cols["result"] and not cols["ref"]:
            if report.ordering_physician is None:
                report.ordering_physician = name_txt.strip()
            i += 1
            continue

        # --- Requested-on / reported-on dates line ---
        dates_in_row = DATE_RE.findall(full_row_text)
        if len(dates_in_row) >= 2:
            if report.requested_on is None:
                report.requested_on = dates_in_row[0]
            if report.reported_on is None:
                report.reported_on = dates_in_row[1]
            i += 1
            continue

        has_name = bool(cols["name"])
        is_result_row = _looks_like_result(cols["name"], cols["result"])

        if is_result_row:
            flush_pending()
            bare_value = not cols["result"]
            if bare_value:
                raw_name = awaiting_group_value or name_txt.strip()
                value_source = cols["name"][0]
            else:
                raw_name = name_txt.strip()
                value_source = result_txt
            value_numeric, comparator = _parse_value(value_source)
            ref_low, ref_high, unit = _parse_ref_range(ref_txt)
            pending = ParsedResult(
                panel=current_panel or "",
                group_name=current_group,
                analyte_name=_analyte_from_raw(raw_name),
                raw_name=raw_name,
                value_text=value_source.strip(),
                value_numeric=value_numeric,
                comparator=comparator,
                unit=unit,
                ref_range_text=ref_txt.strip() or None,
                ref_low=ref_low,
                ref_high=ref_high,
                flag=alert_txt.strip() or None,
                notes=None,
                needs_review=value_numeric is None,
            )
            current_group = None
            awaiting_group_value = None
            just_set_group = False
            i += 1
            continue

        if has_name and not cols["result"] and not cols["ref"]:
            fragment = name_txt.strip()
            if pending is not None and not in_notes and not just_set_group and len(fragment) <= 4:
                # Short mid-word wrap of the current pending result's name
                # (e.g. "TESTOSTERO" + "NE", "LYMPHOCYTE" + "S", "...: MCV").
                pending.raw_name = _join_name([pending.raw_name, fragment])
                pending.analyte_name = _analyte_from_raw(pending.raw_name)
            elif just_set_group:
                # Second (or later) line of a multi-line group header, e.g.
                # "DIFFERENTIAL" / "WBC'S".
                current_group = _join_name([current_group or "", fragment]).strip()
                awaiting_group_value = current_group
            else:
                # Look ahead (skipping further name-only lines) for a real
                # result before deciding this introduces a new group.
                j = i + 1
                found_result = False
                while j < n and j - i <= 4:
                    jcols = _row_cols(rows[j])
                    j_name_txt = " ".join(jcols["name"])
                    if _looks_like_result(jcols["name"], jcols["result"]):
                        found_result = True
                        break
                    if jcols["ref"] or jcols["alert"] or jcols["result"] or not j_name_txt:
                        break
                    j += 1
                if found_result:
                    current_group = fragment
                    awaiting_group_value = fragment
                    just_set_group = True
                elif pending is not None and in_notes:
                    # Stray word wrapped out of an in-progress comment
                    # paragraph (e.g. "...if risk factors are\npresent").
                    note_fragments.append(fragment)
                elif pending is not None:
                    pending.raw_name = _join_name([pending.raw_name, fragment])
                    pending.analyte_name = _analyte_from_raw(pending.raw_name)
                else:
                    current_group = fragment
                    awaiting_group_value = fragment
                    just_set_group = True
            i += 1
            continue

        if has_name:
            # NAME populated but RESULT isn't a clean number -- an
            # interpretive comment paragraph that repeats the analyte label.
            if pending is not None:
                in_notes = True
                note_fragments.append(_dedupe_join(cols["name"] + cols["result"] + cols["ref"]))
            i += 1
            continue

        if cols["result"] or cols["ref"] or cols["alert"]:
            fragment_tokens = cols["result"] + cols["ref"] + cols["alert"]
            if pending is not None:
                if not in_notes and not _line_is_prose(fragment_tokens):
                    ref_fragments.append(" ".join(fragment_tokens))
                else:
                    in_notes = True
                    note_fragments.append(" ".join(fragment_tokens))
            i += 1
            continue

        i += 1

    flush_pending()
    return report


def parse_date(value: Optional[str]) -> Optional[str]:
    """'Nov/03/2025' -> '2025-11-03' (ISO), or None."""
    if not value:
        return None
    try:
        return datetime.strptime(value, "%b/%d/%Y").date().isoformat()
    except ValueError:
        return None
