@echo off
setlocal
cd /d "%~dp0"

if not exist "backend\.venv\Scripts\python.exe" (
    echo backend\.venv not found - run the first-time setup in the README first.
    pause
    exit /b 1
)
if not exist "frontend\node_modules" (
    echo frontend\node_modules not found - run "npm install" in frontend\ first.
    pause
    exit /b 1
)

echo Building frontend...
pushd frontend
call npm run build || (echo Frontend build failed - see errors above. & pause & exit /b 1)
popd

echo Starting MyHemogram at http://127.0.0.1:8899 (close this window to stop)...
start "" cmd /c "timeout /t 2 >nul & start http://127.0.0.1:8899"
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --port 8899
