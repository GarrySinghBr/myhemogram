#!/usr/bin/env bash
# One-command launch: build the frontend, then run the backend, which serves
# both the API and the built frontend from a single process/port. This is
# what you want day to day - the two-terminal (`npm run dev` + uvicorn) setup
# in the README is only for actively editing the frontend with hot-reload.
set -e
cd "$(dirname "$0")"

if [ ! -f backend/.venv/Scripts/python.exe ] && [ ! -f backend/.venv/bin/python ]; then
    echo "backend/.venv not found - run the first-time setup in the README first."
    exit 1
fi
if [ ! -d frontend/node_modules ]; then
    echo "frontend/node_modules not found - run 'npm install' in frontend/ first."
    exit 1
fi

PYTHON="$(pwd)/backend/.venv/bin/python"
[ -f "$PYTHON" ] || PYTHON="$(pwd)/backend/.venv/Scripts/python.exe"  # Windows venv layout

echo "Building frontend..."
(cd frontend && npm run build)

URL="http://127.0.0.1:8899"
(
    sleep 1.5
    if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
    elif command -v open >/dev/null 2>&1; then open "$URL"
    else start "" "$URL" 2>/dev/null || true            # Windows (git-bash)
    fi
) &

echo "Starting MyHemogram at $URL (Ctrl+C to stop)..."
cd backend
exec "$PYTHON" -m uvicorn app.main:app --port 8899
