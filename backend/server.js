import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { exec } from "child_process";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;
const CLAUDE_WORKSPACE = process.env.CLAUDE_WORKSPACE || ".";
const PROMPT_FILE = process.env.PROMPT_FILE || "pnc_full_flow.md";
const CLAUDE_TIMEOUT = parseInt(process.env.CLAUDE_TIMEOUT || "1200000"); // 20 minutes (increased from 5)
const USE_PNC_SCRIPT = process.env.USE_PNC_SCRIPT === "1";
const PNC_SCRIPT_PATH = process.env.PNC_SCRIPT_PATH || "run_pnc_process.sh";
const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING !== "0";

function normalizeWorkspacePath(workspacePath) {
  if (!workspacePath) {
    return ".";
  }

  let normalized = workspacePath.trim();
  if (process.platform !== "win32" && normalized.startsWith("home/")) {
    normalized = `/${normalized}`;
  }
  return normalized;
}

function resolvePromptPath() {
  if (path.isAbsolute(PROMPT_FILE)) {
    return fs.existsSync(PROMPT_FILE) ? PROMPT_FILE : null;
  }

  const workspace = normalizeWorkspacePath(CLAUDE_WORKSPACE);
  const cwd = process.cwd();
  const repoRoot = path.resolve(__dirname, "..", "..");

  const candidates = [
    path.join(workspace, PROMPT_FILE),
    path.join(workspace, "pnc", PROMPT_FILE),
    path.join(cwd, PROMPT_FILE),
    path.join(cwd, "pnc", PROMPT_FILE),
    path.join(repoRoot, PROMPT_FILE),
    path.join(repoRoot, "pnc", PROMPT_FILE),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolvePncScriptPath() {
  if (path.isAbsolute(PNC_SCRIPT_PATH)) {
    return fs.existsSync(PNC_SCRIPT_PATH) ? PNC_SCRIPT_PATH : null;
  }

  const workspace = normalizeWorkspacePath(CLAUDE_WORKSPACE);
  const cwd = process.cwd();
  const repoRoot = path.resolve(__dirname, "..", "..");

  const candidates = [
    path.join(workspace, PNC_SCRIPT_PATH),
    path.join(cwd, PNC_SCRIPT_PATH),
    path.join(repoRoot, PNC_SCRIPT_PATH),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

// Middleware
app.use(cors());
app.use(express.json());

// Verbose request logging for testing
app.use((req, res, next) => {
  if (!VERBOSE_LOGGING) {
    return next();
  }

  const start = Date.now();
  console.log(
    `→ [REQ] ${req.method} ${req.originalUrl} ip=${req.ip || "unknown"}`
  );

  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`  [REQ BODY] ${JSON.stringify(req.body)}`);
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `← [RES] ${req.method} ${req.originalUrl} status=${res.statusCode} duration=${duration}ms`
    );
  });

  next();
});

// Store active sessions
const activeSessions = new Map();
let claudeInitialized = false;
let claudeInitError = null;
// Preloaded prompt content (loaded at startup)
let preloadedPromptContent = null;
let promptLoadError = null;

/**
 * Initialize Claude Code CLI
 * Must be called before processing queries
 */
async function initializeClaude() {
  return new Promise((resolve) => {
    if (claudeInitialized) {
      return resolve(true);
    }

    console.log(" Initializing Claude Code CLI...");

    const claude = spawn("claude", [], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });

    let output = "";
    let timeout = setTimeout(() => {
      claude.kill();
      claudeInitialized = true;
      claudeInitError = null;
      console.log("✓ Claude Code CLI initialized (interactive mode detected)");
      resolve(true);
    }, 5000);

    claude.stdout.on("data", (data) => {
      output += data.toString();
      // Claude is ready when it shows the prompt
      if (output.includes("Please") || output.includes("provide")) {
        clearTimeout(timeout);
        claude.kill();
        claudeInitialized = true;
        claudeInitError = null;
        console.log("✓ Claude Code CLI initialized");
        resolve(true);
      }
    });

    claude.stderr.on("data", (data) => {
      const error = data.toString();
      if (!error.includes("Terminated")) {
        console.warn("Claude stderr:", error);
      }
    });

    claude.on("close", () => {
      clearTimeout(timeout);
      if (!claudeInitialized) {
        claudeInitialized = true;
        claudeInitError = null;
        resolve(true);
      }
    });

    claude.on("error", (err) => {
      clearTimeout(timeout);
      claudeInitError = err.message;
      console.error("❌ Failed to initialize Claude:", err.message);
      resolve(false);
    });
  });
}

/**
 * Expand {{include file.md}} directives in markdown content
 * Recursively resolves includes up to 10 levels deep to prevent infinite loops
 */
function expandIncludes(content, basePath, depth = 0, maxDepth = 10) {
  if (depth >= maxDepth) {
    console.warn(`⚠  Max include depth ${maxDepth} reached, stopping recursion`);
    return content;
  }

  // Match {{include file.md}} or {{include ./path/file.md}}
  const includePattern = /{{\s*include\s+([^}]+)\s*}}/gi;
  let match;
  let expandedContent = content;
  let hasIncludes = false;

  while ((match = includePattern.exec(content)) !== null) {
    hasIncludes = true;
    const fullMatch = match[0];
    const includePath = match[1].trim();
    
    // Resolve path relative to base path
    const resolvedPath = path.isAbsolute(includePath)
      ? includePath
      : path.join(basePath, includePath);

    try {
      if (!fs.existsSync(resolvedPath)) {
        console.warn(`⚠  Include file not found: ${resolvedPath}`);
        expandedContent = expandedContent.replace(
          fullMatch,
          `<!-- Include not found: ${includePath} -->`
        );
        continue;
      }

      const includedContent = fs.readFileSync(resolvedPath, "utf-8");
      console.log(`  ↳ Expanding include: ${includePath}`);
      
      // Recursively expand includes in the included file
      const expandedInclude = expandIncludes(
        includedContent,
        path.dirname(resolvedPath),
        depth + 1,
        maxDepth
      );

      expandedContent = expandedContent.replace(fullMatch, expandedInclude);
    } catch (err) {
      console.error(`❌ Error reading include ${includePath}: ${err.message}`);
      expandedContent = expandedContent.replace(
        fullMatch,
        `<!-- Error including: ${includePath} - ${err.message} -->`
      );
    }
  }

  return expandedContent;
}

/**
 * Preload the prompt file at startup to validate and cache it
 * Expands {{include}} directives before caching
 */
async function preloadPrompt() {
  return new Promise((resolve) => {
    const promptPath = resolvePromptPath();

    if (!promptPath) {
      const workspace = normalizeWorkspacePath(CLAUDE_WORKSPACE);
      promptLoadError = `Prompt file not found. Checked workspace='${workspace}', cwd='${process.cwd()}', and repo root.`;
      console.error(`❌ ${promptLoadError}`);
      return resolve(false);
    }

    try {
      const rawContent = fs.readFileSync(promptPath, "utf-8");
      
      // Check if content has include directives
      const hasIncludes = /{{\s*include\s+[^}]+\s*}}/i.test(rawContent);
      
      if (hasIncludes) {
        console.log("  Expanding {{include}} directives...");
        preloadedPromptContent = expandIncludes(
          rawContent,
          path.dirname(promptPath)
        );
        console.log(
          `✓ Prompt expanded: ${promptPath} (${rawContent.length} → ${preloadedPromptContent.length} bytes)`
        );
      } else {
        preloadedPromptContent = rawContent;
        console.log(
          `✓ Prompt preloaded: ${promptPath} (${preloadedPromptContent.length} bytes)`
        );
      }
      
      resolve(true);
    } catch (err) {
      promptLoadError = `Failed to read prompt: ${err.message}`;
      console.error(`❌ ${promptLoadError}`);
      resolve(false);
    }
  });
}

// API Routes

/**
 * GET /api/journeys
 * Returns all stored journey data (fraud detection runs)
 */
app.get("/api/journeys", (req, res) => {
  try {
    const journeysPath = path.join(__dirname, "journeys.json");
    
    if (!fs.existsSync(journeysPath)) {
      return res.json([]);
    }
    
    const data = fs.readFileSync(journeysPath, "utf-8");
    const journeys = JSON.parse(data);
    res.json(journeys);
  } catch (error) {
    console.error("Error reading journeys:", error);
    res.status(500).json({ error: "Failed to read journey data" });
  }
});

/**
 * POST /api/journeys
 * Append a new journey to journeys.json
 * Body: { journey: object }
 */
app.post("/api/journeys", (req, res) => {
  try {
    const { journey } = req.body;
    
    if (!journey) {
      return res.status(400).json({ error: "Journey data is required" });
    }
    
    const journeysPath = path.join(__dirname, "journeys.json");
    let journeys = [];
    
    // Read existing journeys if file exists
    if (fs.existsSync(journeysPath)) {
      const data = fs.readFileSync(journeysPath, "utf-8");
      journeys = JSON.parse(data);
    }
    
    // Append new journey
    journeys.push(journey);
    
    // Write back to file
    fs.writeFileSync(journeysPath, JSON.stringify(journeys, null, 2), "utf-8");
    
    console.log(`✓ Journey saved: ${journey.customer_name || journey.runId}`);
    res.json({ success: true, journey });
  } catch (error) {
    console.error("Error saving journey:", error);
    res.status(500).json({ error: "Failed to save journey data" });
  }
});

/**
 * DELETE /api/journeys/:index
 * Delete a journey by array index
 */
app.delete("/api/journeys/:index", (req, res) => {
  try {
    const index = Number.parseInt(req.params.index, 10);
    if (!Number.isInteger(index) || index < 0) {
      return res.status(400).json({ error: "Invalid journey index" });
    }

    const journeysPath = path.join(__dirname, "journeys.json");
    if (!fs.existsSync(journeysPath)) {
      return res.status(404).json({ error: "No journey data found" });
    }

    const data = fs.readFileSync(journeysPath, "utf-8");
    const journeys = JSON.parse(data);

    if (!Array.isArray(journeys)) {
      return res.status(500).json({ error: "Journey data is invalid" });
    }

    if (index >= journeys.length) {
      return res.status(404).json({ error: "Journey index out of range" });
    }

    const [deletedJourney] = journeys.splice(index, 1);
    fs.writeFileSync(journeysPath, JSON.stringify(journeys, null, 2), "utf-8");

    console.log(`✓ Journey deleted at index ${index}`);
    res.json({ success: true, deletedJourney, remaining: journeys.length });
  } catch (error) {
    console.error("Error deleting journey:", error);
    res.status(500).json({ error: "Failed to delete journey data" });
  }
});

/**
 * POST /api/query
 * Submits a query to Claude Code CLI for fraud detection
 * Body: { query: string }
 * Returns: { sessionId: string, status: string }
 */
app.post("/api/query", async (req, res) => {
  const { query } = req.body;

  if (!query || typeof query !== "string") {
    return res
      .status(400)
      .json({ error: "Query is required and must be a string" });
  }

  const scriptPath = USE_PNC_SCRIPT ? resolvePncScriptPath() : null;

  // Check if Claude is initialized (not required in script mode)
  if (!USE_PNC_SCRIPT && claudeInitError) {
    return res.status(503).json({
      error: "Claude Code CLI is not available",
      details: claudeInitError,
    });
  }

  // Check if prompt is loaded (not required in script mode)
  if (!USE_PNC_SCRIPT && (promptLoadError || !preloadedPromptContent)) {
    return res.status(503).json({
      error: "Prompt file not available",
      details: promptLoadError || "Prompt not loaded",
    });
  }

  // Check if script exists in script mode
  if (USE_PNC_SCRIPT && !scriptPath) {
    return res.status(503).json({
      error: "PNC script not available",
      details: `Could not resolve script path: ${PNC_SCRIPT_PATH}`,
    });
  }

  const sessionId = `session_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  const outputBuffer = [];
  let executionStatus = "running";

  // Store session data
  activeSessions.set(sessionId, {
    query,
    status: "running",
    output: [],
    startTime: Date.now(),
    progress: USE_PNC_SCRIPT
      ? "Initializing PNC shell workflow..."
      : "Initializing Claude Code...",
  });

  res.json({ sessionId, status: "running" });

  // Execute command in background
  executeClaudeQuery(sessionId, query, outputBuffer);
});

/**
 * GET /api/session/:sessionId
 * Returns the current status and output of a session
 */
app.get("/api/session/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  res.json({
    sessionId,
    status: session.status,
    progress: session.progress,
    output: session.output,
    timestamp: Date.now(),
    executionTime: Date.now() - session.startTime,
  });
});

/**
 * WebSocket-like polling for real-time updates
 * GET /api/session/:sessionId/stream
 * Returns Server-Sent Events stream
 */
app.get("/api/session/:sessionId/stream", (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (VERBOSE_LOGGING) {
    console.log(`→ [SSE] Open stream for session=${sessionId}`);
  }

  // Send initial data
  res.write(`data: ${JSON.stringify({ type: "init", session })}\n\n`);

  // Poll for updates every 500ms
  const interval = setInterval(() => {
    if (!activeSessions.has(sessionId)) {
      clearInterval(interval);
      res.write(`data: ${JSON.stringify({ type: "complete" })}\n\n`);
      res.end();
      if (VERBOSE_LOGGING) {
        console.log(`← [SSE] Session removed, stream closed session=${sessionId}`);
      }
      return;
    }

    const updatedSession = activeSessions.get(sessionId);
    res.write(
      `data: ${JSON.stringify({ type: "update", session: updatedSession })}\n\n`
    );

    if (
      updatedSession.status === "completed" ||
      updatedSession.status === "error"
    ) {
      clearInterval(interval);
      setTimeout(() => res.end(), 1000);
      if (VERBOSE_LOGGING) {
        console.log(
          `← [SSE] Terminal state=${updatedSession.status}, closing stream session=${sessionId}`
        );
      }
    }
  }, 500);

  req.on("close", () => {
    clearInterval(interval);
    if (VERBOSE_LOGGING) {
      console.log(`← [SSE] Client disconnected session=${sessionId}`);
    }
  });
});

/**
 * GET /api/session/:sessionId/result
 * Returns the final result
 */
app.get("/api/session/:sessionId/result", (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  if (session.status === "running") {
    return res.status(202).json({ status: "still_running" });
  }

  res.json({
    sessionId,
    status: session.status,
    output: session.output,
    error: session.error || null,
    executionTime: Date.now() - session.startTime,
  });
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get("/api/health", async (req, res) => {
  // Initialize Claude if not already done
  if (!claudeInitialized && !claudeInitError) {
    await initializeClaude();
  }
  // Preload prompt if not already done
  if (!preloadedPromptContent && !promptLoadError) {
    await preloadPrompt();
  }

  res.json({
    status: claudeInitError || promptLoadError ? "error" : "ok",
    claudeReady: claudeInitialized,
    promptReady: !!preloadedPromptContent,
    error: claudeInitError || promptLoadError || null,
    timestamp: Date.now(),
  });
});

/**
 * POST /api/initialize
 * Manually trigger Claude initialization
 */
app.post("/api/initialize", async (req, res) => {
  if (claudeInitialized) {
    return res.json({ status: "already_initialized", timestamp: Date.now() });
  }

  console.log(" Claude initialization requested...");
  const success = await initializeClaude();

  if (success) {
    res.json({
      status: "initialized",
      timestamp: Date.now(),
    });
  } else {
    res.status(503).json({
      status: "failed",
      error: claudeInitError,
      timestamp: Date.now(),
    });
  }
});

// Helper function to execute Claude query
async function executeClaudeQuery(sessionId, userQuery, outputBuffer) {
  const session = activeSessions.get(sessionId);

  if (USE_PNC_SCRIPT) {
    const scriptPath = resolvePncScriptPath();
    if (!scriptPath) {
      session.status = "error";
      session.error = `PNC script not found: ${PNC_SCRIPT_PATH}`;
      session.progress = "Error: PNC script not found";
      outputBuffer.push({
        type: "error",
        content: session.error,
        timestamp: Date.now(),
      });
      session.output = outputBuffer;
      return;
    }

    const scriptCwd = path.dirname(scriptPath);
    const shell = process.platform === "win32" ? "bash" : "/bin/bash";
    const scriptArgs = [scriptPath, userQuery];

    console.log(`\n${"*".repeat(80)}`);
    console.log(` [${sessionId.substring(0, 15)}] STARTING PNC SCRIPT MODE`);
    console.log(` [${sessionId.substring(0, 15)}] Script: ${scriptPath}`);
    console.log(` [${sessionId.substring(0, 15)}] Query/customer input: "${userQuery}"`);
    console.log(` [${sessionId.substring(0, 15)}] CWD: ${scriptCwd}`);
    console.log(`${"*".repeat(80)}\n`);

    session.progress = "Running run_pnc_process.sh...";

    const child = spawn(shell, scriptArgs, {
      cwd: scriptCwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        PYTHONIOENCODING: "utf-8",
        FORCE_COLOR: "0",
      },
    });

    let output = "";
    let errorOutput = "";
    let outputChunkCount = 0;
    let stderrChunkCount = 0;

    const processTimeout = setTimeout(() => {
      if (session.status === "running") {
        child.kill("SIGTERM");
        session.status = "error";
        session.error = "Query execution timeout";
        session.progress = "Error: Query execution timeout";
        outputBuffer.push({
          type: "error",
          content: session.error,
          timestamp: Date.now(),
        });
        session.output = outputBuffer;
      }
    }, CLAUDE_TIMEOUT);

    child.stdout.on("data", (data) => {
      outputChunkCount++;
      const chunk = data.toString();
      output += chunk;

      if (VERBOSE_LOGGING) {
        console.log(`\n${"=".repeat(80)}`);
        console.log(
          ` [${sessionId.substring(0, 15)}] SCRIPT stdout chunk #${outputChunkCount} (${chunk.length} bytes)`
        );
        console.log(chunk);
        console.log(`${"=".repeat(80)}\n`);
      }

      outputBuffer.push({
        type: "stdout",
        content: chunk,
        timestamp: Date.now(),
      });
      session.output = outputBuffer;
      parseAndUpdateProgress(session, chunk);
    });

    child.stderr.on("data", (data) => {
      stderrChunkCount++;
      const chunk = data.toString();
      errorOutput += chunk;

      if (VERBOSE_LOGGING) {
        console.log(`\n${"!".repeat(80)}`);
        console.warn(
          ` [${sessionId.substring(0, 15)}] SCRIPT stderr chunk #${stderrChunkCount} (${chunk.length} bytes)`
        );
        console.warn(chunk);
        console.log(`${"!".repeat(80)}\n`);
      }

      outputBuffer.push({
        type: "stderr",
        content: chunk,
        timestamp: Date.now(),
      });
      session.output = outputBuffer;
    });

    child.on("close", (code) => {
      clearTimeout(processTimeout);

      console.log(`\n${"#".repeat(80)}`);
      console.log(
        `ℹ  [${sessionId.substring(0, 15)}] Script process closed with code ${code}`
      );
      console.log(
        ` [${sessionId.substring(0, 15)}] Total stdout: ${output.length} bytes in ${outputChunkCount} chunks`
      );
      console.log(
        ` [${sessionId.substring(0, 15)}] Total stderr: ${errorOutput.length} bytes in ${stderrChunkCount} chunks`
      );
      console.log(`${"#".repeat(80)}\n`);

      if (code === 0 && session.status !== "completed") {
        session.status = "completed";
        session.progress = "Processing complete";
        outputBuffer.push({
          type: "meta",
          content: "Process completed successfully",
          timestamp: Date.now(),
        });

        // Fallback extraction in case progress parser missed it
        if (!session.journey) {
          extractAndSaveJourney(session);
        }
      } else if (session.status !== "error" && session.status !== "completed") {
        session.status = "error";
        session.error = `Process exited with code ${code}`;
        session.progress = `Error: ${session.error}`;
        outputBuffer.push({
          type: "error",
          content: session.error,
          timestamp: Date.now(),
        });
      }

      session.output = outputBuffer;
    });

    child.on("error", (err) => {
      clearTimeout(processTimeout);
      session.status = "error";
      session.error = err.message;
      session.progress = `Error: ${err.message}`;
      outputBuffer.push({
        type: "error",
        content: err.message,
        timestamp: Date.now(),
      });
      session.output = outputBuffer;
    });

    return;
  }

  // Use preloaded prompt
  if (!preloadedPromptContent) {
    session.status = "error";
    session.error = promptLoadError || "Prompt not loaded";
    session.progress = "Error: Prompt not available";
    outputBuffer.push({
      type: "error",
      content: session.error,
      timestamp: Date.now(),
    });
    return;
  }

  session.progress = "Starting Claude Code with preloaded prompt...";
  console.log(`\n${"*".repeat(80)}`);
  console.log(` [${sessionId.substring(0, 15)}] STARTING NEW CLAUDE PROCESS (PNC)`);
  console.log(` [${sessionId.substring(0, 15)}] User query: "${userQuery}"`);
  console.log(
    ` [${sessionId.substring(0, 15)}] Working directory: ${
      path.isAbsolute(CLAUDE_WORKSPACE)
        ? CLAUDE_WORKSPACE
        : path.resolve(CLAUDE_WORKSPACE)
    }`
  );
  console.log(`${"*".repeat(80)}\n`);

  console.log(` [${sessionId.substring(0, 15)}] About to spawn command...`);
  session.progress = "Launching Claude process...";
  console.log(` [${sessionId.substring(0, 15)}]   Command: claude`);
  console.log(
    ` [${sessionId.substring(
      0,
      15
    )}]   Args: ["--allowed-tools", "mcp__zaimler-ntt-ins-pc__set_workspace,mcp__zaimler-ntt-ins-pc__agent_chat"]`
  );
  console.log(
    ` [${sessionId.substring(0, 15)}]   CWD: ${
      path.isAbsolute(CLAUDE_WORKSPACE)
        ? CLAUDE_WORKSPACE
        : path.resolve(CLAUDE_WORKSPACE)
    }`
  );

  const childEnv = {
    ...process.env,
    PYTHONUNBUFFERED: "1",
    PYTHONIOENCODING: "utf-8",
    FORCE_COLOR: "0",
  };

  // Prefer PTY on Windows for line-by-line streaming; fallback to spawn
  let usePty = process.platform === "win32" || process.env.USE_PTY === "1";
  let proc = null;
  let isPty = false;
  if (usePty) {
    try {
      const ptyModule = await import("node-pty");
      const pty = ptyModule.spawn(
        "claude",
        [
          "--allowed-tools",
          "mcp__zaimler-ntt-ins-pc__set_workspace,mcp__zaimler-ntt-ins-pc__agent_chat,mcp__zaimler-ntt-ins-pc__execute_template",
        ],
        {
          name: "xterm-color",
          cols: 120,
          rows: 30,
          cwd: path.isAbsolute(CLAUDE_WORKSPACE)
            ? CLAUDE_WORKSPACE
            : path.resolve(CLAUDE_WORKSPACE),
          env: childEnv,
        }
      );
      proc = pty;
      isPty = true;
      console.log(`✓ [${sessionId.substring(0, 15)}] PTY process spawned`);
    } catch (e) {
      console.warn(
        `⚠  PTY not available (${e.message}). Falling back to spawn.`
      );
      usePty = false;
    }
  }

  if (!proc) {
    const child = spawn(
      "claude",
      [
        "--allowed-tools",
        "mcp__zaimler-ntt-ins-pc__set_workspace,mcp__zaimler-ntt-ins-pc__agent_chat,mcp__zaimler-ntt-ins-pc__execute_template",
      ],
      {
        cwd: path.isAbsolute(CLAUDE_WORKSPACE)
          ? CLAUDE_WORKSPACE
          : path.resolve(CLAUDE_WORKSPACE),
        stdio: ["pipe", "pipe", "pipe"],
        env: childEnv,
      }
    );
    proc = child;
  }

  console.log(`✓ [${sessionId.substring(0, 15)}] Process spawned successfully`);
  if (!isPty) {
    console.log(` [${sessionId.substring(0, 15)}] Process PID: ${proc.pid}`);
    console.log(
      ` [${sessionId.substring(0, 15)}] stdin writable: ${
        proc.stdin.writable
      }`
    );
    console.log(
      ` [${sessionId.substring(0, 15)}] stdout readable: ${
        proc.stdout.readable
      }`
    );
    console.log(
      ` [${sessionId.substring(0, 15)}] stderr readable: ${
        proc.stderr.readable
      }`
    );
  }

  // Add error handler for stdin
  if (!isPty) {
    proc.stdin.on("error", (err) => {
      console.error(
        `❌ [${sessionId.substring(0, 15)}] stdin error: ${err.message}`
      );
    });
  }

  // Combine prompt and query into single input, then close stdin
  // This matches the behavior of: cat prompt.md | claude --allowed-tools ...
  const combinedInput = preloadedPromptContent + "\n\n" + userQuery + "\n";

  console.log(
    ` [${sessionId.substring(0, 15)}] Writing combined prompt + query (${
      combinedInput.length
    } bytes total)...`
  );
  session.progress = "Sending prompt and customer query...";
  console.log(
    ` [${sessionId.substring(0, 15)}] Prompt: ${
      preloadedPromptContent.length
    } bytes`
  );
  console.log(` [${sessionId.substring(0, 15)}] Query: "${userQuery}"`);
  
  // Show preview of prompt being sent to Claude
  console.log(`\n${"-".repeat(80)}`);
  console.log(` [${sessionId.substring(0, 15)}] PROMPT PREVIEW (first 500 chars):`);
  console.log(preloadedPromptContent.substring(0, 500));
  console.log(`  ... (${preloadedPromptContent.length - 500} more bytes)`);
  console.log(`${"-".repeat(80)}`);
  console.log(` [${sessionId.substring(0, 15)}] USER QUERY:`);
  console.log(`  ${userQuery}`);
  console.log(`${"-".repeat(80)}\n`);

  try {
    if (isPty) {
      const eot = process.platform === "win32" ? "\x1A\r\n" : "\x04";
      proc.write(combinedInput);
      proc.write(eot);
      console.log(
        `✓ [${sessionId.substring(0, 15)}] Prompt+query sent via PTY with EOT`
      );
    } else {
      const written = proc.stdin.write(combinedInput);
      console.log(
        `✓ [${sessionId.substring(0, 15)}] stdin.write returned: ${written}`
      );
      console.log(
        ` [${sessionId.substring(0, 15)}] Closing stdin to signal EOF`
      );
      proc.stdin.end();
      console.log(
        `✓ [${sessionId.substring(0, 15)}] Input sent and stdin closed`
      );
    }
    
    console.log(`\n  ${sessionId.substring(0, 15)}] Sent ${combinedInput.length} bytes to Claude`);
    console.log(`   Waiting for Claude's response...\n`);
    session.progress = "Waiting for Claude response...";
  } catch (err) {
    console.error(
      `❌ [${sessionId.substring(0, 15)}] Error sending input: ${err.message}`
    );
  }

  let output = "";
  let errorOutput = "";
  let processTimeout;
  let outputChunkCount = 0;
  let stderrChunkCount = 0;

  // Log when streams are set up
  console.log(
    ` [${sessionId.substring(0, 15)}] Setting up stdout listener...`
  );
  console.log(
    ` [${sessionId.substring(0, 15)}] Setting up stderr listener...`
  );
  console.log(
    ` [${sessionId.substring(0, 15)}] Setting up process event listeners...`
  );

  // Capture stdout
  const onStdout = (data) => {
    outputChunkCount++;
    const chunk = data.toString();
    output += chunk;

    if (outputChunkCount === 1 && session.status === "running") {
      session.progress = "Receiving analysis output...";
    }

    // Log full output for debugging
    console.log(`\n${"=".repeat(80)}`);
    console.log(
      ` [${sessionId.substring(
        0,
        15
      )}] Claude stdout chunk #${outputChunkCount} (${chunk.length} bytes):`
    );
    console.log(chunk);
    console.log(`${"=".repeat(80)}\n`);

    outputBuffer.push({
      type: "stdout",
      content: chunk,
      timestamp: Date.now(),
    });
    session.output = outputBuffer;
    
    console.log(`\n  BUFFER STATUS:`);
    console.log(`     Total chunks received: ${outputChunkCount}`);
    console.log(`     Output buffer items: ${outputBuffer.length}`);
    console.log(`     Total bytes accumulated: ${output.length}`);
    console.log(`\n  ACCUMULATED OUTPUT SO FAR (first 1000 chars):`);
    console.log(`${"-".repeat(80)}`);
    console.log(output.substring(0, 1000));
    if (output.length > 1000) {
      console.log(`\n     ... (${output.length - 1000} more bytes not shown)`);
    }
    console.log(`${"-".repeat(80)}\n`);
    
    parseAndUpdateProgress(session, chunk);
  };

  const onStderr = (data) => {
    stderrChunkCount++;
    const chunk = data.toString();
    errorOutput += chunk;
    console.log(`\n${"!".repeat(80)}`);
    console.warn(
      `⚠  [${sessionId.substring(
        0,
        15
      )}] Claude stderr chunk #${stderrChunkCount} (${chunk.length} bytes):`
    );
    console.warn(chunk);
    console.log(`${"!".repeat(80)}\n`);
    outputBuffer.push({
      type: "stderr",
      content: chunk,
      timestamp: Date.now(),
    });
    session.output = outputBuffer;
  };

  if (isPty) {
    proc.onData(onStdout);
    // PTY merges stdout/stderr; we treat all as stdout for streaming
  } else {
    proc.stdout.on("data", onStdout);
    proc.stderr.on("data", onStderr);
  }

  // Set timeout for execution
  console.log(
    `⏱  [${sessionId.substring(
      0,
      15
    )}] Overall timeout set to ${CLAUDE_TIMEOUT}ms`
  );
  console.log(
    `⏱  [${sessionId.substring(0, 15)}] Timeout will fire at: ${new Date(
      Date.now() + CLAUDE_TIMEOUT
    ).toISOString()}`
  );

  processTimeout = setTimeout(() => {
    if (session.status === "running") {
      const elapsedSeconds = Math.round(
        (Date.now() - session.startTime) / 1000
      );
      console.log(
        `\n❌❌❌ [${sessionId.substring(
          0,
          15
        )}] TIMEOUT REACHED after ${elapsedSeconds}s (${CLAUDE_TIMEOUT}ms limit) - Killing process ❌❌❌`
      );
      console.log(
        ` [${sessionId.substring(0, 15)}] Total stdout: ${
          output.length
        } bytes in ${outputChunkCount} chunks`
      );
      console.log(
        ` [${sessionId.substring(0, 15)}] Total stderr: ${
          errorOutput.length
        } bytes in ${stderrChunkCount} chunks`
      );
      console.log(
        ` [${sessionId.substring(0, 15)}] Process PID: ${
          proc.pid || "undefined"
        }`
      );
      console.log(
        `⏱  [${sessionId.substring(0, 15)}] Query was: "${userQuery.substring(
          0,
          50
        )}..."`
      );
      console.log(
        `⏱  [${sessionId.substring(0, 15)}] Last progress: "${
          session.progress
        }"`
      );
      if (isPty && proc.kill) {
        try {
          proc.kill();
        } catch (e) {}
      } else {
        proc.kill();
      }
      session.status = "error";
      session.error = "Query execution timeout";
      session.progress = "Error: Query execution timeout";
    }
  }, CLAUDE_TIMEOUT);

  // Handle process close
  const onClose = (code) => {
    console.log(`\n${"#".repeat(80)}`);
    console.log(
      `ℹ  [${sessionId.substring(
        0,
        15
      )}] Claude process closed with code ${code}`
    );
    console.log(
      ` [${sessionId.substring(0, 15)}] Total stdout: ${output.length} bytes in ${outputChunkCount} chunks`
    );
    console.log(
      ` [${sessionId.substring(0, 15)}] Total stderr: ${
        errorOutput.length
      } bytes`
    );
    console.log(
      ` [${sessionId.substring(0, 15)}] Output buffer items: ${outputBuffer.length}`
    );
    console.log(
      ` [${sessionId.substring(0, 15)}] Session status: ${session.status}`
    );
    
    // Log summary of what was captured
    const stdoutItems = outputBuffer.filter(item => item.type === 'stdout');
    const totalStdoutBytes = stdoutItems.reduce((sum, item) => sum + item.content.length, 0);
    console.log(
      ` [${sessionId.substring(0, 15)}] Frontend will receive ${stdoutItems.length} stdout chunks totaling ${totalStdoutBytes} bytes`
    );
    
    // Show complete output that will be sent to frontend
    console.log(`\n${"+".repeat(80)}`);
    console.log(` [${sessionId.substring(0, 15)}] COMPLETE OUTPUT FROM CLAUDE (${output.length} bytes):`);
    console.log(`${"+".repeat(80)}`);
    console.log(output);
    console.log(`${"+".repeat(80)}`);
    console.log(` [${sessionId.substring(0, 15)}] END OF CLAUDE OUTPUT`);
    console.log(`${"#".repeat(80)}\n`);

    clearTimeout(processTimeout);
    if (code === 0 && session.status !== "completed") {
      session.status = "completed";
      session.progress = "Processing complete";
      outputBuffer.push({
        type: "meta",
        content: "Process completed successfully",
        timestamp: Date.now(),
      });
    } else if (session.status !== "error" && session.status !== "completed") {
      session.status = "error";
      session.error = `Process exited with code ${code}`;
      session.progress = `Error: ${session.error}`;
      outputBuffer.push({
        type: "meta",
        content: session.error,
        timestamp: Date.now(),
      });
    }
    session.output = outputBuffer;
  };

  if (isPty) {
    proc.onExit(({ exitCode }) => onClose(exitCode));
  } else {
    proc.on("close", onClose);
  }

  // Handle process errors
  if (!isPty)
    proc.on("error", (err) => {
      console.log(
        `\n❌❌❌ [${sessionId.substring(0, 15)}] Process error: ${
          err.message
        } ❌❌❌\n`
      );
      clearTimeout(processTimeout);
      session.status = "error";
      session.error = err.message;
      session.progress = `Error: ${err.message}`;
      outputBuffer.push({
        type: "error",
        content: err.message,
        timestamp: Date.now(),
      });
      session.output = outputBuffer;
    });
}

// Helper to parse output and update progress
function parseAndUpdateProgress(session, chunk) {
  const prevProgress = session.progress;

  if (chunk.includes("[TRACE][Controller] Process started")) {
    session.progress = "Process started - analyzing query...";
  } else if (chunk.includes("[TRACE][Controller] Processing customer")) {
    session.progress = "Processing customer data...";
  } else if (chunk.includes("Customer Context")) {
    session.progress = "Calculating customer context risk...";
  } else if (chunk.includes("Claim Timeline")) {
    session.progress = "Analyzing claim timeline...";
  } else if (chunk.includes("Financial Anomaly")) {
    session.progress = "Analyzing financial anomalies...";
  } else if (chunk.includes("Evidence Consistency")) {
    session.progress = "Reviewing evidence consistency...";
  } else if (chunk.includes("[TRACE][Controller] Delegating")) {
    session.progress = "Delegating to worker agents...";
  } else if (chunk.includes("mcp__zaimler-ntt-ins-pc__agent_chat")) {
    session.progress = "Querying Zaimler database...";
  } else if (chunk.includes("Explorer query")) {
    session.progress = "Running Explorer query...";
  } else if (chunk.includes("Template:")) {
    session.progress = "Running template query...";
  } else if (chunk.includes("Response received")) {
    session.progress = "Processing retrieved data...";
  } else if (chunk.includes("Assembling orchestration")) {
    session.progress = "Preparing orchestration...";
  } else if (chunk.includes("Connecting to Zaimler knowledge graph")) {
    session.progress = "Connecting to knowledge graph...";
  }

  // Log progress changes
  if (prevProgress !== session.progress) {
    console.log(
      ` Progress updated: "${prevProgress}" → "${session.progress}"`
    );
  }

  // Detect final output block required by controller prompt
  // Don't mark as completed yet - let process exit naturally to capture all output
  if (chunk.includes("```EXECUTION_STATE")) {
    console.log(`✅ Detected EXECUTION_STATE final block - continuing to capture output`);
    session.progress = "Finalizing results...";
    session.output.push({
      type: "meta",
      content: "Detected EXECUTION_STATE final block",
      timestamp: Date.now(),
    });
    
    // Extract and save journey JSON from accumulated output
    extractAndSaveJourney(session);
  }
}

// Helper to extract journey JSON from agent output and save it
function extractAndSaveJourney(session) {
  try {
    // Combine all stdout content (includes both text and JSON)
    const fullOutput = session.output
      .filter(item => item.type === 'stdout')
      .map(item => item.content)
      .join('');
    
    console.log(`\n  Searching for JSON in ${fullOutput.length} bytes of output...`);
    
    // Look for JSON in the output - try multiple patterns for fraud detection
    const jsonPatterns = [
      /```json\s*([\s\S]*?)```/i,
      /```\s*({[\s\S]*?})\s*```/,
      /{\s*"run_id"[\s\S]*?"final_disposition"\s*:[^}]*}/i,
      /{\s*"customer_name"[\s\S]*?"final_disposition"\s*:[^}]*}/i,
      /EXECUTION_STATE[\s\S]*?({[\s\S]*?})/
    ];
    
    let journeyData = null;
    let foundPattern = null;
    
    for (let i = 0; i < jsonPatterns.length; i++) {
      const pattern = jsonPatterns[i];
      const match = fullOutput.match(pattern);
      if (match) {
        try {
          const jsonStr = match[1] || match[0];
          const cleaned = jsonStr.replace(/```(json)?/g, '').trim();
          journeyData = JSON.parse(cleaned);
          foundPattern = i;
          console.log(`✅ Extracted journey JSON using pattern ${i + 1}`);
          break;
        } catch (e) {
          console.warn(`⚠  Pattern ${i + 1} matched but failed to parse: ${e.message}`);
          continue;
        }
      }
    }
    
    if (!journeyData) {
      console.warn('⚠  No valid journey JSON found in output');
      return;
    }
    
    // Save to journeys.json
    const journeysPath = path.join(__dirname, "journeys.json");
    let journeys = [];
    
    if (fs.existsSync(journeysPath)) {
      const data = fs.readFileSync(journeysPath, "utf-8");
      journeys = JSON.parse(data);
    }
    
    journeys.push(journeyData);
    fs.writeFileSync(journeysPath, JSON.stringify(journeys, null, 2), "utf-8");
    
    const identifier = journeyData.customer_name || journeyData.run_id || 'Unknown';
    console.log(`✅ Journey saved to journeys.json: ${identifier}`);
    console.log(`   Total journeys stored: ${journeys.length}`);
    
    // Store in session for frontend access
    session.journey = journeyData;
  } catch (error) {
    console.error('❌ Error extracting/saving journey:', error);
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`\n${"=".repeat(80)}`);
  console.log(` PNC FRAUD DETECTION BACKEND (Port ${PORT})`);
  console.log(`${"=".repeat(80)}`);
  console.log(` Backend server running on http://localhost:${PORT}`);
  console.log(` Claude workspace: ${path.resolve(CLAUDE_WORKSPACE)}`);
  console.log(` Prompt file: ${PROMPT_FILE}`);
  console.log(` Script mode: ${USE_PNC_SCRIPT ? "enabled" : "disabled"}`);
  if (USE_PNC_SCRIPT) {
    console.log(` PNC script path hint: ${PNC_SCRIPT_PATH}`);
  }
  console.log(` Verbose logging: ${VERBOSE_LOGGING ? "enabled" : "disabled"}`);
  console.log(`⏱  Execution timeout: ${CLAUDE_TIMEOUT}ms`);
  console.log("");
  console.log("Initializing Claude Code (short check)...");
  await initializeClaude();
  console.log("Preloading prompt file...");
  await preloadPrompt();
  console.log("");
  console.log("✅ Backend ready to accept queries");
  console.log(`${"=".repeat(80)}\n`);
});
