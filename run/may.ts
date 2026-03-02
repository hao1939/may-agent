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
  ...getModel("azure-openai-responses", "gpt-5.2"), // base config for litellm compatibility
  id: "gemini-3-pro-preview",
  name: "Gemini 3 Pro",
  baseUrl: "http://localhost:4000/v1",
  contextWindow: 1_000_000,
  maxTokens: 64_000,
};

const PERSIST_DIR = resolve(PROJECT_ROOT, ".state");

// Exec tool with echoCwd — shows working directory on first call to orient the agent
function guardedExec() {
  return createExecTool({ cwd: PROJECT_ROOT, echoCwd: true, warnOutsideRoot: PROJECT_ROOT });
}

// Read tool with projectRoot hint — ENOENT errors tell the agent where files actually are
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
    switch (event.type) {
      case "workflow_start":
        console.log(`\n[${label}:workflow] ${event.workflow}: ${event.task.slice(0, 100)}`);
        if (label === "may") lastWorkflowUsed = event.workflow;
        break;
      case "step_start":
        console.log(`[${label}:step] ${event.step} started${event.sessionId ? ` (${event.sessionId})` : ""}`);
        if (event.sessionId) {
          attachSubagentEvents(event.step, event.sessionId);
        }
        break;
      case "step_done":
        console.log(`[${label}:step] ${event.step} ${event.result?.status ?? "done"} (${event.result?.duration ?? "?"})`);
        break;
      case "workflow_done":
        console.log(`[${label}:workflow] done`);
        break;
      case "workflow_escalate":
        console.log(`[${label}:workflow] escalated: ${event.reason}`);
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

// ── Register coder ─────────────────────────────────────────────────────

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
  tools: [
    projectRead(),
    createWriteTool(),
    guardedExec(),
    createLearnTool(knowledgeDir("coder")),
  ],
  apiKey: "not-needed",
  maxTurns: 30,
});

// ── Register reviewer ──────────────────────────────────────────────────

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
  tools: [
    projectRead(),
    guardedExec(),
    createLearnTool(knowledgeDir("reviewer")),
  ],
  apiKey: "not-needed",
  maxTurns: 30,
});

// ── Register evaluator ─────────────────────────────────────────────────

manager.register({
  name: "evaluator",
  description: "Session evaluator — scores efficiency/quality, detects patterns, suggests workflows",
  domain: "session evaluation and workflow generation",
  systemPromptFiles: [
    resolve(knowledgeDir("evaluator"), "domain.md"),
  ],
  knowledgeDir: knowledgeDir("evaluator"),
  workspace: resolve(agentDir("evaluator"), "workspace"),
  projectRoot: PROJECT_ROOT,
  model: gpt52,
  tools: [
    projectRead(),
    createWriteTool(),
    createValidateWorkflowTool(),
    guardedExec(),
    createLearnTool(knowledgeDir("evaluator")),
  ],
  apiKey: "not-needed",
  maxTurns: 30,
});

// ── Register optimizer ─────────────────────────────────────────────────

manager.register({
  name: "optimizer",
  description: "Performance optimizer — drives full improvement loop: analyze, propose, implement, verify",
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
  tools: [
    projectRead(),
    createWriteTool(),
    guardedExec(),
    createLearnTool(knowledgeDir("optimizer")),
    manager.createTool(),
    optimizerWorkflowTool,
  ],
  apiKey: "not-needed",
  maxTurns: 30,
});

// ── Register may supervisor ────────────────────────────────────────────

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
  tools: [
    projectRead(),
    createWriteTool(),
    guardedExec(),
    createValidateWorkflowTool(),
    createLearnTool(knowledgeDir("may")),
    manager.createTool(),
    mayWorkflowTool,
  ],
  apiKey: "not-needed",
  maxTurns: 40,
  compaction: {
    threshold: 0.7,
    keepRatio: 0.4,
    onCompact: (info) => {
      console.log(`\n[compaction] Round ${info.compactionCount}: ${info.messagesCompacted} messages compacted, ${info.messagesKept} kept (${info.tokensBefore} → ${info.tokensAfter} est. tokens)`);
    },
  },
});

// ── Event streaming ────────────────────────────────────────────────────

function attachSubagentEvents(label: string, sid: string): void {
  manager.subscribe(sid, (event) => {
    switch (event.type) {
      case "message_start":
        if (event.message.role === "assistant") {
          process.stdout.write(`\n  [${label}] `);
        }
        break;
      case "message_update":
        if (event.assistantMessageEvent.type === "text_delta") {
          process.stdout.write(event.assistantMessageEvent.delta);
        }
        break;
      case "message_end":
        if (event.message.role === "assistant") {
          process.stdout.write("\n");
        }
        break;
      case "tool_execution_start":
        console.log(`  [${label}:${event.toolName}] ${JSON.stringify(event.args).slice(0, 200)}`);
        break;
      case "tool_execution_end": {
        if (event.isError) {
          console.log(`  [${label}:${event.toolName}] ERROR`);
        } else {
          const text = event.result?.content?.[0]?.text ?? "";
          const preview = text.slice(0, 200);
          console.log(`  [${label}:${event.toolName}] ${preview}${text.length > 200 ? "..." : ""}`);
        }
        break;
      }
    }
  });
}

function attachEvents(sid: string): void {
  manager.subscribe(sid, (event) => {
    switch (event.type) {
      case "message_start":
        if (event.message.role === "assistant") {
          process.stdout.write("\n[may] ");
        }
        break;
      case "message_update":
        if (event.assistantMessageEvent.type === "text_delta") {
          process.stdout.write(event.assistantMessageEvent.delta);
        }
        break;
      case "message_end":
        if (event.message.role === "assistant") {
          process.stdout.write("\n");
        }
        break;
      case "tool_execution_start":
        console.log(`\n[tool:${event.toolName}] ${JSON.stringify(event.args).slice(0, 200)}`);
        break;
      case "tool_execution_end": {
        if (event.isError) {
          console.log(`[tool:${event.toolName}] ERROR`);
        } else {
          const text = event.result?.content?.[0]?.text ?? "";
          const preview = text.slice(0, 200);
          console.log(`[tool:${event.toolName}] ${preview}${text.length > 200 ? "..." : ""}`);
        }
        break;
      }
    }
  });
}

// ── Interactive loop ───────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, output: process.stdout });
let closed = false;
rl.on("close", () => { closed = true; });

const AUTO_EVALUATE = process.env.MAY_EVALUATE !== "0";
const IDLE_TIMEOUT_MS = parseInt(process.env.MAY_IDLE_TIMEOUT ?? "60000", 10); // default 60s
const MAINTENANCE_INTERVAL = 3; // run maintenance every N evaluations
let evalsSinceMaintenance = 0;

async function runEvaluation(sessionId: string): Promise<string | null> {
  if (!AUTO_EVALUATE) return null;
  console.log("\n[eval] Evaluating session...");
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
    console.log(`[eval] verdict: ${result.scores.verdict} (efficiency: ${result.scores.efficiency}, quality: ${result.scores.quality})`);
    if (result.usage.totalTokens > 0) {
      console.log(`[eval] usage: ${result.usage.totalTokens} tokens, $${result.usage.cost.toFixed(4)}, ${result.usage.turns} turns`);
    }
    if (result.failureChains.length > 0) {
      console.log(`[eval] failure chains: ${result.failureChains.length} detected (${result.failureChains.reduce((s, c) => s + c.wastedCalls, 0)} wasted calls)`);
      for (const chain of result.failureChains) {
        console.log(`[eval]   root cause: ${chain.rootCause}`);
      }
    }
    if (result.scores.pattern_detected) {
      console.log(`[eval] pattern detected: ${result.scores.pattern_name}`);
    }
    if (result.lessons) {
      console.log(`[eval] lessons appended to knowledge/lessons.md`);
    }
    if (result.workflowCode) {
      console.log(`[eval] workflow suggested: ${result.workflowName}`);
    }

    // Detect anomalies worth surfacing to May
    const anomalies: string[] = [];
    const { efficiency, quality } = result.scores;
    if (efficiency === 0 && quality === 0) {
      anomalies.push(`Evaluator returned 0/0 scores — likely a parsing bug. Check evaluator session output.`);
    }
    if (result.failureChains.length > 0) {
      const totalWasted = result.failureChains.reduce((s, c) => s + c.wastedCalls, 0);
      anomalies.push(`${result.failureChains.length} failure chain(s), ${totalWasted} wasted calls. Root causes: ${result.failureChains.map((c) => c.rootCause.slice(0, 100)).join("; ")}`);
    }

    // Periodic maintenance — run for all agents
    evalsSinceMaintenance++;
    if (evalsSinceMaintenance >= MAINTENANCE_INTERVAL) {
      const agentNames = ["may", "coder", "reviewer", "optimizer", "evaluator"];
      for (const name of agentNames) {
        console.log(`\n[maintenance] Consolidating lessons for ${name}...`);
        try {
          const mResult = await maintainAgent({
            manager,
            agentName: name,
            knowledgeDir: knowledgeDir(name),
            persistDir: PERSIST_DIR,
          });
          if (mResult.lessonsPruned > 0) {
            console.log(`[maintenance:${name}] pruned ${mResult.lessonsPruned} lessons`);
          }
          if (mResult.suggestions.length > 0) {
            console.log(`[maintenance:${name}] suggestions for domain.md:`);
            for (const s of mResult.suggestions) {
              console.log(`  - ${s}`);
            }
          }
          if (mResult.staleItems.length > 0) {
            console.log(`[maintenance:${name}] stale: ${mResult.staleItems.join(", ")}`);
          }
        } catch (err) {
          console.log(`[maintenance:${name}] failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      evalsSinceMaintenance = 0;
    }

    return anomalies.length > 0
      ? `[Post-session evaluation]\n${anomalies.join("\n")}`
      : null;
  } catch (err) {
    console.log(`[eval] evaluation failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ── Startup: resume May or start fresh ─────────────────────────────────

// ── Session management with compaction ─────────────────────────────────

let sid: string;
let currentTask: string = "";

function startSession(task: string): string {
  lastWorkflowUsed = null;
  currentTask = task;
  const sessionId = manager.run("may", task);
  attachEvents(sessionId);
  return sessionId;
}

async function waitAndCheck(sessionId: string): Promise<void> {
  const result = await manager.waitFor(sessionId);

  // Check if session ended with an error (possible context overflow)
  if (result?.status === "error" && result.error) {
    const isOverflow = result.error.includes("context")
      || result.error.includes("token")
      || result.error.includes("too long")
      || result.error.includes("maximum");

    if (isOverflow) {
      console.log("\n[runner] Context overflow detected. Starting fresh session with summary...");

      // Build summary that preserves critical context
      const lastProgress = result.lastAssistantText?.slice(0, 2000) ?? "";
      const summary = [
        `Your previous session hit the context limit. Here's what you need to know:`,
        ``,
        `## Original Task`,
        currentTask.slice(0, 500),
        ``,
        `## Last Progress`,
        lastProgress || "(no progress captured)",
        ``,
        `## Instructions`,
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
    console.log(`\n[runner] Surfacing evaluation anomaly to May`);
    manager.send(sid, anomaly);
    await manager.waitFor(sid);
  }
}

// ── Meta work detection ────────────────────────────────────────────────

function hasMetaWork(): string | null {
  // Check for unimplemented proposals in optimizer's state directory
  const proposalDir = resolve(PERSIST_DIR, "proposals", "optimizer");
  try {
    const proposals = readdirSync(proposalDir).filter((f) => f.endsWith(".md"));
    if (proposals.length > 0) {
      return `Meta work available: there are ${proposals.length} staged proposal(s) awaiting the optimizer. ` +
        `Delegate to optimizer to run its improvement loop. ` +
        `Use: subagents.run("optimizer", "Run your improvement loop. You have ${proposals.length} pending proposal(s).")`;
    }
  } catch { /* dir doesn't exist */ }

  // Check for recent evaluations with poor scores
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
          if (typeof data.efficiency === "number") {
            totalEff += data.efficiency;
            count++;
          }
        } catch { /* skip bad files */ }
      }
      if (count > 0 && totalEff / count < 0.7) {
        const avg = (totalEff / count).toFixed(2);
        return `Meta work available: recent evaluations show declining efficiency (avg ${avg}). ` +
          `Delegate to optimizer to run its improvement loop — it will analyze evaluations, identify the top problem, and drive a fix. ` +
          `Use: subagents.run("optimizer", "Run your improvement loop. Recent efficiency is ${avg}.")`;
      }
    }
  } catch { /* dir doesn't exist */ }

  return null;
}

// ── Input handling ─────────────────────────────────────────────────────

// Single input queue — readline pushes lines, consumers pull them
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

/** Wait for the next user input line. */
function waitForInput(): Promise<string> {
  if (inputQueue.length > 0) return Promise.resolve(inputQueue.shift()!);
  return new Promise((resolve) => { inputWaiter = resolve; });
}

/** Wait for input OR idle timeout — whichever comes first. */
function waitForInputOrIdle(timeoutMs: number): Promise<{ type: "input"; value: string } | { type: "idle" }> {
  if (closed) return Promise.resolve({ type: "input", value: "" });
  if (inputQueue.length > 0) return Promise.resolve({ type: "input", value: inputQueue.shift()! });

  return new Promise((resolve) => {
    let resolved = false;

    const timer = timeoutMs > 0 ? setTimeout(() => {
      if (!resolved) {
        resolved = true;
        // Remove our waiter so the input goes to queue instead
        inputWaiter = (line) => { inputQueue.push(line); };
        // Clear immediately
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

let metaSessionId: string | null = null;

// ── Interactive loop ───────────────────────────────────────────────────

// Try to resume May's session from previous process
const resumeResult = manager.resumeAgent("may");

if (resumeResult?.resumed) {
  sid = resumeResult.resumed.sessionId;
  currentTask = resumeResult.resumed.task;
  console.log(`[runner] Resumed May's session: ${sid}`);
  console.log(`[runner] Task: "${currentTask.slice(0, 80)}"`);
  if (resumeResult.interrupted.length > 0) {
    console.log(`[runner] Cleaned up ${resumeResult.interrupted.length} stale sub-agent session(s)`);
  }
  attachEvents(sid);
  await waitAndCheck(sid);
} else {
  // No May session to resume — clean up any stale sessions and start fresh
  const stale = manager.cleanupStaleSessions();
  if (stale.length > 0) {
    console.log(`[runner] Cleaned up ${stale.length} stale session(s) from previous run`);
  }

  let firstMessage = process.argv.slice(2).join(" ");
  if (!firstMessage) {
    process.stdout.write("\nyou> ");
    const input = await waitForInput();
    if (!input) { rl.close(); process.exit(0); }
    firstMessage = input;
  }

  sid = startSession(firstMessage);
  await waitAndCheck(sid);
}

while (!closed) {
  process.stdout.write("\nyou> ");
  const response = await waitForInputOrIdle(IDLE_TIMEOUT_MS);

  if (response.type === "idle") {
    // Check for meta work
    console.log("[idle] Idle timeout fired, checking for meta work...");
    const metaTask = hasMetaWork();
    if (metaTask) {
      console.log("\n[idle] Found meta work to do. Starting optimization cycle...");
      console.log("[idle] (Type anything to interrupt and switch to your task)\n");
      metaSessionId = startSession(metaTask);

      // Wait for meta work, but allow user to interrupt
      const metaPromise = manager.waitFor(metaSessionId);
      const userPromise = waitForInput();

      const winner = await Promise.race([
        metaPromise.then(() => ({ type: "meta-done" as const })),
        userPromise.then((v) => ({ type: "user-input" as const, value: v })),
      ]);

      if (winner.type === "user-input") {
        // User typed something — cancel meta work and handle user input
        if (winner.value && winner.value !== "exit" && winner.value !== "quit") {
          console.log("\n[idle] User input received. Cancelling meta work...");
          manager.cancel(metaSessionId);
          metaSessionId = null;

          lastWorkflowUsed = null;
          sid = startSession(winner.value);
          await waitAndCheck(sid);
        } else {
          manager.cancel(metaSessionId);
          break;
        }
      } else {
        // Meta work finished — but userPromise is still pending.
        // Put it back into the queue system so it doesn't leak.
        userPromise.then((v) => { inputQueue.push(v); });
        console.log("\n[idle] Meta work completed.");
        await runEvaluation(metaSessionId);
        metaSessionId = null;
      }
      continue;
    }
    // No meta work found, just wait for next input
    continue;
  }

  // Direct user input
  const input = response.value;
  if (!input || input === "exit" || input === "quit") break;

  if (mayWorkflowTool.isRunning) {
    const steered = mayWorkflowTool.steer(input);
    if (steered) {
      console.log(`[steering] Signal queued for workflow "${mayWorkflowTool.activeWorkflow}"`);
      continue;
    }
  }

  lastWorkflowUsed = null;
  manager.send(sid, input);
  await waitAndCheck(sid);
}

rl.close();
