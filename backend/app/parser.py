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
from typing import NamedTuple, Optional

import pdfplumber


@dataclass
class Columns:
    """Column boundaries (x0 position): a word left of `name_max` is in NAME,
    then RESULT, REF RANGE, ALERT, and anything past `alert_max` is STATUS.

    The defaults were calibrated from the sample report's header row
    ("NAME | RESULT | REF RANGE (UNITS) | ALERT | STATUS"), but
    `_detect_columns` re-derives them from each PDF's own header so a report
    laid out slightly differently (other margins, page width) still parses.
    """
    name_max: float = 160
    result_max: float = 355
    ref_max: float = 445
    alert_max: float = 485


def _detect_columns(header_words: dict[str, float]) -> Columns:
    """Boundaries from the x0 of the header labels, using the same offsets the
    hand-calibrated defaults had relative to them (result values start ~4pt
    right of the boundary, wrapped ref text starts ~15pt left of the RESULT
    -> REF boundary, etc.). Falls back to the defaults for anything missing."""
    cols = Columns()
    if "RESULT" in header_words and "REF" in header_words:
        cols.name_max = header_words["RESULT"] - 4
        cols.result_max = header_words["REF"] - 15
        if "ALERT" in header_words:
            cols.ref_max = header_words["ALERT"] - 7
            if "STATUS" in header_words:
                cols.alert_max = header_words["STATUS"] - 8
            else:
                cols.alert_max = cols.ref_max + 40
    return cols


class Row(NamedTuple):
    words: list  # [(text, x0)] left to right
    page: int
    top: float
    size: float  # font size, used to judge "is this the next line of the same block"
    bold: bool  # every word bold: a group/section header, not an ordinary row
    first_on_page: bool = False
    last_on_page: bool = False

HEADER_LABELS = {"NAME", "RESULT", "REF", "RANGE", "(UNITS)", "ALERT", "STATUS"}
CHROME_PATTERNS = (
    re.compile(r"reviewed this file", re.I),  # reviewer sign-off at the end...
    re.compile(r"^[A-Z][a-z]{2} \d{1,2},? \d{4},? \d{1,2}:\d{2}\s*[AP]M$"),  # ...and its timestamp
)
CHROME_STARTS = (
    "ORDER PHYSICIAN", "REPORTED TO", "REQUESTED ON", "REPORTED ON",
    "ACCESSION NUMBER", "REPORTED BY", "LIST OF ABBREVIATIONS",
    "ABBREVIATION", "DEFINITION", "COMMENTS", "RE:", "PAGE",
)

NUMERIC_START_RE = re.compile(r"^(?:[<>]=?)?\s*-?\d")
DATE_RE = re.compile(r"[A-Za-z]{3}/\d{2}/\d{4}")
PUA_RE = re.compile("[" + chr(0xE000) + "-" + chr(0xF8FF) + "]")  # PDF icon glyphs live in the Unicode Private Use Area

# Small, fixed set of English function/descriptive words used only to decide
# whether a stray line of text is prose (an interpretive comment) rather than
# a reference-range/unit fragment. This is generic English, not tied to any
# specific analyte, so it doesn't need updating as new tests appear -- the
# real signal is "is this line mostly lowercase natural-language words".
EXTRA_STOPWORDS = {
    "control", "optimal", "sub", "non", "diabetic", "inadequate",
    "is", "of", "to", "in", "on", "at", "by", "no", "an", "as", "be", "if",
    "are", "or", "and", "use", "was", "the", "for", "with", "not", "may",
    "see", "can", "has", "have", "this", "that", "than", "from", "when",
}

# Generic unit vocabulary, only used to recognise "this fragment is a
# reference range / unit, not prose" -- like the stopwords, it isn't tied to
# any particular analyte. Anything containing / % * ^ is treated as a unit
# on shape alone (mmol/L, 10E9/L, mL/min/1.73m**2, %).
UNIT_WORDS = {
    "x", "fl", "pg", "ug", "mg", "g", "l", "dl", "ml", "hrs", "hr", "hours",
    "iu", "u", "mol", "min", "sec", "mm", "cm", "kg", "ng", "nmol", "umol",
    "mmol", "pmol", "meq", "mosm", "cells",
}
NUMBER_TOKEN_RE = re.compile(r"^[<>=]{0,2}-?\d[\d.,]*[.:]?$")
OPERATOR_TOKENS = {"-", "–", "=", "<", ">", "<=", ">=", "to"}
SEX_PREFIX_RE = re.compile(r"^(?:[MF]|male|female)s?:$", re.I)
FUSED_NUMBER_UNIT_RE = re.compile(r"^([<>=]{0,2}-?\d+\.?\d*)(x\d.*)$")  # "0.09x10E9/L"
UNIT_SHAPE_RE = re.compile(r"^[A-Za-z0-9µμ%*^./\-]{1,18}$")


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
    usually a hard mid-word wrap (e.g. TESTOSTERO/NE -> TESTOSTERONE) and a
    fragment after a trailing hyphen continues the same word (NON-HDL- /
    CHOLESTEROL); a longer one is usually a genuinely separate word (e.g.
    HEMOGLOBIN/A1c)."""
    out = parts[0]
    for p in parts[1:]:
        out = out + p if (len(p) <= 2 or out.endswith("-")) else out + " " + p
    return out


def _dedupe_join(fragments: list[str]) -> str:
    """Join fragments with spaces, dropping a fragment that's an exact
    (case-insensitive) repeat of the one before it - the source PDF often
    prints a unit twice (once inline, once as a small badge)."""
    out: list[str] = []
    for frag in fragments:
        frag = frag.strip()
        if not frag:
            continue
        if out and out[-1].lower() == frag.lower():
            continue
        out.append(frag)
    return " ".join(out)


def _normalize_name(name: str) -> str:
    """Canonical analyte name so the same test matches across reports: single
    spaces, no gap after a hyphen ("NON-HDL- CHOLESTEROL"), and a closing
    bracket if the PDF clipped one off ("(CALC")."""
    name = re.sub(r"\s+", " ", name).strip()
    name = re.sub(r"(?<=-) (?=[A-Za-z])", "", name)
    if name.count("(") > name.count(")"):
        name += ")" * (name.count("(") - name.count(")"))
    return name


def _analyte_from_raw(raw_name: str) -> str:
    # A few names carry an inline group prefix ("RBC INDICES: MCV") -- the
    # part after the last colon is the actual analyte.
    return _normalize_name(raw_name.split(":")[-1] if ":" in raw_name else raw_name)


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
    """Split a result like '>=120.' into (120.0, '>='). Returns (None, None)
    for anything that doesn't start with a number (categorical results like
    HbA1c's text stay in value_text only, with value_numeric left unset)."""
    m = re.match(r"^(<=|>=|<|>)?\s*(-?\d+\.?\d*)", text)
    if not m:
        return None, None
    comparator, num = m.groups()
    try:
        return float(num), comparator
    except ValueError:
        return None, comparator


def _clean_value(text: str) -> str:
    """The lab prints whole numbers with a trailing period ("67.", ">=120.")."""
    text = text.strip()
    return re.sub(r"(?<=\d)\.$", "", text)


# --- Reference range / unit fragments -------------------------------------


def _norm_unit(unit: str) -> str:
    # The lab prints each unit twice, once human-style (x10E9/L) and once
    # UCUM-style (10*9/L); keep the human-style spelling.
    return re.sub(r"10\*(\d+)", r"10E\1", unit)


def _is_unit_token(tok: str) -> bool:
    if not UNIT_SHAPE_RE.match(tok) or tok.endswith(":"):
        return False
    if re.fullmatch(r"[\d.,]+", tok):
        return False
    if any(c in tok for c in "/%*^"):
        return True
    return tok.lower() in UNIT_WORDS


def _tokenize_ref(tokens: list[str]) -> list[str]:
    """Split fused number+unit tokens ("0.09x10E9/L") and re-join a unit the
    PDF wrapped after a slash ("mL/min/" + "1.73m**2")."""
    out: list[str] = []
    for tok in " ".join(tokens).split():
        m = FUSED_NUMBER_UNIT_RE.match(tok)
        if m and _is_unit_token(m.group(2)):
            out.extend([m.group(1), m.group(2)])
        else:
            out.append(tok)
    joined: list[str] = []
    for tok in out:
        if joined and joined[-1].endswith("/") and _is_unit_token(tok):
            joined[-1] += tok
        else:
            joined.append(tok)
    return joined


def _is_range_fragment(tokens: list[str]) -> bool:
    """True if every token is something a reference range / unit is made of
    (numbers, comparators, '-', 'M:'/'F:', unit-shaped words). Prose and
    interpretive comments always contain at least one token that isn't."""
    toks = _tokenize_ref(tokens)
    if not toks:
        return False
    for tok in toks:
        if NUMBER_TOKEN_RE.match(tok) or tok.lower() in OPERATOR_TOKENS:
            continue
        if SEX_PREFIX_RE.match(tok) or _is_unit_token(tok):
            continue
        return False
    return True


def _build_ref(tokens: list[str]) -> tuple[Optional[str], Optional[float], Optional[float], Optional[str]]:
    """(ref_range_text, low, high, unit) from range-fragment tokens.

    Handles a plain 'A - B unit' range and one-sided '>=A' / '<B' ranges.
    All-None low/high with a non-empty text isn't a bug, just "this
    reference range isn't a simple numeric interval"."""
    toks = _tokenize_ref(tokens)
    body: list[str] = []
    units: dict[str, str] = {}  # de-duplicated key -> spelling; the later copy wins (proper case)
    i = 0
    while i < len(toks):
        tok = toks[i]
        if tok.lower() == "x" and i + 1 < len(toks) and _is_unit_token(toks[i + 1]):
            tok = "x " + toks[i + 1]
            i += 1
        i += 1
        if tok.lower() in OPERATOR_TOKENS or NUMBER_TOKEN_RE.match(tok) or SEX_PREFIX_RE.match(tok):
            body.append(re.sub(r"(?<=\d)\.$", "", tok))
            continue
        unit = _norm_unit(tok)
        key = re.sub(r"\s", "", unit).lower()
        units[key] = unit
    unit_list = list(units.values())
    unit_text = unit_list[0] if unit_list else None
    text = " ".join(body + unit_list).strip() or None
    if not text:
        return None, None, None, None
    low = high = None
    num = r"(-?\d+\.?\d*)"
    m = re.search(num + r"\s*-\s*" + num, " ".join(body))
    if m:
        low, high = float(m.group(1)), float(m.group(2))
    else:
        joined = " ".join(body)
        m2 = re.search(r"(?:>=?|=)\s*" + num, joined)
        if m2:
            low = float(m2.group(1))
        m3 = re.search(r"<=?\s*" + num, joined)
        if m3:
            high = float(m3.group(1))
    return text, low, high, unit_text


# --- PDF -> rows -----------------------------------------------------------


def _extract_rows(pdf) -> tuple[list[Row], Columns]:
    """One entry per visual row across all pages, with repeating page chrome
    (headers/footers/legend/boilerplate) stripped out, plus the column layout
    read from the table header."""
    rows: list[Row] = []
    header_x: dict[str, float] = {}
    for page_no, page in enumerate(pdf.pages):
        words = page.extract_words(use_text_flow=False, keep_blank_chars=False, extra_attrs=["fontname", "size"])
        by_top: dict[int, list[dict]] = {}
        for w in words:
            text = _clean(w["text"])
            if not text:
                continue
            by_top.setdefault(round(w["top"]), []).append({**w, "text": text})
        page_rows: list[Row] = []
        for top in sorted(by_top.keys()):
            ws = sorted(by_top[top], key=lambda w: w["x0"])
            line_text = " ".join(w["text"] for w in ws)
            upper = line_text.upper()
            if upper.startswith("LIST OF ABBREVIATIONS"):
                # Everything from here on is the abbreviation legend and
                # reviewer sign-off -- not test data, for the rest of the doc.
                rows.extend(_mark_page_edges(page_rows))
                return rows, _detect_columns(header_x)
            if any(upper.startswith(c) for c in CHROME_STARTS):
                continue
            if any(p.search(line_text) for p in CHROME_PATTERNS):
                continue
            if set(w["text"] for w in ws) <= HEADER_LABELS:
                for w in ws:
                    header_x.setdefault(w["text"].upper(), w["x0"])
                continue
            if re.match(r"^Page \d+ of \d+$", line_text.strip()):
                continue
            page_rows.append(Row(
                words=[(w["text"], w["x0"]) for w in ws],
                page=page_no,
                top=min(w["top"] for w in ws),
                size=max(w.get("size") or 0 for w in ws),
                bold=all("bold" in (w.get("fontname") or "").lower() for w in ws),
            ))
        rows.extend(_mark_page_edges(page_rows))
    return rows, _detect_columns(header_x)


def _mark_page_edges(page_rows: list[Row]) -> list[Row]:
    if page_rows:
        page_rows[0] = page_rows[0]._replace(first_on_page=True)
        page_rows[-1] = page_rows[-1]._replace(last_on_page=True)
    return page_rows


def _row_cols(row: Row, layout: Columns) -> dict[str, list[str]]:
    cols: dict[str, list[str]] = {"name": [], "result": [], "ref": [], "alert": [], "status": []}
    for text, x0 in row.words:
        if x0 < layout.name_max:
            cols["name"].append(text)
        elif x0 < layout.result_max:
            cols["result"].append(text)
        elif x0 < layout.ref_max:
            cols["ref"].append(text)
        elif x0 < layout.alert_max:
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


def _looks_like_categorical(cols: dict[str, list[str]]) -> bool:
    """A result whose value is a word rather than a number ("NEGATIVE",
    "Not Detected"): an analyte-style (all-caps or single-token) NAME plus a
    short, non-prose RESULT. Deliberately narrow -- a false positive here
    would turn a comment line into a fake result -- and such rows are always
    flagged for review."""
    name, result = cols["name"], cols["result"]
    if not name or not 1 <= len(result) <= 3:
        return False
    name_txt = " ".join(name)
    if not (name_txt == name_txt.upper() or len(name) == 1):
        return False
    if result[0][0].islower() or _line_is_prose(result) or _line_is_prose(name):
        return False
    return not cols["ref"] or _is_range_fragment(cols["ref"])


def _panel_at(rows: list[Row], i: int, layout: Columns) -> Optional[str]:
    """Panel name if row i is a panel header: an all-caps label followed
    shortly by "Collected On <date>"."""
    n = len(rows)
    cols = _row_cols(rows[i], layout)
    name_txt = " ".join(cols["name"])
    lookahead_text = " ".join(" ".join(t for t, _ in rows[j].words) for j in range(i + 1, min(i + 3, n)))
    if (
        name_txt and not cols["result"] and not cols["ref"]
        and "Collected" in lookahead_text and "On" in lookahead_text
        and name_txt.strip().isupper()
    ):
        return name_txt.strip()
    return None


def parse_pdf(path: str) -> ParsedReport:
    with pdfplumber.open(path) as pdf:
        rows, layout = _extract_rows(pdf)

    report = ParsedReport(collected_on=None, requested_on=None, reported_on=None, ordering_physician=None)

    current_panel: Optional[str] = None
    current_group: Optional[str] = None
    awaiting_group_value: Optional[str] = None
    just_set_group = False

    pending: Optional[ParsedResult] = None
    ref_tokens: list[str] = []
    note_fragments: list[str] = []
    in_notes = False
    # Where the pending result's NAME column last had text -- the next
    # name-only line is a wrap of that name only if it sits right below it.
    name_pos: Optional[Row] = None
    # Name-only lines seen before their result row (some layouts put a name's
    # first line above the value, sometimes across a page break).
    prefix: list[Row] = []

    def near(prev: Row, row: Row) -> bool:
        """Is `row` the next line of the same table cell as `prev`?"""
        gap = 1.45 * (row.size or prev.size or 10.5)
        if row.page == prev.page:
            return 0 <= row.top - prev.top <= gap
        return row.page == prev.page + 1 and prev.last_on_page and row.first_on_page

    def flush_pending():
        nonlocal pending, ref_tokens, note_fragments, in_notes, name_pos
        if pending is not None:
            if ref_tokens:
                text, low, high, unit = _build_ref(ref_tokens)
                pending.ref_range_text = text
                pending.ref_low, pending.ref_high = low, high
                pending.unit = unit
            if note_fragments:
                pending.notes = _dedupe_join(note_fragments)
            report.results.append(pending)
        pending = None
        ref_tokens = []
        note_fragments = []
        in_notes = False
        name_pos = None

    has_panels = any(_panel_at(rows, k, layout) for k in range(len(rows)))
    n = len(rows)
    i = 0
    while i < n:
        row = rows[i]
        cols = _row_cols(row, layout)
        name_txt = " ".join(cols["name"])
        result_txt = " ".join(cols["result"])
        ref_txt = " ".join(cols["ref"])
        alert_txt = " ".join(cols["alert"])
        full_row_text = " ".join(t for t, _ in row.words)

        # --- Panel header ---
        panel = _panel_at(rows, i, layout)
        if panel:
            flush_pending()
            prefix = []
            current_panel = panel
            current_group = None
            awaiting_group_value = None
            just_set_group = False
            report.panels.append(current_panel)
            for j in range(i + 1, min(i + 3, n)):
                dm = DATE_RE.search(" ".join(t for t, _ in rows[j].words))
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

        # Patient/lab letterhead before the first panel isn't table content.
        if has_panels and current_panel is None:
            i += 1
            continue

        has_name = bool(cols["name"])
        is_numeric_row = _looks_like_result(cols["name"], cols["result"])
        is_categorical_row = (
            not is_numeric_row and not row.bold and (not in_notes or bool(cols["ref"]))
            and _looks_like_categorical(cols)
        )

        if is_numeric_row or is_categorical_row:
            flush_pending()
            bare_value = not cols["result"]
            if bare_value:
                raw_name = awaiting_group_value or name_txt.strip()
                value_source = cols["name"][0]
            else:
                raw_name = name_txt.strip()
                value_source = result_txt
            if prefix and near(prefix[-1], row):
                raw_name = _join_name([" ".join(t for t, _ in p.words) for p in prefix] + [raw_name])
            prefix = []
            value_numeric, comparator = _parse_value(value_source)
            ref_ok = bool(cols["ref"]) and _is_range_fragment(cols["ref"])
            pending = ParsedResult(
                panel=current_panel or "",
                group_name=current_group,
                analyte_name=_analyte_from_raw(raw_name),
                raw_name=raw_name,
                value_text=_clean_value(value_source),
                value_numeric=value_numeric,
                comparator=comparator,
                unit=None,
                ref_range_text=None,
                ref_low=None,
                ref_high=None,
                # An ALERT flag is a short code (H, L, HH, *...); anything
                # longer is stray text that landed in the column.
                flag=alert_txt.strip() if 0 < len(alert_txt.strip()) <= 4 else None,
                notes=None,
                needs_review=value_numeric is None,
            )
            ref_tokens = list(cols["ref"]) if ref_ok else []
            if cols["ref"] and not ref_ok:
                in_notes = True
                note_fragments.append(ref_txt)
            name_pos = row
            current_group = None
            awaiting_group_value = None
            just_set_group = False
            i += 1
            continue

        # --- Bold non-result row: a group header ("CREATININE", "DIFFERENTIAL WBC'S") ---
        if row.bold and has_name:
            flush_pending()
            prefix = []
            text = " ".join(cols["name"] + cols["result"]).strip()
            current_group = _join_name([current_group or "", text]).strip() if just_set_group else text
            awaiting_group_value = current_group
            just_set_group = True
            i += 1
            continue

        if has_name and not cols["result"] and not cols["ref"]:
            fragment = name_txt.strip()
            nxt = rows[i + 1] if i + 1 < n else None
            if (
                pending is not None and name_pos is not None and near(name_pos, row)
                # A comment paragraph can also start in the NAME column, so once
                # notes have begun only an analyte-style (all-caps) line counts
                # as another line of the name.
                and (not in_notes or fragment == fragment.upper())
            ):
                # Continuation line of the pending result's name (e.g.
                # "TESTOSTERO" + "NE", "ALKALINE" / "PHOSPHATAS" / "E").
                pending.raw_name = _join_name([pending.raw_name, fragment])
                pending.analyte_name = _analyte_from_raw(pending.raw_name)
                name_pos = row
            elif nxt is not None and _looks_like_result(*(_row_cols(nxt, layout)[k] for k in ("name", "result"))) and (
                near(row, nxt) or (row.last_on_page and nxt.first_on_page)
            ):
                # First line(s) of the *next* result's name.
                if prefix and not near(prefix[-1], row):
                    prefix = []
                prefix.append(row)
            elif pending is not None:
                # Stray word wrapped out of an in-progress comment paragraph
                # (e.g. "...if risk factors are\npresent").
                in_notes = True
                note_fragments.append(fragment)
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
                if not in_notes and _is_range_fragment(fragment_tokens):
                    ref_tokens.extend(fragment_tokens)
                else:
                    in_notes = True
                    note_fragments.append(" ".join(fragment_tokens))
            i += 1
            continue

        i += 1

    flush_pending()
    if not report.results:
        raise ValueError(
            "no lab results found - this doesn't look like a NAME / RESULT / REF RANGE lab report "
            "(is it a scanned image rather than a text PDF?)"
        )
    return report


def parse_date(value: Optional[str]) -> Optional[str]:
    """'Nov/03/2025' -> '2025-11-03' (ISO), or None."""
    if not value:
        return None
    try:
        return datetime.strptime(value, "%b/%d/%Y").date().isoformat()
    except ValueError:
        return None
