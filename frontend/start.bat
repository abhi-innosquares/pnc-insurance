@echo off
REM PNC Fraud Detection - Frontend Startup Script (Windows)

echo ==================================
echo PNC Fraud Detection Frontend
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
    echo Installing dependencies...
    call npm install
    echo.
)

echo Starting PNC Frontend Server...
echo.
echo Frontend will be available at: http://localhost:3001
echo.
echo API routes to backend:
echo    /api ^-> http://localhost:5001
echo.
echo Press Ctrl+C to stop
echo.

call npm run dev
