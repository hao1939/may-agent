import { createInterface } from "node:readline";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { getModel } from "@mariozechner/pi-ai";
import {
  SubagentManager,
  createReadTool,
  createWriteTool,
  createExecTool,
  createWorkflowTool,
  createValidateWorkflowTool,
  createLearnTool,
  evaluateSession,
  maintainAgent,
} from "../src/index.js";
import type { WorkflowEvent } from "../src/workflow.js";
import { EventBus } from "./event-bus.js";
import { attachConsoleUI } from "./console-ui.js";
import { attachSocketUI } from "./socket-ui.js";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AGENTS_ROOT = resolve(PROJECT_ROOT, "agents");

function agentDir(name: string): string {
  return resolve(AGENTS_ROOT, name);
}

function knowledgeDir(name: string): string {
  return resolve(agentDir(name), "knowledge");
}

// Models
const opus = {
  ...getModel("anthropic", "claude-sonnet-4-20250514"),
  id: "claude-opus-4.6",
  baseUrl: "http://localhost:4000",
};

const gpt52 = {
  ...getModel("azure-openai-responses", "gpt-5.2"),
  baseUrl: "http://localhost:4000/v1",
};

const gemini = {
  ...getModel("azure-openai-responses", "gpt-5.2"),
  id: "gemini-3-pro-preview",
  name: "Gemini 3 Pro",
  baseUrl: "http://localhost:4000/v1",
  contextWindow: 1_000_000,
  maxTokens: 64_000,
};

const PERSIST_DIR = resolve(PROJECT_ROOT, ".state");
const SOCKET_PATH = resolve(PERSIST_DIR, "may.sock");

// ── Event bus ──────────────────────────────────────────────────────────

const bus = new EventBus();

// Exec tool with echoCwd
function guardedExec() {
  return createExecTool({ cwd: PROJECT_ROOT, echoCwd: true, warnOutsideRoot: PROJECT_ROOT });
}

// Read tool with projectRoot hint
function projectRead() {
  return createReadTool({ projectRoot: PROJECT_ROOT });
}

const manager = new SubagentManager({
  persistDir: PERSIST_DIR,
});

// ── Track which workflow was used ──────────────────────────────────────

let lastWorkflowUsed: string | null = null;

// ── Workflow event handler factory ─────────────────────────────────────

function workflowEventHandler(label: string) {
  return (event: WorkflowEvent) => {
    if (label === "may" && event.type === "workflow_start") {
      lastWorkflowUsed = event.workflow;
    }
    if (event.type === "step_start" && event.sessionId) {
      attachAgentEvents(event.step, event.sessionId);
    }

    switch (event.type) {
      case "workflow_start":
        bus.emit({ type: "workflow", agent: label, workflow: event.workflow, event: "start", task: event.task.slice(0, 200) });
        break;
      case "step_start":
        bus.emit({ type: "workflow", agent: label, workflow: "", event: "step_start", step: event.step, sessionId: event.sessionId });
        break;
      case "step_done":
        bus.emit({ type: "workflow", agent: label, workflow: "", event: "step_done", step: event.step, status: event.result?.status, duration: event.result?.duration });
        break;
      case "workflow_done":
        bus.emit({ type: "workflow", agent: label, workflow: "", event: "done" });
        break;
      case "workflow_escalate":
        bus.emit({ type: "workflow", agent: label, workflow: "", event: "escalated", reason: event.reason });
        break;
    }
  };
}

// ── Workflow tools ─────────────────────────────────────────────────────

const mayWorkflowTool = createWorkflowTool({
  manager,
  workflowDir: resolve(agentDir("may"), "workflows"),
  persistDir: PERSIST_DIR,
  onEvent: workflowEventHandler("may"),
});

const optimizerWorkflowTool = createWorkflowTool({
  manager,
  workflowDir: resolve(agentDir("optimizer"), "workflows"),
  persistDir: PERSIST_DIR,
  onEvent: workflowEventHandler("optimizer"),
});

// ── Register agents ────────────────────────────────────────────────────

manager.register({
  name: "coder",
  description: "Focused implementation agent — writes code, tests, commits",
  domain: "may-agent implementation",
  systemPromptFiles: [
    resolve(knowledgeDir("coder"), "domain.md"),
    resolve(knowledgeDir("coder"), "codebase.md"),
    resolve(agentDir("coder"), "tools/INDEX.md"),
  ],
  knowledgeDir: knowledgeDir("coder"),
  workspace: resolve(agentDir("coder"), "workspace"),
  projectRoot: PROJECT_ROOT,
  model: opus,
  tools: [projectRead(), createWriteTool(), guardedExec(), createLearnTool(knowledgeDir("coder"))],
  apiKey: "not-needed",
  maxTurns: 30,
});

manager.register({
  name: "reviewer",
  description: "Independent code/design reviewer on GPT-5.2 — different perspective",
  domain: "code review and design evaluation",
  systemPromptFiles: [
    resolve(knowledgeDir("reviewer"), "domain.md"),
    resolve(agentDir("reviewer"), "tools/INDEX.md"),
  ],
  knowledgeDir: knowledgeDir("reviewer"),
  workspace: resolve(agentDir("reviewer"), "workspace"),
  projectRoot: PROJECT_ROOT,
  model: gpt52,
  tools: [projectRead(), guardedExec(), createLearnTool(knowledgeDir("reviewer"))],
  apiKey: "not-needed",
  maxTurns: 30,
});

manager.register({
  name: "evaluator",
  description: "Session evaluator — scores efficiency/quality, detects patterns",
  domain: "session evaluation and workflow generation",
  systemPromptFiles: [resolve(knowledgeDir("evaluator"), "domain.md")],
  knowledgeDir: knowledgeDir("evaluator"),
  workspace: resolve(agentDir("evaluator"), "workspace"),
  projectRoot: PROJECT_ROOT,
  model: gpt52,
  tools: [projectRead(), createWriteTool(), createValidateWorkflowTool(), guardedExec(), createLearnTool(knowledgeDir("evaluator"))],
  apiKey: "not-needed",
  maxTurns: 30,
});

manager.register({
  name: "optimizer",
  description: "Performance optimizer — drives full improvement loop",
  domain: "agent performance optimization",
  systemPromptFiles: [
    resolve(knowledgeDir("optimizer"), "domain.md"),
    resolve(knowledgeDir("optimizer"), "codebase.md"),
    resolve(agentDir("optimizer"), "tools/INDEX.md"),
  ],
  knowledgeDir: knowledgeDir("optimizer"),
  workspace: resolve(agentDir("optimizer"), "workspace"),
  projectRoot: PROJECT_ROOT,
  model: gemini,
  tools: [projectRead(), createWriteTool(), guardedExec(), createLearnTool(knowledgeDir("optimizer")), manager.createTool(), optimizerWorkflowTool],
  apiKey: "not-needed",
  maxTurns: 30,
});

manager.register({
  name: "may",
  description: "Supervisor agent — plans, delegates, reviews",
  domain: "may-agent architecture and coordination",
  systemPromptFiles: [
    resolve(knowledgeDir("may"), "domain.md"),
    resolve(agentDir("may"), "tools/INDEX.md"),
  ],
  knowledgeDir: knowledgeDir("may"),
  workspace: resolve(agentDir("may"), "workspace"),
  projectRoot: PROJECT_ROOT,
  model: opus,
  tools: [projectRead(), createWriteTool(), guardedExec(), createValidateWorkflowTool(), createLearnTool(knowledgeDir("may")), manager.createTool(), mayWorkflowTool],
  apiKey: "not-needed",
  maxTurns: 40,
  compaction: {
    threshold: 0.7,
    keepRatio: 0.4,
    onCompact: (info) => {
      bus.emit({ type: "info", message: `Compaction round ${info.compactionCount}: ${info.messagesCompacted} messages compacted, ${info.messagesKept} kept (${info.tokensBefore} → ${info.tokensAfter} est. tokens)` });
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

// ── Attach UIs ─────────────────────────────────────────────────────────

attachConsoleUI(bus);

// ── Evaluation ─────────────────────────────────────────────────────────

const AUTO_EVALUATE = process.env.MAY_EVALUATE !== "0";
const IDLE_TIMEOUT_MS = parseInt(process.env.MAY_IDLE_TIMEOUT ?? "60000", 10);
const MAINTENANCE_INTERVAL = 3;
let evalsSinceMaintenance = 0;

async function runEvaluation(sessionId: string): Promise<string | null> {
  if (!AUTO_EVALUATE) return null;
  bus.emit({ type: "info", message: "Evaluating session..." });
  try {
    const result = await evaluateSession({
      manager,
      sessionId,
      agentName: "may",
      workflowUsed: lastWorkflowUsed,
      persistDir: PERSIST_DIR,
      knowledgeDir: knowledgeDir("may"),
      workflowDir: resolve(agentDir("may"), "workflows"),
    });

    bus.emit({
      type: "eval",
      verdict: result.scores.verdict,
      efficiency: result.scores.efficiency,
      quality: result.scores.quality,
      tokens: result.usage.totalTokens,
      cost: result.usage.cost,
      turns: result.usage.turns,
      failureChains: result.failureChains.length,
      wastedCalls: result.failureChains.reduce((s, c) => s + c.wastedCalls, 0),
    });

    if (result.lessons) {
      bus.emit({ type: "info", message: "Lessons appended to knowledge/lessons.md" });
    }

    // Anomaly detection
    const anomalies: string[] = [];
    const { efficiency, quality } = result.scores;
    if (efficiency === 0 && quality === 0) {
      anomalies.push(`Evaluator returned 0/0 scores — likely a parsing bug.`);
    }
    if (result.failureChains.length > 0) {
      const totalWasted = result.failureChains.reduce((s, c) => s + c.wastedCalls, 0);
      anomalies.push(`${result.failureChains.length} failure chain(s), ${totalWasted} wasted calls. Root causes: ${result.failureChains.map((c) => c.rootCause.slice(0, 100)).join("; ")}`);
    }

    // Periodic maintenance
    evalsSinceMaintenance++;
    if (evalsSinceMaintenance >= MAINTENANCE_INTERVAL) {
      for (const name of ["may", "coder", "reviewer", "optimizer", "evaluator"]) {
        bus.emit({ type: "info", message: `Consolidating lessons for ${name}...` });
        try {
          const mResult = await maintainAgent({ manager, agentName: name, knowledgeDir: knowledgeDir(name), persistDir: PERSIST_DIR });
          if (mResult.lessonsPruned > 0) bus.emit({ type: "info", message: `[maintenance:${name}] pruned ${mResult.lessonsPruned} lessons` });
          if (mResult.suggestions.length > 0) bus.emit({ type: "info", message: `[maintenance:${name}] ${mResult.suggestions.join("; ")}` });
        } catch (err) {
          bus.emit({ type: "info", message: `[maintenance:${name}] failed: ${err instanceof Error ? err.message : String(err)}` });
        }
      }
      evalsSinceMaintenance = 0;
    }

    return anomalies.length > 0 ? `[Post-session evaluation]\n${anomalies.join("\n")}` : null;
  } catch (err) {
    bus.emit({ type: "info", message: `Evaluation failed: ${err instanceof Error ? err.message : String(err)}` });
    return null;
  }
}

// ── Session management ─────────────────────────────────────────────────

let sid: string;
let currentTask: string = "";

function startSession(task: string): string {
  lastWorkflowUsed = null;
  currentTask = task;
  const sessionId = manager.run("may", task);
  attachAgentEvents("may", sessionId);
  return sessionId;
}

async function waitAndCheck(sessionId: string): Promise<void> {
  const result = await manager.waitFor(sessionId);

  if (result?.status === "error" && result.error) {
    const isOverflow = result.error.includes("context")
      || result.error.includes("token")
      || result.error.includes("too long")
      || result.error.includes("maximum");

    if (isOverflow) {
      bus.emit({ type: "info", message: "Context overflow detected. Starting fresh session with summary..." });

      const lastProgress = result.lastAssistantText?.slice(0, 2000) ?? "";
      const summary = [
        `Your previous session hit the context limit. Here's what you need to know:`,
        ``, `## Original Task`, currentTask.slice(0, 500),
        ``, `## Last Progress`, lastProgress || "(no progress captured)",
        ``, `## Instructions`,
        `Continue from where you left off. Your project root and workspace paths are in your system prompt.`,
        `Do NOT search for or guess the project location — use the paths from Runtime Environment above.`,
      ].join("\n");

      sid = startSession(summary);
      await waitAndCheck(sid);
      return;
    }
  }

  const anomaly = await runEvaluation(sessionId);
  if (anomaly) {
    bus.emit({ type: "info", message: "Surfacing evaluation anomaly to May" });
    manager.send(sid, anomaly);
    await manager.waitFor(sid);
  }
}

// ── Meta work detection ────────────────────────────────────────────────

function hasMetaWork(): string | null {
  const proposalDir = resolve(PERSIST_DIR, "proposals", "optimizer");
  try {
    const proposals = readdirSync(proposalDir).filter((f) => f.endsWith(".md"));
    if (proposals.length > 0) {
      return `Meta work available: there are ${proposals.length} staged proposal(s) awaiting the optimizer. ` +
        `Delegate to optimizer to run its improvement loop. ` +
        `Use: subagents.run("optimizer", "Run your improvement loop. You have ${proposals.length} pending proposal(s).")`;
    }
  } catch { /* dir doesn't exist */ }

  const evalDir = resolve(PERSIST_DIR, "evaluations");
  try {
    const evalFiles = readdirSync(evalDir).filter((f) => f.endsWith(".json")).sort();
    if (evalFiles.length >= 3) {
      const recent = evalFiles.slice(-3);
      let totalEff = 0;
      let count = 0;
      for (const f of recent) {
        try {
          const data = JSON.parse(readFileSync(resolve(evalDir, f), "utf-8"));
          if (typeof data.efficiency === "number") { totalEff += data.efficiency; count++; }
        } catch { /* skip bad files */ }
      }
      if (count > 0 && totalEff / count < 0.7) {
        const avg = (totalEff / count).toFixed(2);
        return `Meta work available: recent evaluations show declining efficiency (avg ${avg}). ` +
          `Delegate to optimizer to run its improvement loop. ` +
          `Use: subagents.run("optimizer", "Run your improvement loop. Recent efficiency is ${avg}.")`;
      }
    }
  } catch { /* dir doesn't exist */ }

  return null;
}

// ── Input handling ─────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, output: process.stdout });
let closed = false;
rl.on("close", () => { closed = true; });

const inputQueue: string[] = [];
let inputWaiter: ((line: string) => void) | null = null;

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (inputWaiter) {
    const waiter = inputWaiter;
    inputWaiter = null;
    waiter(trimmed);
  } else {
    inputQueue.push(trimmed);
  }
});

function waitForInput(): Promise<string> {
  if (inputQueue.length > 0) return Promise.resolve(inputQueue.shift()!);
  return new Promise((resolve) => { inputWaiter = resolve; });
}

function waitForInputOrIdle(timeoutMs: number): Promise<{ type: "input"; value: string } | { type: "idle" }> {
  if (closed) return Promise.resolve({ type: "input", value: "" });
  if (inputQueue.length > 0) return Promise.resolve({ type: "input", value: inputQueue.shift()! });

  return new Promise((resolve) => {
    let resolved = false;

    const timer = timeoutMs > 0 ? setTimeout(() => {
      if (!resolved) {
        resolved = true;
        inputWaiter = null;
        resolve({ type: "idle" });
      }
    }, timeoutMs) : null;

    inputWaiter = (line) => {
      if (timer) clearTimeout(timer);
      if (!resolved) {
        resolved = true;
        resolve({ type: "input", value: line });
      }
    };
  });
}

// ── Command handling (from socket) ─────────────────────────────────────

bus.onCommand((cmd) => {
  switch (cmd.type) {
    case "steer":
      bus.emit({ type: "info", message: `[control] Steering May: "${cmd.message.slice(0, 80)}"` });
      manager.send(sid, cmd.message);
      break;
    case "cancel":
      bus.emit({ type: "info", message: `[control] Cancelling session: ${cmd.sessionId}` });
      manager.cancel(cmd.sessionId);
      break;
    case "cancel_all":
      bus.emit({ type: "info", message: "[control] Cancelling all sessions" });
      for (const s of manager.status()) {
        if (s.status === "running") manager.cancel(s.sessionId);
      }
      break;
    case "input":
      // Treat as if typed on stdin
      inputQueue.push(cmd.message);
      if (inputWaiter) {
        const waiter = inputWaiter;
        inputWaiter = null;
        waiter(inputQueue.shift()!);
      }
      break;
  }
});

// ── Startup ────────────────────────────────────────────────────────────

const resumeResult = manager.resumeAgent("may");

if (resumeResult?.resumed) {
  sid = resumeResult.resumed.sessionId;
  currentTask = resumeResult.resumed.task;
  bus.emit({ type: "info", message: `Resumed May's session: ${sid}` });
  bus.emit({ type: "info", message: `Task: "${currentTask.slice(0, 80)}"` });
  if (resumeResult.interrupted.length > 0) {
    bus.emit({ type: "info", message: `Cleaned up ${resumeResult.interrupted.length} stale sub-agent session(s)` });
  }
  attachAgentEvents("may", sid);
} else {
  const stale = manager.cleanupStaleSessions();
  if (stale.length > 0) {
    bus.emit({ type: "info", message: `Cleaned up ${stale.length} stale session(s) from previous run` });
  }

  let firstMessage = process.argv.slice(2).join(" ");
  if (!firstMessage) {
    process.stdout.write("\nyou> ");
    const input = await waitForInput();
    if (!input) { rl.close(); process.exit(0); }
    firstMessage = input;
  }

  sid = startSession(firstMessage);
}

// Start socket UI after sid is set
const socketUI = attachSocketUI({
  socketPath: SOCKET_PATH,
  bus,
  manager,
  getSessionId: () => sid,
});

// Wait for initial session
await waitAndCheck(sid);

// ── Main loop ──────────────────────────────────────────────────────────

let metaSessionId: string | null = null;

while (!closed) {
  process.stdout.write("\nyou> ");
  const response = await waitForInputOrIdle(IDLE_TIMEOUT_MS);

  if (response.type === "idle") {
    const metaTask = hasMetaWork();
    if (metaTask) {
      bus.emit({ type: "info", message: "Found meta work. Starting optimization cycle... (type anything to interrupt)" });
      metaSessionId = startSession(metaTask);

      const metaPromise = manager.waitFor(metaSessionId);
      const userPromise = waitForInput();

      const winner = await Promise.race([
        metaPromise.then(() => ({ type: "meta-done" as const })),
        userPromise.then((v) => ({ type: "user-input" as const, value: v })),
      ]);

      if (winner.type === "user-input") {
        if (winner.value && winner.value !== "exit" && winner.value !== "quit") {
          bus.emit({ type: "info", message: "User input received. Cancelling meta work..." });
          manager.cancel(metaSessionId);
          metaSessionId = null;
          sid = startSession(winner.value);
          await waitAndCheck(sid);
        } else {
          manager.cancel(metaSessionId);
          break;
        }
      } else {
        userPromise.then((v) => { inputQueue.push(v); });
        bus.emit({ type: "info", message: "Meta work completed." });
        await runEvaluation(metaSessionId);
        metaSessionId = null;
      }
      continue;
    }
    continue;
  }

  const input = response.value;
  if (!input || input === "exit" || input === "quit") break;

  if (mayWorkflowTool.isRunning) {
    const steered = mayWorkflowTool.steer(input);
    if (steered) {
      bus.emit({ type: "info", message: `Steering signal queued for workflow "${mayWorkflowTool.activeWorkflow}"` });
      continue;
    }
  }

  lastWorkflowUsed = null;
  manager.send(sid, input);
  await waitAndCheck(sid);
}

socketUI.close();
rl.close();
