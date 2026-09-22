"""Shared pytest fixtures for the API tests.

Each test gets its own throw-away SQLite file (via pytest's tmp_path) and a
TestClient wired to it through FastAPI's dependency-override mechanism, so
tests never read or write backend/data/hemogram.db - the database a real
user's reports would live in.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base, get_db
from app.main import app


@pytest.fixture()
def client(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}", connect_args={"check_same_thread": False}
    )
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def make_result(**overrides):
    """A minimal valid ResultIn payload, with any field overridden."""
    result = {
        "analyte_name": "CREATININE",
        "value_text": "70.",
        "value_numeric": 70.0,
        "unit": "umol/L",
        "ref_low": 60.0,
        "ref_high": 110.0,
    }
    result.update(overrides)
    return result


def make_report(**overrides):
    report = {"collected_on": "2025-01-15", "ordering_physician": "Dr. Test", "results": []}
    report.update(overrides)
    return report
