"""End-to-end tests against the /api routes (reports + results CRUD).

These exercise the HTTP layer with a real (throw-away) database rather than
calling router functions directly, so they also catch schema/route wiring
mistakes - a field missing from a Pydantic model, a route registered in the
wrong order, etc. - that a unit test calling Python functions directly would
miss.
"""
from .conftest import make_report, make_result


def test_create_and_fetch_report(client):
    payload = make_report(results=[make_result(), make_result(analyte_name="ALT", value_text="30.")])
    resp = client.post("/api/reports", json=payload)
    assert resp.status_code == 200
    created = resp.json()
    assert created["collected_on"] == "2025-01-15"
    assert len(created["results"]) == 2

    resp = client.get(f"/api/reports/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["ordering_physician"] == "Dr. Test"


def test_report_list_sorted_newest_first(client):
    client.post("/api/reports", json=make_report(collected_on="2024-01-01"))
    client.post("/api/reports", json=make_report(collected_on="2025-06-01"))
    resp = client.get("/api/reports")
    dates = [r["collected_on"] for r in resp.json()]
    assert dates == ["2025-06-01", "2024-01-01"]


def test_summary_counts_flagged_results_as_abnormal(client):
    payload = make_report(results=[
        make_result(analyte_name="ALT", flag="H"),
        make_result(analyte_name="AST", flag=None),
    ])
    client.post("/api/reports", json=payload)
    summary = client.get("/api/reports").json()[0]
    assert summary["result_count"] == 2
    assert summary["abnormal_count"] == 1


def test_report_needs_review_reflects_its_results(client):
    """A report created with one uncertain result should be flagged; fixing
    that result (or removing it) should clear the flag again - see
    routers/reports.py::_sync_needs_review."""
    payload = make_report(results=[
        make_result(analyte_name="ALT", needs_review=True),
        make_result(analyte_name="AST", needs_review=False),
    ])
    created = client.post("/api/reports", json=payload).json()
    assert created["needs_review"] is True

    flagged = next(r for r in created["results"] if r["analyte_name"] == "ALT")
    resp = client.put(f"/api/results/{flagged['id']}", json=make_result(analyte_name="ALT", needs_review=True))
    assert resp.status_code == 200
    assert resp.json()["needs_review"] is False, "editing a row should clear its own needs_review"

    report = client.get(f"/api/reports/{created['id']}").json()
    assert report["needs_review"] is False, "report flag should clear once no result needs review"


def test_deleting_the_flagged_result_clears_report_flag(client):
    payload = make_report(results=[make_result(needs_review=True)])
    created = client.post("/api/reports", json=payload).json()
    assert created["needs_review"] is True

    result_id = created["results"][0]["id"]
    resp = client.delete(f"/api/results/{result_id}")
    assert resp.status_code == 204

    report = client.get(f"/api/reports/{created['id']}").json()
    assert report["results"] == []
    assert report["needs_review"] is False


def test_add_result_to_existing_report(client):
    created = client.post("/api/reports", json=make_report(results=[make_result()])).json()
    resp = client.post(f"/api/reports/{created['id']}/results", json=make_result(analyte_name="WBC"))
    assert resp.status_code == 200
    report = client.get(f"/api/reports/{created['id']}").json()
    assert {r["analyte_name"] for r in report["results"]} == {"CREATININE", "WBC"}


def test_delete_report_cascades_to_its_results(client):
    created = client.post("/api/reports", json=make_report(results=[make_result()])).json()
    resp = client.delete(f"/api/reports/{created['id']}")
    assert resp.status_code == 204
    assert client.get(f"/api/reports/{created['id']}").status_code == 404
    assert client.get("/api/reports").json() == []


def test_missing_report_and_result_return_404(client):
    assert client.get("/api/reports/999").status_code == 404
    assert client.put("/api/results/999", json=make_result()).status_code == 404
    assert client.delete("/api/reports/999").status_code == 404
    assert client.delete("/api/results/999").status_code == 404
