# 📊 PNC Fraud Detection System - Visual Architecture & Quick Reference

## 🎯 System Overview Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       USER BROWSER                              │
│                   http://localhost:3001                         │
└────────────────────────────┬──────────────────────────────────┘
                             │
                             ▼
        ┌────────────────────────────────────────┐
        │     REACT FRONTEND (Port 3001)        │
        ├────────────────────────────────────────┤
        │  ┌─────────────────────────────────┐  │
        │  │  ChatInterface                  │  │
        │  │  - Query input                  │  │
        │  │  - Real-time message display    │  │
        │  └─────────────────────────────────┘  │
        │  ┌─────────────────────────────────┐  │
        │  │  ProgressPanel                  │  │
        │  │  - 6-stage visualization        │  │
        │  │  - Live progress bar            │  │
        │  └─────────────────────────────────┘  │
        │  ┌─────────────────────────────────┐  │
        │  │  JourneyPanel                   │  │
        │  │  - Analysis history             │  │
        │  │  - Results details              │  │
        │  └─────────────────────────────────┘  │
        └────────────────┬──────────────────────┘
                         │
                  /api/* (proxy)
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │    NODE.JS BACKEND (Port 5001)        │
        ├────────────────────────────────────────┤
        │  Express.js Server                    │
        │  ┌─────────────────────────────────┐  │
        │  │ Load pnc_full_flow.md           │  │
        │  │ Expand {{include}} templates    │  │
        │  │ Append user query               │  │
        │  └─────────────────────────────────┘  │
        │  ┌─────────────────────────────────┐  │
        │  │ Spawn Claude Code CLI           │  │
        │  │ with complete prompt            │  │
        │  └─────────────────────────────────┘  │
        │  ┌─────────────────────────────────┐  │
        │  │ Stream output (SSE)             │  │
        │  │ Extract EXECUTION_STATE         │  │
        │  │ Save to journeys.json           │  │
        │  └─────────────────────────────────┘  │
        └────────────────┬──────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │         CLAUDE CODE CLI                │
        ├────────────────────────────────────────┤
        │  Control Agent Orchestration           │
        │  ┌──────────────────────────────────┐  │
        │  │ Agent 1: Customer Context Risk   │──┐
        │  │ Agent 2: Claim Timeline          │  │
        │  │ Agent 3: Financial Anomaly       │  ├─→ MCP Tools
        │  │ Agent 4: Evidence Consistency    │  │
        │  └──────────────────────────────────┘  │
        │  Compute Composite Fraud Risk Score    │
        │  Apply Disposition Thresholds          │
        │  Output EXECUTION_STATE JSON           │
        └────────────────┬──────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │       MCP TOOLS (Zaimler)              │
        ├────────────────────────────────────────┤
        │  • agent_chat (Cypher generator)      │
        │  • execute_template (Template runner)  │
        └────────────────┬──────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │   GRAPH DATABASE (Neo4j / XAML)        │
        ├────────────────────────────────────────┤
        │  • Customer profiles & history         │
        │  • Claims data                         │
        │  • Payment records                     │
        │  • Document metadata                   │
        └────────────────────────────────────────┘
```

---

## 🔄 Execution Flow

```
User Input
    │
    ├─ Process: "Analyze customer Smith, John"
    │
    └─ Extract customer name → "Smith, John"
                │
                ▼
    ┌─────────────────────────────┐
    │ Run 4 Agents in Sequence    │
    └─────────────────────────────┘
         │
         ├──→ Agent 1️⃣ : Customer Context
         │    • Query: Claims, policies, driver history
         │    • Output: CCRS (Customer Context Risk Score)
         │
         ├──→ Agent 2️⃣ : Claim Timeline
         │    • Query: Event progression, SIU involvement
         │    • Output: BARS (Behavioral Anomaly Risk Score)
         │
         ├──→ Agent 3️⃣ : Financial Anomaly
         │    • Query: Payment records, patterns
         │    • Output: FARS (Financial Anomaly Risk Score)
         │
         └──→ Agent 4️⃣ : Evidence Consistency
              • Query: Documents, verification status
              • Output: ECRS (Evidence Consistency Risk Score)
         │
         ▼
    ┌─────────────────────────────┐
    │ Compute Composite Score     │
    │ CFRS = (CCRS×0.25) +        │
    │        (BARS×0.30) +        │
    │        (FARS×0.25) +        │
    │        (ECRS×0.20)          │
    └─────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────┐
    │ Apply Thresholds            │
    ├─────────────────────────────┤
    │ CFRS ≤ 0.30   → ✅ Clear    │
    │ 0.30 < CFRS ≤ 0.50 → 👁️ Monitor
    │ 0.50 < CFRS ≤ 0.70 → 🔍 Investigate
    │ CFRS > 0.70   → 🚨 Escalate  │
    │ Any > 0.85    → 🚨 Escalate   │
    └─────────────────────────────┘
         │
         ▼
    Return: EXECUTION_STATE JSON
         │
         ▼
    Save to: journeys.json
         │
         ▼
    Display in UI (real-time)
```

---

## 📂 File Organization Quick Guide

```
pnc-web-ui/
│
├─ backend/                  ← Start here: npm install && npm start
│  ├─ server.js             Main backend logic (1500+ lines)
│  ├─ package.json          Dependencies
│  ├─ .env                  Configuration (EDIT THIS)
│  └─ journeys.json         Auto-generated results
│
├─ frontend/                 ← Start here: npm install && npm run dev
│  ├─ src/
│  │  ├─ App.jsx            Main component (PNC branding)
│  │  └─ components/        5 React components
│  ├─ vite.config.js        Port 3001, API proxy (EDIT IF PORT CHANGES)
│  └─ index.html
│
├─ README.md                 ← Read this (setup guide)
└─ QUICK_START.md            ← Quick start (5 minutes)
```

---

## 🔧 Quick Reference - What to Edit

### Change Backend Port
**File**: `pnc-web-ui/backend/.env`
```env
PORT=5001  ← Change this number
```

### Change Frontend Port
**File**: `pnc-web-ui/frontend/vite.config.js`
```javascript
port: 3001,  ← Change this number
```

### Change Backend's Backend API
**File**: `pnc-web-ui/frontend/vite.config.js`
```javascript
target: "http://localhost:5001",  ← Change if backend port changes
```

### Change PNC Workspace Path
**File**: `pnc-web-ui/backend/.env`
```env
CLAUDE_WORKSPACE=c:\Users\...\pnc\  ← Change to your path
```

### Customize Fraud Logic
**Files**: Edit any in `pnc/` folder
- `authoritative_sop.md` - Change thresholds
- `worker_*.md` - Change scoring logic

---

## 🚀 Commands Reference

### Install Dependencies
```bash
# Backend
cd pnc-web-ui/backend && npm install

# Frontend
cd pnc-web-ui/frontend && npm install
```

### Start Services
```bash
# Terminal 1: Backend
cd pnc-web-ui/backend
npm start                    # or: npm run dev
# or: node server.js
# or: ./start.sh (Mac/Linux)
# or: .\start.bat (Windows)

# Terminal 2: Frontend
cd pnc-web-ui/frontend
npm run dev
# or: ./start.sh (Mac/Linux)
# or: .\start.bat (Windows)
```

### Check Health
```bash
curl http://localhost:5001/api/health
```

### View Results
```bash
cat pnc-web-ui/backend/journeys.json
```

---

## 🎨 Frontend UI Map

```
PNC FRAUD DETECTION SYSTEM
├─ [Purple Gradient Header]
├─
├─ TAB 1: FRAUD ANALYSIS (Active by default)
│  ├─ Chat message area (scrollable)
│  ├─ Progress panel (6 stages)
│  └─ Input bar (customer name entry)
│
└─ TAB 2: ANALYSIS HISTORY
   ├─ Left panel: List of analyses
   │  ├─ Customer name
   │  ├─ Disposition badge (color-coded)
   │  └─ Risk score
   │
   └─ Right panel: Detailed results
      ├─ Customer info
      ├─ Risk scores (4 agents)
      ├─ Composite score
      ├─ Final disposition
      ├─ Execution status
      └─ Risk factors detail
```

---

## 🎯 Progress Stages

As analysis runs, you'll see:

```
1️⃣  Initializing
    ⚙️  Spinning disc
    
2️⃣  Customer Context
    👤 Person icon
    » Querying customer profile
    » Extracting claims, policies, driver history
    
3️⃣  Claim Timeline
    📅 Calendar icon
    » Analyzing claim events
    » Checking SIU involvement
    
4️⃣  Financial Anomaly
    💰 Money icon
    » Reviewing payment records
    » Detecting unusual patterns
    
5️⃣  Evidence Consistency
    📋 Clipboard icon
    » Verifying documents
    » Checking document coverage
    
6️⃣  Final Disposition
    ✓ Checkmark icon
    » Computing composite score
    » Determining fraud risk level
```

---

## 📊 Result Colors (Disposition)

```
🟢 Clear              → No action       (green)
🟠 Monitor            → Watch list      (orange)
🟠 Investigate        → Review needed   (dark orange)
🔴 Escalate to SIU    → Referral        (red)
```

---

## 🔍 Typical Output Example

```json
{
  "run_id": "session_1234567890_abc",
  "customer_name": "Smith, John",
  "status": "completed",
  "composite_fraud_risk_score": 0.42,
  "final_disposition": "Monitor — Standard Surveillance",
  "decision_inputs": {
    "customer_context_risk_score": 0.35,
    "behavioral_anomaly_risk_score": 0.40,
    "financial_anomaly_risk_score": 0.58,
    "evidence_consistency_risk_score": 0.25,
    "claim_count": 6,
    "total_payout": 28500.00
  }
}
```

---

## ⚠️ Common Issues & Fixes

| Problem | Solution |
|---------|----------|
| Can't connect to localhost:5001 | Backend not running. Check Terminal 1 |
| "Port already in use" | Change PORT in `.env` or `vite.config.js` |
| "Prompt file not found" | Check `CLAUDE_WORKSPACE` path in `.env` |
| "Claude CLI not available" | Install Claude Code CLI & verify with `which claude` |
| No output received | Check Claude has network access to database |
| Query times out | Increase `CLAUDE_TIMEOUT` in `.env` |
| Frontend stuck loading | Check vite proxy target in `vite.config.js` |

---

## 📞 Getting Help

1. **Quick Reference**: This file (right menu)
2. **Quick Start**: `pnc-web-ui/QUICK_START.md`
3. **Full Setup**: `pnc-web-ui/README.md`
4. **Code Comments**: Check JSX/JS files
5. **Backend Logs**: Terminal 1 (backend) shows detailed logs

---

## ✅ Verification Checklist

After starting both services:

- [ ] Backend started (Terminal 1): "Backend ready to accept queries"
- [ ] Frontend started (Terminal 2): "Local: http://localhost:3001"
- [ ] Browser opens to http://localhost:3001
- [ ] Can type in input field
- [ ] Can click "Analyze" button
- [ ] See progress panel appear (stages updating)
- [ ] See results after completion
- [ ] Results appear in "Analysis History" tab
- [ ] Health check works: `curl http://localhost:5001/api/health`

---

## 🎉 Ready!

Everything is set up. Follow QUICK_START.md for the 5-minute walkthrough.
