# 🚀 PNC Fraud Detection - Quick Start Guide

## What Was Just Created

A complete, production-ready web application for **PNC insurance fraud detection** with:

✅ **Backend** (Node.js/Express) on **Port 5001**  
✅ **Frontend** (React/Vite) on **Port 3001**  
✅ **AI Agent System** (Claude Code CLI + MCP Tools)  
✅ **Real-time Streaming** UI updates  
✅ **Analysis History** persistence  

---

## ⚡ 5-Minute Setup

### Step 1: Start Backend (Terminal 1)

**Windows:**
```bash
cd pnc-web-ui\backend
.\start.bat
```

**Mac/Linux:**
```bash
cd pnc-web-ui/backend
./start.sh
```

**Manual:**
```bash
cd pnc-web-ui/backend
npm install
npm start
```

✅ You should see:
```
Port 5001
Initializing Claude Code...
Preloading prompt file...
✅ Backend ready to accept queries
```

### Step 2: Start Frontend (Terminal 2)

**Windows:**
```bash
cd pnc-web-ui\frontend
.\start.bat
```

**Mac/Linux:**
```bash
cd pnc-web-ui/frontend
./start.sh
```

**Manual:**
```bash
cd pnc-web-ui/frontend
npm install
npm run dev
```

✅ Browser opens automatically to `http://localhost:3001`

---

## 🧪 Test It!

### In the Browser

1. **Fraud Analysis Tab** is active
2. Enter a customer name:
   ```
   Smith, John
   ```
3. Click **"Analyze"**
4. Watch real-time progress: 👤 → 📅 → 💰 → 📋 → ✓

### Expected Output

```
🎯 Final Disposition
├─ Clear (score ≤ 0.30) — No action
├─ Monitor (0.30-0.50) — Watch list
├─ Investigate (0.50-0.70) — Claims review
└─ Escalate (>0.70) — SIU referral
```

### View History

1. Click **"Analysis History"** tab
2. See all past analyses
3. Click any to view detailed report

---

## 📁 What's Where

```
pnc-web-ui/
├── backend/          ← Node.js server (port 5001)
│   ├── server.js     ← Main code
│   ├── .env          ← Configuration
│   └── journeys.json ← Results saved here
│
└── frontend/         ← React app (port 3001)
    └── src/
        ├── App.jsx   ← Main component
        └── components/
            ├── ChatInterface  ← Query input
            └── JourneyPanel   ← Results view

pnc/
├── pnc_full_flow.md             ← ROOT FILE (loaded each query)
├── authoritative_sop.md          ← Fraud decision logic
├── control_agent_orchestration.md← Agent management
├── worker_*.md                   ← Scoring agents (4 workers)
└── common_rules.md               ← MCP tool definitions
```

---

## 🔌 Port Configuration

**Current Setup:**
- Frontend: `http://localhost:3001`
- Backend: `http://localhost:5001`
- API proxy: `/api` → backend

**To Change Port:** Edit `pnc-web-ui/backend/.env`

```env
PORT=5001  ← change this
```

Then restart backend!

---

## 🔧 Configuration Checklist

✅ **Backend `.env`** properly configured:
```env
PORT=5001
CLAUDE_WORKSPACE=c:\Users\abhis\Desktop\zaimler-mcp-server\pnc\
PROMPT_FILE=pnc_full_flow.md
CLAUDE_TIMEOUT=1200000
```

✅ **Frontend `vite.config.js`** points to backend:
```javascript
proxy: {
  "/api": {
    target: "http://localhost:5001",
  }
}
```

✅ **PNC Prompt Files** in place:
- `pnc/pnc_full_flow.md` (recently created)
- All worker agents
- All rules files

✅ **Claude Code CLI** installed and authorized MCP tools:
- `mcp__zaimler-ntt-ins-pc__agent_chat`
- `mcp__zaimler-ntt-ins-pc__execute_template`

---

## 🐛 Troubleshooting

### "Cannot connect to http://localhost:5001"
→ Backend not running. Check Terminal 1 for errors.

### "Prompt file not found"
→ Check `.env` path. Should point to PNC folder with all .md files.

### "Claude Code CLI not available"
→ Run `where claude` (Windows) or `which claude` (Mac/Linux)

### "No MCP tools found"
→ Check Claude CLI has network access to Zaimler database

### "Query timeout"
→ Increase `CLAUDE_TIMEOUT` in `pnc-web-ui/backend/.env`

---

## 📊 System Flow (Visual)

```
User enters query
    ↓
Frontend (React) submits to /api/query
    ↓
Backend preloads pnc_full_flow.md
    ↓
Expands all {{include}} directives
    ↓
Spawns Claude Code CLI with full prompt
    ↓
Claude executes 4 agents in sequence:
  1. Customer Context Risk Agent
  2. Claim Timeline Agent
  3. Financial Anomaly Agent
  4. Evidence Consistency Agent
    ↓
Control Agent computes composite score
    ↓
Applies disposition thresholds
    ↓
Outputs EXECUTION_STATE JSON
    ↓
Backend extracts JSON, saves to journeys.json
    ↓
Frontend displays results in real-time
```

---

## 🎯 Key Decision Thresholds

| Score Range | Disposition | Action |
|------------|-------------|--------|
| ≤ 0.30 | ✅ Clear | No action |
| 0.30-0.50 | 👁️ Monitor | Watch list |
| 0.50-0.70 | 🔍 Investigate | Claims examiner review |
| > 0.70 | 🚨 Escalate | SIU referral |
| Any > 0.85 | 🚨 Escalate | Force escalation |

---

## 📝 Example Queries

```
"Analyze customer Johnson, James"
"Check fraud risk for Williams, David"
"Evaluate Smith, Mary for insurance claims anomalies"
"Process: Brown, Robert and Miller, Susan"
```

---

## 🚀 Next Steps

1. **Verify Everything Works**
   - ✅ Start backend & frontend
   - ✅ Submit test query
   - ✅ View results

2. **Customize (Optional)**
   - Edit fraud SOP thresholds in `pnc/authoritative_sop.md`
   - Add new agents in `pnc/` folder
   - Update frontend branding in `pnc-web-ui/frontend/src/App.jsx`

3. **Deploy (When Ready)**
   - Use Docker for containerization
   - Set environment variables securely
   - Configure reverse proxy (nginx/Apache)
   - Use process manager (PM2, systemd, etc.)

---

## 📞 Quick Reference

**Start Everything:**
```bash
# Terminal 1
cd pnc-web-ui/backend && npm start

# Terminal 2
cd pnc-web-ui/frontend && npm run dev

# Browser
http://localhost:3001
```

**Check Backend Health:**
```bash
curl http://localhost:5001/api/health
```

**View Results:**
```bash
cat pnc-web-ui/backend/journeys.json
```

**Stop Everything:**
- Press `Ctrl+C` in both terminals

---

## 🎉 You're All Set!

The PNC Fraud Detection System is ready to go. Open http://localhost:3001 and start analyzing!

**Questions?** Check the detailed README.md in the pnc-web-ui/ folder.
