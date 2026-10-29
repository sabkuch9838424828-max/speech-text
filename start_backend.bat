@echo off
echo Starting BhashaLens Backend...
echo.
REM Navigate to repo root (same folder as this .bat file)
cd /d "%~dp0"
echo Repo root: %CD%
echo.
REM --app-dir tells uvicorn to look for the "app" package inside "backend/"
REM This works from the repo root without having to cd into backend/
python -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
pause
