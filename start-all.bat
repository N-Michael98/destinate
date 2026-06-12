@echo off
title Destinate - Start All Servers

echo ========================================
echo   Destinate - Starting All Servers
echo ========================================
echo.

echo [1/2] Starting Python Backend (Port 8000)...
start "Destinate Python Backend" cmd /k "cd /d %~dp0backend && (if not exist venv python -m venv venv) && venv\Scripts\pip install -q -r requirements.txt --only-binary :all: 2>nul & venv\Scripts\pip install -q ta 2>nul & venv\Scripts\uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Next.js Frontend (Port 3000)...
start "Destinate Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================
echo   Both servers starting...
echo   Python:   http://localhost:8000/health
echo   Frontend: http://localhost:3000
echo ========================================
echo.
echo Press any key to close this window.
pause >nul
