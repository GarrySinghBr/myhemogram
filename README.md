# MyHemogram

A local, private blood-work tracker. Import the PDF lab reports you get from
your doctor, and it parses out every test result, stores it, and lets you
view a single report, compare two reports side by side, and see the
lifetime trend of any analyte. Everything stays on your machine — there's
no cloud sync, no external service; data lives in a SQLite file under
`backend/data/`.

## How it's built

- **`backend/`** — Python (FastAPI + SQLAlchemy + SQLite).
  - `app/parser.py` turns a lab PDF into structured results using each row's
    column position on the page (not a fixed list of test names), so a
    report with more or fewer tests than usual still parses.
  - `app/models.py` / `app/db.py` are the SQLite storage.
  - `app/routers/` is the REST API: `reports.py` for report/result CRUD and
    the PDF import flow, `analytes.py` for the cross-report views (trend,
    compare) that read across every report by analyte name.
- **`frontend/`** — React (Vite, no TypeScript). One page per major view
  (`src/pages/`) plus shared pieces in `src/components/`. `src/themes.js`
  drives the live color-theme switcher; `src/api.js` is the only place that
  talks to the backend.

```
backend/
  app/
    main.py        FastAPI app + SPA static-file serving
    db.py          SQLite engine/session
    models.py      SQLAlchemy tables (Report, Result)
    schemas.py     Pydantic request/response shapes
    parser.py      PDF -> structured results
    routers/       reports.py, analytes.py
  tests/           pytest (parser + full API, see below)
frontend/
  src/
    pages/         Dashboard, Import, ReportDetail, Trends, Compare
    components/    shared UI (charts, badges, the review table, ...)
    api.js, utils.js, themes.js, analyteInfo.js
```

Every PDF import goes through a **review screen** before anything is saved,
so you can fix or add rows the parser missed — it was built against one lab's
report layout and may not get every edge case perfect on a new one. A row
the parser wasn't confident about is flagged (`needs_review`) until someone
edits and confirms it, both on the review screen and after saving.

## Running it

You need Python 3.11+ and Node 18+.

**First time setup:**

```bash
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt      # Windows
# .venv/bin/pip install -r requirements.txt         # macOS/Linux

cd ../frontend
npm install
```

**Day-to-day (two terminals):**

```bash
# Terminal 1 — backend, http://127.0.0.1:8899
cd backend
.venv/Scripts/python -m uvicorn app.main:app --port 8899   # Windows
# .venv/bin/python -m uvicorn app.main:app --port 8899      # macOS/Linux

# Terminal 2 — frontend, http://localhost:5173
cd frontend
npm run dev
```

Open **http://localhost:5173** — that's the app. The Vite dev server proxies
`/api` requests to the backend, so both need to be running.

**Single-command / production-ish option:** build the frontend once and let
the backend serve it directly, so you only need one process:

```bash
cd frontend && npm run build
cd ../backend && .venv/Scripts/python -m uvicorn app.main:app --port 8899
```

Then open **http://127.0.0.1:8899** instead. This mode also has a SPA
fallback route, so refreshing on `/trends` or any other in-app URL works
rather than 404ing.

## Tests

```bash
cd backend
.venv/Scripts/python -m pytest tests/ -v
```

- `test_parser.py` parses the real sample report in `results/` and checks
  every value, unit, reference range, and flag against known-correct
  numbers, and makes sure none of the interpretive commentary that's printed
  alongside some results (e.g. under eGFR, Vitamin B12, Ferritin) leaks in
  as a fake result row.
- `test_reports_api.py` / `test_analytes_api.py` exercise the full HTTP API
  (`fastapi.testclient.TestClient`) against a throw-away SQLite database per
  test — report/result CRUD, the `needs_review` sync logic, sorting, delta
  calculation in Compare, and error handling for bad input.

There's no frontend test suite yet — UI changes are currently verified by
running the app.

## Linting

```bash
cd backend && .venv/Scripts/ruff check .
cd frontend && npm run lint          # oxlint
```

## Your data

- Database: `backend/data/hemogram.db`
- Archived source PDFs: `backend/data/pdfs/`

Back up that `data/` folder if you want to keep a copy of your history
outside this machine — nothing here does that for you.
