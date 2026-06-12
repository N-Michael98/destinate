@echo off
echo.
echo  ██████╗ ███████╗███████╗████████╗██╗███╗   ██╗ █████╗ ████████╗███████╗
echo  ██╔══██╗██╔════╝██╔════╝╚══██╔══╝██║████╗  ██║██╔══██╗╚══██╔══╝██╔════╝
echo  ██║  ██║█████╗  ███████╗   ██║   ██║██╔██╗ ██║███████║   ██║   █████╗
echo  ██║  ██║██╔══╝  ╚════██║   ██║   ██║██║╚██╗██║██╔══██║   ██║   ██╔══╝
echo  ██████╔╝███████╗███████║   ██║   ██║██║ ╚████║██║  ██║   ██║   ███████╗
echo  ╚═════╝ ╚══════╝╚══════╝   ╚═╝   ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝   ╚═╝   ╚══════╝
echo.
echo  Backend Server - Python FastAPI
echo  ================================
echo.

cd /d "%~dp0"

if not exist "venv" (
    echo [1/3] Creating virtual environment...
    python -m venv venv
)

if not exist ".env" (
    echo [2/3] Creating .env from template...
    copy .env.example .env >nul
) else (
    echo [2/3] .env found
)

echo [3/3] Starting server...
echo.
echo  API:      http://localhost:8000
echo  Docs:     http://localhost:8000/docs
echo  Health:   http://localhost:8000/health
echo.

venv\Scripts\uvicorn main:app --reload --host 0.0.0.0 --port 8000
