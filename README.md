# PNC Fraud Detection System - Setup & Deployment Guide

A complete web-based insurance fraud detection and risk scoring system using AI agents, built with Node.js backend and React frontend.

---

## 📋 System Architecture

```
Frontend (React, Port 3001)
    ↓
Backend Server (Node.js, Port 5001)
    ↓
Claude Code CLI
    ↓
MCP Tools (Zaimler Database)
    ↓
Graph Database (XAML/Neo4j)
```

### Key Components

1. **Backend** (`pnc-web-ui/backend/`)
   - Express.js server managing Claude Code processes
   - Preloads and expands {{include}} prompt templates
   - Manages session state and real-time streaming
   - API endpoints for queries and journey storage

2. **Frontend** (`pnc-web-ui/frontend/`)
   - React app with Chat interface for fraud queries
   - Real-time streaming of Claude's analysis progress
   - History panel showing past analyses
   - Responsive design for desktop/tablet

3. **Prompts** (`pnc/`)
   - `pnc_full_flow.md` - Root orchestration template
   - `authoritative_sop.md` - Business logic & thresholds
   - `control_agent_orchestration.md` - Execution management
   - `worker_*_agent.md` - Specialized scoring agents
   - `common_rules.md` - MCP tool definitions
   - `customer_loop.md` - Multi-customer processing

---

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ (for backend)
- Claude Code CLI installed and configured
- MCP tools configured: `mcp__zaimler-ntt-ins-pc__agent_chat`, `mcp__zaimler-ntt-ins-pc__execute_template`
- Zaimler graph database accessible

### 1. Backend Setup

```bash
cd pnc-web-ui/backend
npm install
node server.js
```

✅ Backend runs on `http://localhost:5001`

**Backend Endpoints:**
- `GET /api/health` - Health check
- `POST /api/query` - Submit fraud analysis query
- `GET /api/session/:sessionId` - Get session status
- `GET /api/session/:sessionId/stream` - Stream real-time updates
- `GET /api/journeys` - List all analyses
- `POST /api/journeys` - Save new analysis

**Files Generated:**
- `journeys.json` - Storage for analysis results

### 2. Frontend Setup

In a new terminal:

```bash
cd pnc-web-ui/frontend
npm install
npm run dev
```

✅ Frontend runs on `http://localhost:3001`

Opens automatically; proxy routes `/api` to `http://localhost:5001`

### 3. Test the System

1. Open http://localhost:3001 in browser
2. Enter a customer name: `"Smith, John"`
3. Click "Analyze"
4. Watch real-time progress as Claude executes workflow
5. Review analysis results and history

---

## 🔧 Configuration

### Backend `.env` file (`pnc-web-ui/backend/.env`)

```env
PORT=5001                                    # Backend port
CLAUDE_WORKSPACE=c:\path\to\pnc\            # Where PNC prompts live
PROMPT_FILE=pnc_full_flow.md                # Root prompt template
CLAUDE_TIMEOUT=1200000                      # 20 minutes timeout
```

### Frontend `vite.config.js`

```javascript
server: {
  port: 3001,                     // Frontend port
  proxy: {
    "/api": {
      target: "http://localhost:5001",  // Backend URL
      changeOrigin: true,
    },
  },
}
```

---

## 📊 Workflow Execution Flow

### User Input
```
User enters: "Analyze customer Johnson, James"
```

### Backend Processing
```
1. Load pnc_full_flow.md
2. Expand {{include}} directives recursively
3. Append user query to expanded prompt
4. Spawn Claude Code process with full prompt
5. Stream output in real-time to frontend
6. Extract EXECUTION_STATE JSON from output
7. Save to journeys.json
```

### Claude Execution (Orchestrated by Control Agent)
```
1. Parse customer name: "Johnson, James"
2. Customer Context Risk Agent
   → MCP: agent_chat for customer profile
   → Calculate risk score (CCRS)
3. Claim Timeline Agent
   → MCP: agent_chat for claim events
   → Calculate risk score (BARS)
4. Financial Anomaly Agent
   → MCP: agent_chat for payment records
   → Calculate risk score (FARS)
5. Evidence Consistency Agent
   → MCP: agent_chat for documents
   → Calculate risk score (ECRS)
6. Composite Scoring & Disposition
   → CFRS = (CCRS×0.25) + (BARS×0.30) + (FARS×0.25) + (ECRS×0.20)
   → Apply thresholds → Return disposition
7. Output EXECUTION_STATE JSON
```

### Frontend Reception
```
Real-time updates displayed:
- ⚙️  Initializing
- 👤 Customer Context → Risk Score
- 📅 Claim Timeline → Risk Score
- 💰 Financial Anomaly → Risk Score
- 📋 Evidence Review → Risk Score
- ✓ Final Disposition: Clear|Monitor|Investigate|Escalate
```

---

## 🎯 Fraud Detection Decisioning Tree

| Metric | Threshold | Action |
|--------|-----------|--------|
| CFRS ≤ 0.30 | - | ✅ **Clear** - No action |
| CFRS 0.30-0.50 | - | 👁️ **Monitor** - Watch list |
| CFRS 0.50-0.70 | - | 🔍 **Investigate** - Review file |
| CFRS > 0.70 | - | 🚨 **Escalate** - SIU referral |
| Any score > 0.85 | - | 🚨 **Escalate** (override) |

---

## 📝 Query Format & Examples

### Valid Query Formats

```
"Analyze customer Smith, John"
"Check fraud indicators for Johnson, Mary"
"Evaluate customer Brown, Robert for risk"
"Multiple: Williams, David and Miller, Susan"
```

### What the System Does

1. **Extracts customer name** in "LastName, FirstName" format
2. **Validates** against Zaimler database
3. **Scores across 4 dimensions**:
   - Customer Context (claims, policies, driver history)
   - Claim Timeline (event progression, SIU involvement)
   - Financial Anomalies (payment patterns, deductible refunds)
   - Evidence Consistency (document verification)
4. **Produces composite score** with weighted formula
5. **Returns disposition** with justification

---

## 🔍 Debugging & Troubleshooting

### Backend Logs

```bash
# Terminal shows:
[sessionId] STARTING NEW CLAUDE PROCESS (PNC)
[sessionId] Prompt expanded: ... bytes
[sessionId] Claude stdout chunk #1 ...
[sessionId] Detected EXECUTION_STATE final block
[sessionId] Journey saved: customer_name
```

### Common Issues

**"Prompt file not found"**
- Check `.env` `PROMPT_FILE` path
- Ensure `pnc_full_flow.md` exists and has correct includes

**"Claude Code CLI not available"**
- Ensure Claude CLI is installed
- Run: `which claude` (mac/linux) or `where claude` (windows)

**"MCP tools not authorized"**
- Check backend allowed tools match your environment
- Update: `mcp__zaimler-ntt-ins-pc__agent_chat`, `mcp__zaimler-ntt-ins-pc__execute_template`

**"Query timeout (20 minutes)"**
- Increase `CLAUDE_TIMEOUT` in `.env`
- Check if graph database is responsive

**"No output received"**
- Verify Claude Code CLI is working
- Check Claude has network access to database
- Review stderr in backend console

---

## 📁 File Structure

```
pnc-web-ui/
├── backend/
│   ├── server.js              # Main Express server
│   ├── package.json           # Dependencies
│   ├── .env                   # Configuration
│   ├── .gitignore
│   └── journeys.json          # Generated output
│
└── frontend/
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx            # Main component
    │   ├── App.css
    │   ├── index.css
    │   └── components/
    │       ├── ChatInterface.jsx     # Chat UI
    │       ├── InputBar.jsx          # Query input
    │       ├── Message.jsx           # Message display
    │       ├── ProgressPanel.jsx     # Execution progress
    │       └── JourneyPanel.jsx      # History/results
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── .gitignore

pnc/
├── pnc_full_flow.md                 # ROOT ORCHESTRATION FILE
├── authoritative_sop.md              # Business logic
├── control_agent_orchestration.md    # Execution rules
├── worker_customer_context_agent.md
├── worker_claim_timeline_agent.md
├── worker_financial_anomaly_agent.md
├── worker_evidence_consistency_agent.md
├── common_rules.md
├── customer_loop.md
└── business_metrics_fraud.json
```

---

## 🔄 Development Workflow

### Making Changes

**To update fraud detection rules:**
1. Edit `pnc/authoritative_sop.md`
2. No backend restart needed (loaded on each query)

**To add new worker agent:**
1. Create `pnc/worker_new_agent.md`
2. Add to `pnc/pnc_full_flow.md` with {{include}}
3. Backend will automatically include it

**To modify frontend UI:**
1. Edit React components in `pnc-web-ui/frontend/src/`
2. Vite hot-reload applies changes automatically

**To adjust backend behavior:**
1. Edit `pnc-web-ui/backend/server.js`
2. Restart backend: `npm run dev`

### Testing New Prompts

```bash
# Test locally before uploading to UI:
cd pnc/
cat pnc_full_flow.md | claude --allowed-tools mcp__zaimler-ntt-ins-pc__agent_chat
```

---

## 📊 Sample Output (EXECUTION_STATE)

```json
{
  "run_id": "session_1703091234567_abc123def",
  "customer_name": "Smith, John",
  "status": "completed",
  "stations": {
    "Customer Context": "executed",
    "Claim Timeline": "executed",
    "Financial Anomaly": "executed",
    "Evidence Consistency": "executed",
    "Final Disposition": "executed"
  },
  "decision_inputs": {
    "customer_context_risk_score": 0.42,
    "behavioral_anomaly_risk_score": 0.38,
    "financial_anomaly_risk_score": 0.55,
    "evidence_consistency_risk_score": 0.25,
    "composite_fraud_risk_score": 0.41,
    "claim_count": 6,
    "total_payout": 28500.00
  },
  "final_disposition": "Monitor — Standard Surveillance"
}
```

---

## 🚀 Production Deployment

### Docker (Optional)

```dockerfile
# Dockerfile for backend
FROM node:18-alpine
WORKDIR /app
COPY pnc-web-ui/backend .
RUN npm install
EXPOSE 5001
CMD ["node", "server.js"]
```

```bash
docker build -t pnc-fraud-backend .
docker run -p 5001:5001 \
  -e CLAUDE_WORKSPACE=/data/pnc \
  -v /path/to/pnc:/data/pnc \
  pnc-fraud-backend
```

### Environment Variables (Production)

```env
PORT=5001
CLAUDE_WORKSPACE=/var/data/pnc/
PROMPT_FILE=pnc_full_flow.md
CLAUDE_TIMEOUT=1200000
NODE_ENV=production
```

---

## 📞 Support & Resources

- **Claude Code CLI Issues**: Check Claude documentation
- **Zaimler API Issues**: Consult Zaimler MCP docs
- **Frontend Issues**: Check browser console (F12)
- **Backend Issues**: Check terminal logs in `pnc-web-ui/backend`

---

## Version Info

- **System**: PNC Fraud Detection v1.0.0
- **Backend**: Node.js + Express.js
- **Frontend**: React 18 + Vite
- **Database**: Zaimler XAML (Neo4j)
- **Port Config**: Backend 5001 | Frontend 3001

---

## Next Steps

1. ✅ Start backend: `cd pnc-web-ui/backend && npm install && node server.js`
2. ✅ Start frontend: `cd pnc-web-ui/frontend && npm install && npm run dev`
3. ✅ Open http://localhost:3001
4. ✅ Test with: `"Analyze customer Smith, John"`
5. ✅ Review results in "Analysis History" tab

Enjoy the PNC Fraud Detection System! 🎉
