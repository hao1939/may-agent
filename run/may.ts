import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { getModel } from "@mariozechner/pi-ai";
import {
  SubagentManager,
  createLinkedTools,
  createExecTool,
  createWorkflowTool,
  evaluateTask,
} from "../src/index.js";
import { EventBus } from "./event-bus.js";
import { attachConsoleUI } from "./console-ui.js";
import { attachSocketUI } from "./socket-ui.js";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AGENTS_ROOT = resolve(PROJECT_ROOT, "agents");
const PERSIST_DIR = resolve(PROJECT_ROOT, ".state");
const SOCKET_PATH = resolve(PERSIST_DIR, "may.sock");
const SHARED_KNOWLEDGE = resolve(AGENTS_ROOT, "shared/system-design.md");
const SHARED_TEAM = resolve(AGENTS_ROOT, "shared/team.md");

// ── Model ──────────────────────────────────────────────────────────────

const opus = {
  ...getModel("anthropic", "claude-sonnet-4-20250514"),
  id: "claude-opus-4.6",
  baseUrl: "http://localhost:4000",
};

const gpt52 = {
  ...getModel("openai", "gpt-5.2"),
  baseUrl: "http://localhost:4000",
};

// ── Infrastructure ─────────────────────────────────────────────────────

const bus = new EventBus();
attachConsoleUI(bus);

// Agents to skip for auto-evaluation (meta agents evaluate feature agents, not themselves)
const EVAL_SKIP_AGENTS = new Set(["evaluator", "optimizer", "may"]);

const manager = new SubagentManager({
  persistDir: PERSIST_DIR,
  onSessionStart: (agentName, sessionId) => {
    attachAgentEvents(agentName, sessionId);
    if (agentName === "optimizer") optimizerSid = sessionId;
  },
});

/**
 * Create linked read+write tools with shared truncation tracking.
 * When read truncates a file, write warns if the agent writes back
 * significantly shorter content (catching data loss).
 */
function projectTools() {
  return createLinkedTools({
    projectRoot: PROJECT_ROOT,
    maxFileLength: 40_000,
  });
}

function projectExec() {
  return createExecTool({
    cwd: PROJECT_ROOT,
    echoCwd: true,
    warnOutsideRoot: PROJECT_ROOT,
    denyPatterns: [
      /^\s*find\s+\/\s/,      // find / ...
      /^\s*ls\s+\/\s*$/,      // ls /
      /^\s*cd\s+\/(?!home\/hao\/may-agent)/, // cd /anything except our project
    ],
    denyMessage: "Do not explore outside the project root. Use relative paths.",
  });
}

// Read-only exec for May — blocks file-writing commands
function readOnlyExec() {
  return createExecTool({
    cwd: PROJECT_ROOT,
    echoCwd: true,
    warnOutsideRoot: PROJECT_ROOT,
    denyPatterns: [
      /^\s*find\s+\/\s/,
      /^\s*ls\s+\/\s*$/,
      /^\s*cd\s+\/(?!home\/hao\/may-agent)/,
      // Block file-writing commands
      /\bsed\s+-i\b/,                         // sed -i (in-place edit)
      /\bcat\s*>[^&]/,                          // cat > file (but not cat >&)
      /<<\s*['"]?\w+['"]?/,                     // heredoc (cat << EOF, cat <<'EOF')
      /\btee\s/,                                // tee file
      /\b(echo|printf)\b.*>{1,2}[^&]/,        // echo > file or echo >> file
      /\bmv\s|\bcp\s|\brm\s/,                  // mv, cp, rm (followed by space)
      /\bmkdir\b/,                             // mkdir
      /\btouch\b/,                             // touch
      /\bchmod\b|\bchown\b/,                   // chmod, chown
      /\bpython3?\s+-c\b.*open\(/,             // python -c "...open(..."
      /\bnode\s+-e\b/,                          // node -e
      /\bgit\s+(reset|checkout)\b/,            // git destructive operations (add/commit allowed)
    ],
    denyMessage: "You cannot write files. Delegate code changes to coder: subagents.delegate(\"coder\", task)",
  });
}

// ── Register agents ────────────────────────────────────────────────────

// Each agent gets its own linked tools (separate truncation trackers per agent)
const coderTools = projectTools();
manager.register({
  name: "coder",
  description: "Writes code, tests, commits",
  domain: "may-agent implementation",
  systemPromptFiles: [
    resolve(AGENTS_ROOT, "coder/knowledge/domain.md"),
    resolve(AGENTS_ROOT, "coder/knowledge/codebase.md"),
    resolve(AGENTS_ROOT, "coder/tools/INDEX.md"),
  ],
  knowledgeDir: resolve(AGENTS_ROOT, "coder/knowledge"),
  workspace: resolve(AGENTS_ROOT, "coder/workspace"),
  projectRoot: PROJECT_ROOT,
  model: opus,
  tools: [coderTools.read, coderTools.write, projectExec()],
  apiKey: "not-needed",
  maxTurns: 50,
});

const qaTools = projectTools();
manager.register({
  name: "qa",
  description: "Reviews code changes for correctness, quality, and requirement compliance",
  domain: "code quality review",
  systemPromptFiles: [
    resolve(AGENTS_ROOT, "qa/knowledge/domain.md"),
    resolve(AGENTS_ROOT, "qa/tools/INDEX.md"),
  ],
  knowledgeDir: resolve(AGENTS_ROOT, "qa/knowledge"),
  workspace: resolve(AGENTS_ROOT, "qa/workspace"),
  projectRoot: PROJECT_ROOT,
  model: gpt52,
  tools: [qaTools.read, qaTools.write, projectExec()],
  apiKey: "not-needed",
  maxTurns: 30,
});

const evaluatorTools = projectTools();
manager.register({
  name: "evaluator",
  description: "Evaluates completed task trees — scores each agent by responsibility",
  domain: "agent performance evaluation",
  systemPromptFiles: [
    SHARED_KNOWLEDGE,
    SHARED_TEAM,
    resolve(AGENTS_ROOT, "evaluator/knowledge/domain.md"),
  ],
  knowledgeDir: resolve(AGENTS_ROOT, "evaluator/knowledge"),
  workspace: resolve(AGENTS_ROOT, "evaluator/workspace"),
  projectRoot: PROJECT_ROOT,
  model: gpt52,
  tools: [evaluatorTools.read, evaluatorTools.write, projectExec()],
  apiKey: "not-needed",
  maxTurns: 20,
  memoryLimit: 5,
});

const optimizerTools = projectTools();
let optimizerSid: string | undefined;

const optimizerWorkflowTool = createWorkflowTool({
  manager,
  workflowDir: resolve(AGENTS_ROOT, "optimizer/workflows"),
  persistDir: PERSIST_DIR,
  callerSessionId: () => {
    if (!optimizerSid) throw new Error("No active optimizer session");
    return optimizerSid;
  },
  onEvent: (event) => {
    if (event.type === "workflow_start") {
      bus.emit({ type: "info", message: `[workflow:optimizer] Starting: ${event.workflow}` });
    } else if (event.type === "workflow_done") {
      bus.emit({ type: "info", message: `[workflow:optimizer] Done: ${event.summary.slice(0, 100)}` });
    } else if (event.type === "workflow_escalate") {
      bus.emit({ type: "info", message: `[workflow:optimizer] Escalated: ${event.reason}` });
    } else if (event.type === "step_start") {
      bus.emit({ type: "info", message: `[workflow:optimizer] Step: ${event.step}` });
      if (event.sessionId) attachAgentEvents(event.step, event.sessionId);
    }
  },
});

manager.register({
  name: "optimizer",
  description: "Analyzes agent performance data, proposes and implements improvements to the agent system",
  domain: "agent system optimization",
  systemPromptFiles: [
    SHARED_KNOWLEDGE,
    SHARED_TEAM,
    resolve(AGENTS_ROOT, "optimizer/knowledge/domain.md"),
    resolve(AGENTS_ROOT, "optimizer/knowledge/codebase.md"),
    resolve(AGENTS_ROOT, "optimizer/tools/INDEX.md"),
  ],
  knowledgeDir: resolve(AGENTS_ROOT, "optimizer/knowledge"),
  workspace: resolve(AGENTS_ROOT, "optimizer/workspace"),
  workflowDir: resolve(AGENTS_ROOT, "optimizer/workflows"),
  projectRoot: PROJECT_ROOT,
  model: opus,
  tools: [
    optimizerTools.read,
    optimizerTools.write,
    projectExec(),
    manager.createTool({
      getCallerSessionId: () => optimizerSid,
    }),
    optimizerWorkflowTool,
  ],
  apiKey: "not-needed",
  maxTurns: 40,
});

let sid: string;

const maySubagentTool = manager.createTool({
  getCallerSessionId: () => sid,
});

const mayWorkflowTool = createWorkflowTool({
  manager,
  workflowDir: resolve(AGENTS_ROOT, "may/workflows"),
  persistDir: PERSIST_DIR,
  callerSessionId: () => sid,
  onEvent: (event) => {
    if (event.type === "workflow_start") {
      bus.emit({ type: "info", message: `[workflow] Starting: ${event.workflow}` });
    } else if (event.type === "workflow_done") {
      bus.emit({ type: "info", message: `[workflow] Done: ${event.summary.slice(0, 100)}` });
    } else if (event.type === "workflow_escalate") {
      bus.emit({ type: "info", message: `[workflow] Escalated: ${event.reason}` });
    } else if (event.type === "step_start") {
      bus.emit({ type: "info", message: `[workflow] Step: ${event.step}` });
      if (event.sessionId) attachAgentEvents(event.step, event.sessionId);
    }
  },
});

manager.register({
  name: "may",
  description: "Supervisor — delegates to coder, reviews results",
  domain: "may-agent coordination",
  systemPromptFiles: [
    SHARED_KNOWLEDGE,
    SHARED_TEAM,
    resolve(AGENTS_ROOT, "may/knowledge/domain.md"),
    resolve(AGENTS_ROOT, "may/tools/INDEX.md"),
  ],
  knowledgeDir: resolve(AGENTS_ROOT, "may/knowledge"),
  workspace: resolve(AGENTS_ROOT, "may/workspace"),
  workflowDir: resolve(AGENTS_ROOT, "may/workflows"),
  projectRoot: PROJECT_ROOT,
  model: opus,
  tools: [readOnlyExec(), maySubagentTool, mayWorkflowTool],
  apiKey: "not-needed",
  persistent: true,
  compaction: {
    threshold: 0.7,
    keepRatio: 0.4,
    onCompact: (info) => {
      bus.emit({ type: "info", message: `Compaction: ${info.messagesCompacted} messages compacted (${info.tokensBefore} → ${info.tokensAfter} est. tokens)` });
    },
  },
});

// ── Event routing ──────────────────────────────────────────────────────

function attachAgentEvents(label: string, sessionId: string): void {
  manager.subscribe(sessionId, (event) => {
    switch (event.type) {
      case "message_start":
        if (event.message.role === "assistant") {
          bus.emit({ type: "prompt", message: label });
        }
        break;
      case "message_update":
        if (event.assistantMessageEvent.type === "text_delta") {
          bus.emit({ type: "text", agent: label, text: event.assistantMessageEvent.delta });
        }
        break;
      case "tool_execution_start":
        bus.emit({ type: "tool_call", agent: label, tool: event.toolName, args: event.args });
        break;
      case "tool_execution_end": {
        const text = event.result?.content?.[0]?.text ?? "";
        bus.emit({ type: "tool_result", agent: label, tool: event.toolName, preview: text.slice(0, 200), isError: !!event.isError });
        break;
      }
    }
  });
}

// ── Post-task evaluation ───────────────────────────────────────────────

/**
 * Run task-tree evaluation after May finishes a task (goes idle).
 * Finds all unevaluated child sessions and evaluates them together,
 * scoring each agent by its responsibility.
 */
async function runPostTaskEvaluation(): Promise<void> {
  try {
    const result = await evaluateTask({
      manager,
      persistDir: PERSIST_DIR,
      parentSessionId: sid,
      skipAgents: EVAL_SKIP_AGENTS,
    });

    if (!result) return; // no unevaluated children

    const agentSummaries = Object.values(result.agents)
      .map((a) => `${a.agent}: eff=${a.efficiency} qual=${a.quality} verdict=${a.verdict}`)
      .join(", ");
    bus.emit({
      type: "info",
      message: `[eval] Task evaluation: ${agentSummaries} | overall: eff=${result.overall.efficiency} qual=${result.overall.quality} verdict=${result.overall.verdict}`,
    });
  } catch (err) {
    bus.emit({ type: "info", message: `[eval] Error: ${err instanceof Error ? err.message : String(err)}` });
  }
}

// ── Socket commands ────────────────────────────────────────────────────

bus.onCommand((cmd) => {
  switch (cmd.type) {
    case "steer":
      bus.emit({ type: "info", message: `[socket] Steering: "${cmd.message.slice(0, 80)}"` });
      try {
        manager.steer(sid, cmd.message);
      } catch {
        bus.emit({ type: "info", message: `[socket] Cannot steer — session not running` });
      }
      break;
    case "cancel":
      bus.emit({ type: "info", message: `[socket] Cancel: ${cmd.sessionId}` });
      manager.cancel(cmd.sessionId);
      break;
    case "cancel_all":
      bus.emit({ type: "info", message: "[socket] Cancel all" });
      for (const s of manager.status()) {
        if (s.status === "running") manager.cancel(s.sessionId);
      }
      break;
    case "close":
      bus.emit({ type: "info", message: "[socket] Closing session (will not resume on restart)..." });
      manager.cancel(sid);
      gracefulShutdown();
      break;
    case "status": {
      const sessions = manager.status();
      if (sessions.length === 0) {
        bus.emit({ type: "info", message: "[status] No active sessions" });
      } else {
        const lines = sessions.map((s) =>
          `  ${s.agent} (${s.sessionId}): ${s.status} — "${s.task.slice(0, 80)}" [${s.runtime}]`
        );
        bus.emit({ type: "info", message: `[status] ${sessions.length} active session(s):\n${lines.join("\n")}` });
      }
      break;
    }
    case "input":
      bus.emit({ type: "info", message: `[socket] Input: "${cmd.message.slice(0, 80)}"` });
      lastUserInput = Date.now();
      sendToMay(cmd.message);
      break;
  }
});

// ── Send input to persistent May session ───────────────────────────────

let lastUserInput = Date.now();
let lastOptimizerRun = 0;
let optimizerRunning = false;

async function sendToMay(message: string): Promise<void> {
  try {
    await manager.send(sid, message);
    // If send() steered into a running session, wait for it to finish
    await manager.waitForIdle(sid);

    // Post-task evaluation: evaluate all unevaluated child sessions
    // Fire-and-forget — don't block the user prompt
    runPostTaskEvaluation();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    bus.emit({ type: "info", message: `Send error: ${msg}` });
  }
}

// ── Graceful shutdown ──────────────────────────────────────────────────

let shuttingDown = false;

function gracefulShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  bus.emit({ type: "info", message: "Shutting down..." });

  // Cancel non-persistent child sessions (coder, qa) but leave May's
  // persistent session intact for resume on next startup.
  for (const s of manager.status()) {
    if (s.status === "running" && s.sessionId !== sid) {
      manager.cancel(s.sessionId);
    }
  }

  // Give handleCompletion a moment to archive children, then exit
  setTimeout(() => process.exit(0), 2000);
}

process.on("SIGINT", () => {
  bus.emit({ type: "info", message: "[signal] SIGINT received" });
  gracefulShutdown();
});
process.on("SIGTERM", () => {
  bus.emit({ type: "info", message: "[signal] SIGTERM received" });
  gracefulShutdown();
});
process.on("SIGHUP", () => {
  bus.emit({ type: "info", message: "[signal] SIGHUP received (ignoring)" });
});

// ── Startup ────────────────────────────────────────────────────────────

let resumeError: string | null = null;
try {
  const resumed = manager.resumeAgent("may");
  // Resume existing persistent May session
  sid = resumed.resumed.sessionId;

  bus.emit({ type: "info", message: `Resumed session ${sid} (task: "${resumed.resumed.task.slice(0, 80)}")` });
  if (resumed.interrupted.length > 0) {
    bus.emit({ type: "info", message: `${resumed.interrupted.length} sub-agent session(s) marked as interrupted` });
  }

  // Wait for resume processing to complete (May goes idle)
  await manager.waitForIdle(sid);
} catch (err) {
  resumeError = err instanceof Error ? err.message : String(err);
}

if (resumeError) {
  // No session to resume — start fresh
  bus.emit({ type: "info", message: `[resume] ${resumeError}` });

  // Start new persistent May session
  const initialTask = process.argv.slice(2).join(" ") || "Ready. Waiting for tasks.";
  sid = manager.run("may", initialTask);
  bus.emit({ type: "info", message: `Started persistent May session: ${sid}` });

  // Wait for initial processing to complete (May goes idle)
  await manager.waitForIdle(sid);
}

// ── Idle timer for optimizer ────────────────────────────────────────────

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const OPTIMIZER_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes between optimizer runs
const IDLE_CHECK_INTERVAL_MS = 60 * 1000; // check every 60 seconds

const idleTimer = setInterval(() => {
  if (shuttingDown) return;
  if (optimizerRunning) return;

  const now = Date.now();
  const idleMs = now - lastUserInput;
  if (idleMs < IDLE_TIMEOUT_MS) return;

  // Enforce cooldown between optimizer runs
  if (now - lastOptimizerRun < OPTIMIZER_COOLDOWN_MS) return;

  // Check May is actually idle (not processing something)
  const sessions = manager.status();
  const maySessions = sessions.filter((s) => s.sessionId === sid);
  if (maySessions.length === 0 || maySessions[0].status !== "idle") return;

  // Don't run if there are active sub-agent sessions
  const activeSubs = sessions.filter((s) => s.sessionId !== sid && s.status === "running");
  if (activeSubs.length > 0) return;

  optimizerRunning = true;
  lastOptimizerRun = now;
  bus.emit({ type: "info", message: `[idle] ${Math.floor(idleMs / 1000)}s idle — triggering optimizer via May` });

  sendToMay(
    "No user tasks for 5 minutes. Run the optimizer to analyze recent sessions and improve agent performance. " +
    "Delegate to optimizer: analyze recent evaluation data in .state/evaluations/ and session transcripts in " +
    ".state/sessions/history/. Identify the highest-impact improvement, implement it, verify it, and commit."
  ).then(() => {
    optimizerRunning = false;
    lastUserInput = Date.now(); // reset so we don't immediately re-trigger
  }).catch(() => {
    optimizerRunning = false;
  });
}, IDLE_CHECK_INTERVAL_MS);

// ── Socket (always available) ──────────────────────────────────────────

const socketUI = attachSocketUI({
  socketPath: SOCKET_PATH,
  bus,
  manager,
  getSessionId: () => sid,
});

// ── Main loop ──────────────────────────────────────────────────────────

if (process.stdin.isTTY) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.on("SIGINT", () => { gracefulShutdown(); });

  const prompt = () => { process.stdout.write("\nyou> "); };
  prompt();

  for await (const line of rl) {
    const input = line.trim();
    if (input === "exit" || input === "quit") break;
    if (input === "close") {
      bus.emit({ type: "info", message: "Closing session (will not resume on restart)..." });
      manager.cancel(sid);
      break;
    }
    if (!input) { prompt(); continue; }

    lastUserInput = Date.now();
    await sendToMay(input);
    prompt();
  }

  clearInterval(idleTimer);
  socketUI.close();
  rl.close();
} else {
  // Daemon mode: no TTY, keep alive via socket + idle timer.
  // Process stays alive until SIGINT/SIGTERM triggers gracefulShutdown().
  bus.emit({ type: "info", message: "[daemon] Running in daemon mode (no TTY). Use socket for control." });
}
