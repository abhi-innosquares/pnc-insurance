#!/bin/bash
# PNC Fraud Detection - Backend Startup Script

echo "=================================="
echo "PNC Fraud Detection Backend"
echo "=================================="
echo ""

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 16+"
    exit 1
fi

echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check .env file
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Please create .env with:"
    echo ""
    echo "PORT=5001"
    echo "CLAUDE_WORKSPACE=c:\Users\abhis\Desktop\zaimler-mcp-server\pnc\"
    echo "PROMPT_FILE=pnc_full_flow.md"
    echo "CLAUDE_TIMEOUT=1200000"
    echo ""
    exit 1
fi

echo "✅ Starting PNC Backend Server..."
echo ""
echo "🚀 Backend will be available at: http://localhost:5001"
echo "📊 API endpoints:"
echo "   - GET  /api/health"
echo "   - POST /api/query"
echo "   - GET  /api/journeys"
echo ""
echo "Press Ctrl+C to stop"
echo ""

node server.js
