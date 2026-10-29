@echo off
echo Running BhashaLens Backend Tests...
echo.
cd /d "%~dp0backend"
echo Working directory: %CD%
echo.
python -m pytest tests/ -v
pause
