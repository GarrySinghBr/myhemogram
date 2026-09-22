"""SQLite storage for the local app.

Everything lives under backend/data/ next to the source tree rather than in
a system config directory - this is a single-user local app, not a service
with multiple installs, so keeping the database and archived PDFs alongside
the code makes it obvious where a user's data is and easy to back up.
"""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
PDF_DIR = os.path.join(DATA_DIR, "pdfs")
os.makedirs(PDF_DIR, exist_ok=True)

DB_PATH = os.path.join(DATA_DIR, "hemogram.db")

# check_same_thread=False: FastAPI can service a single request's dependency
# (get_db below) on a different thread than the one the connection was
# opened on. That's safe here because each request gets its own Session from
# SessionLocal and nothing shares a connection across threads concurrently.
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency: yields one Session per request, always closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create any tables that don't exist yet. No migration framework - the
    schema is small enough that a fresh `create_all` covers local dev, and
    SQLite's ALTER TABLE support is limited anyway. If the schema needs to
    change after users have real data, this is the place a migration step
    (e.g. Alembic) would get wired in."""
    from . import models  # noqa: F401  (import registers the models with Base.metadata)

    Base.metadata.create_all(bind=engine)
