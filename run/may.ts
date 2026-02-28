import { readFileSync, existsSync } from "node:fs";
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
  evaluateSession,
} from "../src/index.js";
import type { WorkflowEvent } from "../src/workflow.js";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

const manager = new SubagentManager({
  persistDir: resolve(PROJECT_ROOT, ".state"),
});

// ── Register coder (Opus) ──────────────────────────────────────────────

const coderKnowledge = readFileSync(`${PROJECT_ROOT}/agents/coder/knowledge/domain.md`, "utf-8");
const coderTools = readFileSync(`${PROJECT_ROOT}/agents/coder/tools/INDEX.md`, "utf-8");

manager.register({
  name: "coder",
  description: "Focused implementation agent — writes code, tests, commits",
  domain: "may-agent implementation",
  systemPrompt: [coderKnowledge, coderTools].join("\n\n---\n\n"),
  workspace: resolve(PROJECT_ROOT, "agents/coder/workspace"),
  model: opus,
  tools: [
    createReadTool(),
    createWriteTool(),
    createExecTool(PROJECT_ROOT),
  ],
  apiKey: "not-needed",
});

// ── Register reviewer (GPT-5.2) ───────────────────────────────────────

const reviewerKnowledge = readFileSync(`${PROJECT_ROOT}/agents/reviewer/knowledge/domain.md`, "utf-8");
const reviewerTools = readFileSync(`${PROJECT_ROOT}/agents/reviewer/tools/INDEX.md`, "utf-8");

manager.register({
  name: "reviewer",
  description: "Independent code/design reviewer on GPT-5.2 — provides different perspective",
  domain: "code review and design evaluation",
  systemPrompt: [reviewerKnowledge, reviewerTools].join("\n\n---\n\n"),
  workspace: resolve(PROJECT_ROOT, "agents/reviewer/workspace"),
  model: gpt52,
  tools: [
    createReadTool(),
    createExecTool(PROJECT_ROOT),
  ],
  apiKey: "not-needed",
});

// ── Register evaluator (GPT-5.2) ──────────────────────────────────────

const evaluatorKnowledge = readFileSync(`${PROJECT_ROOT}/agents/evaluator/knowledge/domain.md`, "utf-8");

manager.register({
  name: "evaluator",
  description: "Session evaluator — scores efficiency/quality, detects patterns, suggests workflows",
  domain: "session evaluation and workflow generation",
  systemPrompt: evaluatorKnowledge,
  workspace: resolve(PROJECT_ROOT, "agents/evaluator/workspace"),
  model: gpt52,
  tools: [
    createReadTool(),
    createWriteTool(),
    createValidateWorkflowTool(),
    createExecTool(PROJECT_ROOT),
  ],
  apiKey: "not-needed",
});

// ── Track which workflow was used ──────────────────────────────────────

let lastWorkflowUsed: string | null = null;

// ── Register may supervisor (Opus) ─────────────────────────────────────

const mayKnowledge = readFileSync(`${PROJECT_ROOT}/agents/may/knowledge/domain.md`, "utf-8");
const mayTools = readFileSync(`${PROJECT_ROOT}/agents/may/tools/INDEX.md`, "utf-8");

const mayLessonsPath = `${PROJECT_ROOT}/agents/may/knowledge/lessons.md`;
const mayLessons = existsSync(mayLessonsPath) ? readFileSync(mayLessonsPath, "utf-8") : "";

const mayPromptParts = [mayKnowledge, mayTools];
if (mayLessons) {
  mayPromptParts.push(mayLessons);
}

const workflowTool = createWorkflowTool({
  manager,
  workflowDir: resolve(PROJECT_ROOT, "agents/may/workflows"),
  onEvent: (event: WorkflowEvent) => {
    switch (event.type) {
      case "workflow_start":
        console.log(`\n[workflow] ${event.workflow}: ${event.task.slice(0, 100)}`);
        lastWorkflowUsed = event.workflow;
        break;
      case "step_start":
        console.log(`[workflow:step] ${event.step} started${event.sessionId ? ` (${event.sessionId})` : ""}`);
        // Subscribe to sub-agent events for streaming
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

manager.register({
  name: "may",
  description: "Supervisor agent — plans, delegates, reviews",
  domain: "may-agent architecture and coordination",
  systemPrompt: mayPromptParts.join("\n\n---\n\n"),
  workspace: resolve(PROJECT_ROOT, "agents/may/workspace"),
  model: opus,
  tools: [
    createReadTool(),
    createWriteTool(),
    createExecTool(PROJECT_ROOT),
    createValidateWorkflowTool(),
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

const PERSIST_DIR = resolve(PROJECT_ROOT, ".state");
const AUTO_EVALUATE = process.env.MAY_EVALUATE !== "0";

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
      knowledgeDir: resolve(PROJECT_ROOT, "agents/may/knowledge"),
      workflowDir: resolve(PROJECT_ROOT, "agents/may/workflows"),
    });
    console.log(`[eval] verdict: ${result.scores.verdict} (efficiency: ${result.scores.efficiency}, quality: ${result.scores.quality})`);
    if (result.scores.pattern_detected) {
      console.log(`[eval] pattern detected: ${result.scores.pattern_name}`);
    }
    if (result.lessons) {
      console.log(`[eval] lessons appended to knowledge/lessons.md`);
    }
    if (result.workflowCode) {
      console.log(`[eval] workflow suggested: ${result.workflowName}`);
    }
  } catch (err) {
    console.log(`[eval] evaluation failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

let firstMessage = process.argv.slice(2).join(" ");
if (!firstMessage) {
  const input = await ask();
  if (!input) { rl.close(); process.exit(0); }
  firstMessage = input;
}

// Reset workflow tracking for each new task
lastWorkflowUsed = null;

const sid = manager.run("may", firstMessage);
attachEvents(sid);
await manager.waitFor(sid);
await runEvaluation(sid);

while (!closed) {
  const input = await ask();

  if (!input || input === "exit" || input === "quit") {
    break;
  }

  // Check if this is a steering command while a workflow is running
  if (workflowTool.isRunning) {
    const steered = workflowTool.steer(input);
    if (steered) {
      console.log(`[steering] Signal queued for workflow "${workflowTool.activeWorkflow}" — will interrupt at next step boundary.`);
      continue;
    }
  }

  // Reset workflow tracking for each new turn
  lastWorkflowUsed = null;

  manager.send(sid, input);
  await manager.waitFor(sid);
  await runEvaluation(sid);
}

rl.close();
