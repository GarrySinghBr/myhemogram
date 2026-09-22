import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.parser import parse_pdf, parse_date

SAMPLE = os.path.join(os.path.dirname(__file__), "..", "..", "results", "CHEMISTRY and HEMATOLOGY.pdf")

# name -> (value, unit_or_None, ref_low, ref_high, flag)
EXPECTED = {
    "CREATININE": (70.0, "umol/L", 60.0, 110.0, None),
    "eGFR": (120.0, None, 60.0, None, None),
    "VITAMIN B12": (440.0, "pmol/L", 221.0, 918.0, None),
    "FERRITIN": (65.0, "ug/L", 30.0, 334.0, None),
    "GGT": (21.0, "U/L", None, 60.0, None),
    "AST": (30.0, "U/L", None, 37.0, None),
    "ALT": (49.0, "U/L", None, 46.0, "H"),
    "TSH": (2.05, "mIU/L", 0.35, 5.0, None),
    "HEMOGLOBIN A1c": (5.5, None, None, None, None),
    "TESTOSTERONE": (11.6, "nmol/L", 7.6, 31.4, None),
    "HEMOGLOBIN": (152.0, "g/L", 129.0, 165.0, None),
    "HEMATOCRIT": (0.48, "L/L", 0.39, 0.49, None),
    "RBC": (5.4, None, 4.2, 5.8, None),
    "MCV": (88.0, "fL", 80.0, 98.0, None),
    "MCH": (28.0, "pg", 24.0, 33.0, None),
    "MCHC": (319.0, "g/L", 313.0, 344.0, None),
    "RDW": (14.8, None, 12.5, 17.3, None),
    "WBC": (6.5, None, 3.2, 9.4, None),
    "PLATELETS": (304.0, None, 155.0, 372.0, None),
    "MPV": (9.4, "fL", 4.0, 14.0, None),
    "NEUTROPHILS": (3.3, None, 1.4, 6.3, None),
    "LYMPHOCYTES": (2.5, None, 1.0, 2.9, None),
    "MONOCYTES": (0.3, None, 0.2, 0.8, None),
    "EOSINOPHILS": (0.2, None, 0.0, 0.5, None),
    "BASOPHILS": (0.0, None, 0.0, 0.09, None),
}

COMMENT_SNIPPETS = [
    "CKD", "hematologic", "concomitant inflammation", "NON - DIABETIC",
]


def test_report_metadata():
    r = parse_pdf(SAMPLE)
    assert r.collected_on == "Nov/03/2025"
    assert parse_date(r.collected_on) == "2025-11-03"
    assert r.ordering_physician == "E. Elsayed"
    assert r.panels == ["CHEMISTRY", "HEMATOLOGY"]


def test_exact_result_count():
    r = parse_pdf(SAMPLE)
    # Exactly the real analytes -- no interpretive comment paragraph should
    # have leaked in as its own spurious result row.
    assert len(r.results) == len(EXPECTED), sorted(res.analyte_name for res in r.results)


def test_every_expected_analyte_present_and_correct():
    r = parse_pdf(SAMPLE)
    by_name = {res.analyte_name: res for res in r.results}
    assert set(by_name) == set(EXPECTED)
    for name, (value, unit, low, high, flag) in EXPECTED.items():
        res = by_name[name]
        assert res.value_numeric == value, f"{name}: value {res.value_numeric} != {value}"
        if unit is not None:
            assert res.unit == unit, f"{name}: unit {res.unit!r} != {unit!r}"
        assert res.ref_low == low, f"{name}: ref_low {res.ref_low} != {low}"
        assert res.ref_high == high, f"{name}: ref_high {res.ref_high} != {high}"
        assert res.flag == flag, f"{name}: flag {res.flag!r} != {flag!r}"


def test_no_comment_text_leaks_into_result_names_or_values():
    r = parse_pdf(SAMPLE)
    joined_names = " ".join(res.analyte_name for res in r.results)
    for snippet in COMMENT_SNIPPETS:
        assert snippet not in joined_names

    joined_values = " ".join(res.value_text for res in r.results)
    for snippet in COMMENT_SNIPPETS:
        assert snippet not in joined_values


def test_interpretive_notes_captured_not_lost():
    r = parse_pdf(SAMPLE)
    by_name = {res.analyte_name: res for res in r.results}
    assert "CKD" in (by_name["eGFR"].notes or "")
    assert "hematologic" in (by_name["VITAMIN B12"].notes or "")
    assert "concomitant" in (by_name["FERRITIN"].notes or "")
