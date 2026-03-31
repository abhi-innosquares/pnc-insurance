@echo off
REM PNC Fraud Detection - Backend Startup Script (Windows)

echo ==================================
echo PNC Fraud Detection Backend
echo ==================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js not found. Please install Node.js 16+
    exit /b 1
)

echo Node version: 
node -v
echo NPM version: 
npm -v
echo.

REM Check and install dependencies
if not exist "node_modules" (
    echo Downloading dependencies...
    call npm install
    echo.
)

REM Check .env file
if not exist ".env" (
    echo Error: .env file not found. Please create .env with:
    echo.
    echo PORT=5001
    echo CLAUDE_WORKSPACE=c:\Users\abhis\Desktop\zaimler-mcp-server\pnc\
    echo PROMPT_FILE=pnc_full_flow.md
    echo CLAUDE_TIMEOUT=1200000
    echo.
    exit /b 1
)

echo Starting PNC Backend Server...
echo.
echo Backend will be available at: http://localhost:5001
echo API endpoints:
echo    - GET  /api/health
echo    - POST /api/query
echo    - GET  /api/journeys
echo.
echo Press Ctrl+C to stop
echo.

node server.js
