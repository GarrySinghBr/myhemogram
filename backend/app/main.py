"""FastAPI entry point.

Two ways to run this (see the repo README):
  - Dev: this process serves only the /api/* routes, and Vite's own dev
    server (port 5173) serves the frontend + proxies /api to here. Hence
    the CORS allowance below - the browser sees two different origins.
  - Single-port: `npm run build` once, then this process also serves the
    built frontend directly (see the static mount at the bottom), so
    there's only one origin and CORS doesn't come into play at all.
"""
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .db import init_db
from .routers import analytes, reports

app = FastAPI(title="MyHemogram")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

app.include_router(reports.router)
app.include_router(analytes.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Registered last so every real API route above takes precedence.
# This is a single-page app: a hard navigation/refresh on a client-side route
# like /trends has no matching file on disk, so anything that isn't a real
# static asset falls back to index.html and React Router takes it from there.
FRONTEND_DIST = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "frontend", "dist")
if os.path.isdir(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(404)
        candidate = os.path.join(FRONTEND_DIST, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
