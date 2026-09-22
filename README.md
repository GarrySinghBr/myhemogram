# MyHemogram

A local, private blood-work tracker. Import the PDF lab reports you get from
your doctor, and it parses out every test result, stores it, and lets you
view a single report, compare two reports side by side, and see the
lifetime trend of any analyte. Everything stays on your machine — there's
no cloud sync, no external service; data lives in a SQLite file under
`backend/data/`.

## How it's built

- **`backend/`** — Python (FastAPI). `app/parser.py` turns a lab PDF into
  structured results using each row's column position on the page (not a
  fixed list of test names), so a report with more or fewer tests than
  usual still parses. `app/models.py` / `app/db.py` are the SQLite storage;
  `app/routers/` is the REST API.
- **`frontend/`** — React (Vite). Dashboard, Import/review, Report detail,
  Compare, and Trends pages.

Every PDF import goes through a **review screen** before anything is saved,
so you can fix or add rows the parser missed — it was built against one lab's
report layout and may not get every edge case perfect on a new one.

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

Then open **http://127.0.0.1:8899** instead.

## Running the tests

```bash
cd backend
.venv/Scripts/python -m pytest tests/ -v
```

`tests/test_parser.py` parses the real sample report in `results/` and
checks every value, unit, reference range, and flag against known-correct
numbers, and makes sure none of the interpretive commentary that's printed
alongside some results (e.g. under eGFR, Vitamin B12, Ferritin) leaks in as
a fake result row.

## Your data

- Database: `backend/data/hemogram.db`
- Archived source PDFs: `backend/data/pdfs/`

Back up that `data/` folder if you want to keep a copy of your history
outside this machine — nothing here does that for you.
