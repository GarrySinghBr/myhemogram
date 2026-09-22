# MyHemogram

A private, locally-deployed blood work tracker I mocked up with Claude for my
own (Ontario-based) lab reports. Originally just wanted a way to track my
bloodwork and biochemistry markers while dealing with Celiac's, but it grew
to cover general lab tracking too.

Upload the PDF your doctor's office gives you and it gets parsed into
structured results you can browse, compare across visits, or chart over
time. Everything runs on your own machine — no cloud, no accounts.

## Running it

Needs Python 3.11+ and Node 18+.

### Windows

```
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
cd ../frontend
npm install
```

Then, two terminals:

```
# backend — http://127.0.0.1:8899
cd backend
.venv/Scripts/python -m uvicorn app.main:app --port 8899

# frontend — http://localhost:5173
cd frontend
npm run dev
```

Open **http://localhost:5173**.

### Linux / macOS

```
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cd ../frontend
npm install
```

Then, two terminals:

```
# backend — http://127.0.0.1:8899
cd backend
.venv/bin/python -m uvicorn app.main:app --port 8899

# frontend — http://localhost:5173
cd frontend
npm run dev
```

Open **http://localhost:5173**.

### Single process

Build the frontend once and the backend will serve it directly, so you only
need one terminal after that:

```
cd frontend && npm run build
cd ../backend && <venv-python> -m uvicorn app.main:app --port 8899
```

Open **http://127.0.0.1:8899**.

## Tests

There's a pytest suite under `backend/tests/`, mainly there so Claude could
check its own changes while building this rather than something you need to
run yourself. There's also a ruff/oxlint setup, but linting a one-person
local project is fairly beside the point. If you're curious anyway:

```
cd backend
<venv-python> -m pytest tests/ -v
```

## Your data

- Database: `backend/data/hemogram.db`
- Archived source PDFs: `backend/data/pdfs/`

Nothing here backs this up for you. Copy the `data/` folder yourself if you
want a copy of your history off this machine.
