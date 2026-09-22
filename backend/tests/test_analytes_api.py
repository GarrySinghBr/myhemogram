from .conftest import make_report, make_result


def _seed_two_reports(client):
    r1 = client.post("/api/reports", json=make_report(
        collected_on="2024-01-01",
        results=[make_result(analyte_name="CREATININE", value_numeric=80.0)],
    )).json()
    r2 = client.post("/api/reports", json=make_report(
        collected_on="2025-01-01",
        results=[make_result(analyte_name="CREATININE", value_numeric=70.0, flag="L")],
    )).json()
    return r1, r2


def test_list_analytes_reports_latest_value_and_point_count(client):
    _seed_two_reports(client)
    analytes = client.get("/api/analytes").json()
    assert len(analytes) == 1
    creatinine = analytes[0]
    assert creatinine["point_count"] == 2
    assert creatinine["latest_value_numeric"] == 70.0
    assert creatinine["latest_flag"] == "L"


def test_analyte_names_sort_case_insensitively(client):
    client.post("/api/reports", json=make_report(results=[
        make_result(analyte_name="eGFR", value_numeric=100.0),
        make_result(analyte_name="EOSINOPHILS", value_numeric=0.2),
        make_result(analyte_name="CREATININE"),
    ]))
    names = [a["analyte_name"] for a in client.get("/api/analytes").json()]
    assert names == ["CREATININE", "eGFR", "EOSINOPHILS"]


def test_trend_returns_full_history_oldest_first(client):
    _seed_two_reports(client)
    trend = client.get("/api/analytes/CREATININE/trend").json()
    assert [p["value_numeric"] for p in trend["points"]] == [80.0, 70.0]


def test_trend_for_unknown_analyte_returns_empty_points(client):
    trend = client.get("/api/analytes/NOT_A_REAL_TEST/trend").json()
    assert trend["points"] == []


def test_compare_computes_delta_between_first_and_last(client):
    r1, r2 = _seed_two_reports(client)
    resp = client.get(f"/api/compare?report_ids={r1['id']},{r2['id']}")
    assert resp.status_code == 200
    row = resp.json()["rows"][0]
    assert row["delta"] == -10.0
    assert row["percent_change"] == -12.5


def test_compare_rejects_malformed_ids(client):
    resp = client.get("/api/compare?report_ids=abc,def")
    assert resp.status_code == 400


def test_compare_rejects_empty_ids(client):
    resp = client.get("/api/compare?report_ids=")
    assert resp.status_code == 400


def test_compare_silently_drops_ids_that_do_not_exist(client):
    r1, _ = _seed_two_reports(client)
    resp = client.get(f"/api/compare?report_ids={r1['id']},99999")
    assert resp.status_code == 200
    assert resp.json()["report_ids"] == [r1["id"]]
