import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { getModel } from "@mariozechner/pi-ai";
import {
  SubagentManager,
  createLinkedTools,
  createExecTool,
  createWorkflowTool,
  stripCliPromptContent,
} from "../src/index.js";
import { EventBus } from "./event-bus.js";
import { attachConsoleUI } from "./console-ui.js";
import { attachSocketUI } from "./socket-ui.js";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AGENTS_ROOT = resolve(PROJECT_ROOT, "agents");
const PERSIST_DIR = resolve(PROJECT_ROOT, process.env.STATE_DIR || ".state");
const SHARED_KNOWLEDGE = resolve(AGENTS_ROOT, "shared/system-design.md");
const SHARED_TEAM = resolve(AGENTS_ROOT, "shared/team.md");
const SHARED_PHILOSOPHY = resolve(AGENTS_ROOT, "shared/philosophy.md");

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

const gemini3pro = {
  ...getModel("openai", "gpt-4o"),
  api: "openai-completions" as const,
  id: "gemini-3-pro-preview",
  baseUrl: "http://localhost:4000",
};

// ── Infrastructure ─────────────────────────────────────────────────────

const bus = new EventBus();
attachConsoleUI(bus);

const manager = new SubagentManager({
  persistDir: PERSIST_DIR,
  onSessionStart: (agentName, sessionId) => {
    attachAgentEvents(agentName, sessionId);
    if (agentName === "optimizer") optimizerSid = sessionId;
    if (agentName === "bob") bobSid = sessionId;
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
  description: "Writes code, runs tests — does not commit",
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
let bobSid: string | undefined;

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

const bobTools = projectTools();
manager.register({
  name: "bob",
  description: "Design philosopher — learns human intent, reviews team work against philosophy, orchestrates meta-loop",
  domain: "design philosophy and meta-loop orchestration",
  systemPromptFiles: [
    SHARED_KNOWLEDGE,
    SHARED_TEAM,
    SHARED_PHILOSOPHY,
    resolve(AGENTS_ROOT, "bob/knowledge/domain.md"),
    resolve(AGENTS_ROOT, "shared/meta-loop.md"),
    resolve(AGENTS_ROOT, "bob/tools/INDEX.md"),
  ],
  knowledgeDir: resolve(AGENTS_ROOT, "bob/knowledge"),
  workspace: resolve(AGENTS_ROOT, "bob/workspace"),
  projectRoot: PROJECT_ROOT,
  model: gemini3pro,
  tools: [
    bobTools.read,
    bobTools.write,
    projectExec(),
    manager.createTool({
      getCallerSessionId: () => bobSid,
    }),
  ],
  apiKey: "not-needed",
  maxTurns: 50,
});

// Read-only exec for master — blocks direct file writes, forces use of claude-code/gemini-cli
function masterExec() {
  return createExecTool({
    cwd: PROJECT_ROOT,
    echoCwd: true,
    warnOutsideRoot: PROJECT_ROOT,
    maxOutputLength: 80_000, // CLI agents produce long output
    // Strip prompt content from CLI agent invocations before applying deny patterns.
    // Without this, a prompt like `claude -p "echo foo > bar"` would match the
    // echo/redirect deny pattern even though it's just text passed to a sub-agent.
    stripForDenyCheck: stripCliPromptContent,
    denyPatterns: [
      /^\s*find\s+\/\s/,
      /^\s*ls\s+\/\s*$/,
      /^\s*cd\s+\/(?!home\/hao\/may-agent)/,
      // Block direct file-writing commands — must use CLI agents
      /\bsed\s+-i\b/,
      /\bcat\s*>[^&]/,
      /<<\s*['"]?\w+['"]?/,
      /\btee\s/,
      /\b(echo|printf)\b.*>{1,2}[^&]/,
      /\bchmod\b|\bchown\b/,
      /\bpython3?\s+-c\b.*open\(/,
      /\bnode\s+-e\b/,
      /\bgit\s+(reset|checkout)\b/,
    ],
    denyMessage: "You cannot write files directly. Use claude-code or gemini-cli to implement changes.",
  });
}

const masterReadTools = projectTools();
manager.register({
  name: "master",
  description: "Senior engineer who leverages claude-code and gemini-cli for challenging tasks",
  domain: "complex implementation via external coding agents",
  systemPromptFiles: [
    resolve(AGENTS_ROOT, "master/knowledge/domain.md"),
    resolve(AGENTS_ROOT, "master/tools/INDEX.md"),
  ],
  knowledgeDir: resolve(AGENTS_ROOT, "master/knowledge"),
  workspace: resolve(AGENTS_ROOT, "master/workspace"),
  projectRoot: PROJECT_ROOT,
  model: opus,
  tools: [masterReadTools.read, masterExec()],
  apiKey: "not-needed",
  maxTurns: 30,
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
      sendToInterface(cmd.message);
      break;
    case "run": {
      bus.emit({ type: "info", message: `[socket] Run @${cmd.agent}: "${cmd.message.slice(0, 80)}"` });
      lastUserInput = Date.now();
      runDirect(cmd.agent, cmd.message);
      break;
    }
  }
});

// ── Send input to interface agent's persistent session ─────────────────

let lastUserInput = Date.now();

async function sendToInterface(message: string): Promise<void> {
  try {
    await manager.send(sid, message);
    // If send() steered into a running session, wait for it to finish
    await manager.waitForIdle(sid);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    bus.emit({ type: "info", message: `Send error: ${msg}` });
  }
}

/** Run a fresh ephemeral session on any agent directly (bypasses interface agent). */
async function runDirect(agentName: string, message: string): Promise<void> {
  try {
    const sessionId = manager.run(agentName, message);
    bus.emit({ type: "info", message: `[direct] Started ${agentName} session: ${sessionId}` });
    await manager.waitFor(sessionId);
    bus.emit({ type: "info", message: `[direct] ${agentName} session completed: ${sessionId}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    bus.emit({ type: "info", message: `[direct] Error: ${msg}` });
  }
}

// ── Graceful shutdown ──────────────────────────────────────────────────

let shuttingDown = false;

function gracefulShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const stack = new Error("gracefulShutdown trace").stack;
  bus.emit({ type: "info", message: `Shutting down...\n${stack}` });

  // Cancel non-persistent child sessions but leave the interface agent's
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
process.on("uncaughtException", (err) => {
  bus.emit({ type: "info", message: `[fatal] Uncaught exception: ${err.message}\n${err.stack}` });
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  bus.emit({ type: "info", message: `[fatal] Unhandled rejection: ${reason}` });
});
process.on("exit", (code) => {
  // This fires synchronously just before the process exits
  console.error(`[exit] Process exiting with code ${code}`);
});

// ── Interface agent selection ──────────────────────────────────────────

const interfaceAgent = process.env.AGENT || "may";

// Verify the interface agent is registered
if (!manager.hasAgent(interfaceAgent)) {
  console.error(`Agent "${interfaceAgent}" is not registered. Available: ${manager.agentNames().join(", ")}`);
  process.exit(1);
}

// Runtime options for the interface agent's persistent session
const interfaceRunOpts = {
  persistent: true,
  compaction: {
    threshold: 0.7,
    keepRatio: 0.4,
    onCompact: (info: { messagesCompacted: number; tokensBefore: number; tokensAfter: number }) => {
      bus.emit({ type: "info", message: `Compaction: ${info.messagesCompacted} messages compacted (${info.tokensBefore} → ${info.tokensAfter} est. tokens)` });
    },
  },
};

// ── Socket (always available — created BEFORE startup so it's reachable during resume) ──

const SOCKET_PATH = resolve(PERSIST_DIR, `${interfaceAgent}.sock`);

const socketUI = attachSocketUI({
  socketPath: SOCKET_PATH,
  bus,
  manager,
  getSessionId: () => sid,
});

// ── Startup ────────────────────────────────────────────────────────────

let resumeError: string | null = null;
try {
  const resumed = manager.resumeAgent(interfaceAgent, interfaceRunOpts);
  sid = resumed.resumed.sessionId;

  bus.emit({ type: "info", message: `Resumed ${interfaceAgent} session ${sid} (task: "${resumed.resumed.task.slice(0, 80)}")` });
  if (resumed.interrupted.length > 0) {
    bus.emit({ type: "info", message: `${resumed.interrupted.length} sub-agent session(s) marked as interrupted` });
  }

  // Wait for resume processing to complete (agent goes idle)
  await manager.waitForIdle(sid);
} catch (err) {
  resumeError = err instanceof Error ? err.message : String(err);
}

if (resumeError) {
  // No session to resume — start fresh
  bus.emit({ type: "info", message: `[resume] ${resumeError}` });

  const initialTask = "Ready. Waiting for tasks.";
  sid = manager.run(interfaceAgent, initialTask, interfaceRunOpts);
  bus.emit({ type: "info", message: `Started persistent ${interfaceAgent} session: ${sid}` });

  // Wait for initial processing to complete (agent goes idle)
  await manager.waitForIdle(sid);
}

// ── Main loop ──────────────────────────────────────────────────────────

/** Parse @agent prefix from input. Returns [agentName, message] or [null, original]. */
function parseAgentPrefix(input: string): [string | null, string] {
  const match = input.match(/^@(\w+)\s+([\s\S]+)/);
  if (match) return [match[1], match[2]];
  return [null, input];
}

if (process.stdin.isTTY) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.on("SIGINT", () => { gracefulShutdown(); });

  const prompt = () => { process.stdout.write(`\nyou> `); };
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

    const [targetAgent, message] = parseAgentPrefix(input);
    if (targetAgent) {
      // Direct agent invocation: @agent message
      await runDirect(targetAgent, message);
    } else {
      // Default: send to interface agent
      await sendToInterface(input);
    }

    prompt();
  }

  socketUI.close();
  rl.close();
} else {
  // Daemon mode: no TTY, keep alive via socket.
  // The socket server normally keeps the event loop alive, but stdin EOF
  // in nohup/background mode can trigger a Node.js shutdown. Use a
  // periodic keepalive to ensure the process stays alive.
  bus.emit({ type: "info", message: `[daemon] Running in daemon mode (no TTY). Interface agent: ${interfaceAgent}. Use socket for control.` });
  setInterval(() => {}, 60_000); // keepalive
}
