#!/bin/bash
# PNC Fraud Detection - Frontend Startup Script

echo "=================================="
echo "PNC Fraud Detection Frontend"
echo "=================================="
echo ""

FRONTEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

echo "✅ Starting PNC Frontend Server..."
echo ""
echo "🎨 Frontend will be available at: http://localhost:3001"
echo ""
echo "API routes to backend:"
echo "   /api → http://localhost:5001"
echo ""
echo "Press Ctrl+C to stop"
echo ""

npm run dev
