@echo off
echo Running BhashaLens Backend Tests...
cd /d "%~dp0backend"
python -m pytest tests/ -v
