import { createInterface } from "node:readline";
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

const PERSIST_DIR = resolve(PROJECT_ROOT, ".state");

const manager = new SubagentManager({
  persistDir: PERSIST_DIR,
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
  model: opus,
  tools: [
    createReadTool(),
    createWriteTool(),
    createExecTool(PROJECT_ROOT),
    createLearnTool(knowledgeDir("coder")),
  ],
  apiKey: "not-needed",
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
  model: gpt52,
  tools: [
    createReadTool(),
    createExecTool(PROJECT_ROOT),
    createLearnTool(knowledgeDir("reviewer")),
  ],
  apiKey: "not-needed",
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
  model: gpt52,
  tools: [
    createReadTool(),
    createWriteTool(),
    createValidateWorkflowTool(),
    createExecTool(PROJECT_ROOT),
    createLearnTool(knowledgeDir("evaluator")),
  ],
  apiKey: "not-needed",
});

// ── Register optimizer ─────────────────────────────────────────────────

manager.register({
  name: "optimizer",
  description: "Performance optimizer — analyzes cost/efficiency, generates skills, proposes model changes",
  domain: "agent performance optimization",
  systemPromptFiles: [
    resolve(knowledgeDir("optimizer"), "domain.md"),
    resolve(agentDir("optimizer"), "tools/INDEX.md"),
  ],
  knowledgeDir: knowledgeDir("optimizer"),
  workspace: resolve(agentDir("optimizer"), "workspace"),
  model: gpt52,
  tools: [
    createReadTool(),
    createWriteTool(),
    createExecTool(PROJECT_ROOT),
    createLearnTool(knowledgeDir("optimizer")),
  ],
  apiKey: "not-needed",
});

// ── Track which workflow was used ──────────────────────────────────────

let lastWorkflowUsed: string | null = null;

// ── Workflow tool ──────────────────────────────────────────────────────

const workflowTool = createWorkflowTool({
  manager,
  workflowDir: resolve(agentDir("may"), "workflows"),
  onEvent: (event: WorkflowEvent) => {
    switch (event.type) {
      case "workflow_start":
        console.log(`\n[workflow] ${event.workflow}: ${event.task.slice(0, 100)}`);
        lastWorkflowUsed = event.workflow;
        break;
      case "step_start":
        console.log(`[workflow:step] ${event.step} started${event.sessionId ? ` (${event.sessionId})` : ""}`);
        if (event.sessionId) {
          attachSubagentEvents(event.step, event.sessionId);
        }
        break;
      case "step_done":
        console.log(`[workflow:step] ${event.step} ${event.result?.status ?? "done"} (${event.result?.duration ?? "?"})`);
        break;
      case "workflow_done":
        console.log(`[workflow] done`);
        break;
      case "workflow_escalate":
        console.log(`[workflow] escalated: ${event.reason}`);
        break;
    }
  },
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
  model: opus,
  tools: [
    createReadTool(),
    createWriteTool(),
    createExecTool(PROJECT_ROOT),
    createValidateWorkflowTool(),
    createLearnTool(knowledgeDir("may")),
    manager.createTool(),
    workflowTool,
  ],
  apiKey: "not-needed",
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

function ask(): Promise<string | null> {
  if (closed) return Promise.resolve(null);
  return new Promise((resolve) => {
    rl.question("\nyou> ", (answer) => resolve(answer.trim()));
  });
}

const AUTO_EVALUATE = process.env.MAY_EVALUATE !== "0";
const MAINTENANCE_INTERVAL = 5; // run maintenance every N evaluations
let evalsSinceMaintenance = 0;

async function runEvaluation(sessionId: string): Promise<void> {
  if (!AUTO_EVALUATE) return;
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
    if (result.scores.pattern_detected) {
      console.log(`[eval] pattern detected: ${result.scores.pattern_name}`);
    }
    if (result.lessons) {
      console.log(`[eval] lessons appended to knowledge/lessons.md`);
    }
    if (result.workflowCode) {
      console.log(`[eval] workflow suggested: ${result.workflowName}`);
    }

    // Periodic maintenance — run for all agents
    evalsSinceMaintenance++;
    if (evalsSinceMaintenance >= MAINTENANCE_INTERVAL) {
      const agentNames = ["may", "coder", "reviewer"];
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
  } catch (err) {
    console.log(`[eval] evaluation failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── Session management with compaction ─────────────────────────────────

let sid: string;

function startSession(task: string): string {
  lastWorkflowUsed = null;
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

      // Build summary from the last assistant text and task
      const summary = result.lastAssistantText
        ? `Previous session hit context limit. Last progress:\n\n${result.lastAssistantText.slice(0, 2000)}\n\nContinue from where you left off.`
        : "Previous session hit context limit. Check your workspace for any progress notes, then continue.";

      sid = startSession(summary);
      await waitAndCheck(sid);
      return;
    }
  }

  await runEvaluation(sessionId);
}

let firstMessage = process.argv.slice(2).join(" ");
if (!firstMessage) {
  const input = await ask();
  if (!input) { rl.close(); process.exit(0); }
  firstMessage = input;
}

sid = startSession(firstMessage);
await waitAndCheck(sid);

while (!closed) {
  const input = await ask();

  if (!input || input === "exit" || input === "quit") {
    break;
  }

  if (workflowTool.isRunning) {
    const steered = workflowTool.steer(input);
    if (steered) {
      console.log(`[steering] Signal queued for workflow "${workflowTool.activeWorkflow}" — will interrupt at next step boundary.`);
      continue;
    }
  }

  lastWorkflowUsed = null;

  manager.send(sid, input);
  await waitAndCheck(sid);
}

rl.close();
