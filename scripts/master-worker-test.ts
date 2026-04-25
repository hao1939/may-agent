#!/usr/bin/env bun
/**
 * master-worker-test.ts — Standalone master-worker workflow prototype.
 *
 * Creates two persistent pi-agent sessions (reviewer + worker) and runs
 * the review-first → work → review → work loop using followUp().
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... bun scripts/master-worker-test.ts <project-dir>
 *
 * Example:
 *   bun scripts/master-worker-test.ts agents/bob/workspace/projects/agent-cli-research
 */

import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { createCodingTools } from "../src/lib/tools/coding.ts";
import { createReadTool } from "../src/lib/tools/read.ts";

// ── Config ──────────────────────────────────────────────────────────────

const MAX_ITERATIONS = 3;
const PROJECT_ROOT = resolve(import.meta.dir, "..");

// ── Args & validation ───────────────────────────────────────────────────

const projectArg = process.argv[2];
if (!projectArg) {
  console.error("Usage: bun scripts/master-worker-test.ts <project-dir>");
  console.error("Example: bun scripts/master-worker-test.ts agents/bob/workspace/projects/agent-cli-research");
  process.exit(1);
}

const projectDir = resolve(PROJECT_ROOT, projectArg);
const projectFile = join(projectDir, "project.md");
const journalFile = join(projectDir, "journal.md");

if (!existsSync(projectFile)) {
  console.error(`No project.md found at: ${projectFile}`);
  process.exit(1);
}

// No API key check needed — litellm handles auth

// ── Read project files ──────────────────────────────────────────────────

const projectContent = readFileSync(projectFile, "utf-8");
const journalContent = existsSync(journalFile) ? readFileSync(journalFile, "utf-8") : "";

// Extract fields from project.md
function extractField(content: string, field: string): string {
  const m = content.match(new RegExp(`^\\*\\*${field}\\*\\*:\\s*(.+)`, "m"));
  return m ? m[1].trim() : "";
}

function extractSection(content: string, heading: string): string {
  const re = new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, "m");
  const m = content.match(re);
  return m ? m[1].trim() : "";
}

const goal = extractSection(projectContent, "Goal") || extractField(projectContent, "Goal") || "See project.md";
const milestones = extractSection(projectContent, "Milestones") || "";
const currentState = extractSection(projectContent, "Current State") || "";
const status = extractField(projectContent, "Status").toLowerCase();

// ── Model ───────────────────────────────────────────────────────────────

const LITELLM_BASE_URL = process.env.MODEL_BASE_URL || "http://localhost:4000";
const LITELLM_API_KEY = process.env.LITELLM_API_KEY || "not-needed";

const model = {
  ...getModel("anthropic", "claude-sonnet-4-20250514"),
  id: "claude-opus-4.6",
  baseUrl: LITELLM_BASE_URL,
  contextWindow: 200000,
};

// ── System prompts ──────────────────────────────────────────────────────

const REVIEWER_SYSTEM_PROMPT = `You are the reviewer and strategist for a persistent project.
Your role: assess the current state, direct the worker, make decisions.
You can READ files to verify claims but MUST NOT edit, write, or run destructive commands.

When you receive worker output, evaluate it and decide what to do next.

Respond with one of these decisions as the FIRST WORD of your response:
- CONTINUE — progress is being made, guide the next iteration
- PIVOT — current approach failed, describe a different strategy
- WAITING — work reached a point needing external input (e.g., human review)
- BLOCKED — specific external dependency that no worker iteration can resolve

If CONTINUE or PIVOT, include:
(a) What specific output the next iteration should produce
(b) What's different from previous guidance
(c) One specific first step to start with`;

const WORKER_SYSTEM_PROMPT = `You are a worker on a persistent project. You receive guidance from a reviewer and produce concrete deliverables each iteration.

Your working directory is: ${PROJECT_ROOT}

Rules:
- Do NOT edit project.md or journal.md — those are managed by the system
- Produce concrete deliverables (files, test results, code changes)
- If you get stuck, explain what's blocking you clearly
- Focus on the specific task given in the reviewer's guidance`;

// ── Create agents ───────────────────────────────────────────────────────

const worker = new Agent({
  initialState: {
    systemPrompt: WORKER_SYSTEM_PROMPT,
    model,
    tools: createCodingTools(PROJECT_ROOT, { agentName: "worker" }) as any[],
  },
  getApiKey: () => LITELLM_API_KEY,
});

const reviewer = new Agent({
  initialState: {
    systemPrompt: REVIEWER_SYSTEM_PROMPT,
    model,
    tools: [createReadTool(PROJECT_ROOT)] as any[],
  },
  getApiKey: () => LITELLM_API_KEY,
});

// ── Event logging ───────────────────────────────────────────────────────

let workerTurns = 0;
let reviewerTurns = 0;

worker.subscribe(async (event) => {
  if (event.type === "tool_execution_start") {
    console.log(`  [worker] 🔧 ${event.toolName}(${JSON.stringify(event.args).slice(0, 80)}...)`);
  }
  if (event.type === "turn_end") workerTurns++;
});

reviewer.subscribe(async (event) => {
  if (event.type === "tool_execution_start") {
    console.log(`  [reviewer] 🔧 ${event.toolName}(${JSON.stringify(event.args).slice(0, 80)}...)`);
  }
  if (event.type === "turn_end") reviewerTurns++;
});

// ── Helpers ─────────────────────────────────────────────────────────────

function getLastAssistantText(agent: Agent): string {
  const messages = agent.state.messages;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as any;
    if (msg.role === "assistant") {
      const textParts = (msg.content || []).filter((c: any) => c.type === "text");
      return textParts.map((c: any) => c.text).join("\n");
    }
  }
  return "";
}

interface Decision {
  status: "continue" | "pivot" | "waiting" | "blocked" | "done" | "unknown";
  detail: string;
}

function extractDecision(text: string): Decision {
  const trimmed = text.trim();
  // Check first line
  const firstLine = trimmed.split("\n")[0] || "";
  const upper = firstLine.toUpperCase();

  for (const s of ["CONTINUE", "PIVOT", "WAITING", "BLOCKED", "DONE"] as const) {
    if (upper.startsWith(s)) {
      return { status: s.toLowerCase() as Decision["status"], detail: trimmed.slice(0, 500) };
    }
  }

  // Fallback: scan full text for "Decision: **BLOCKED**" or similar patterns
  const decisionMatch = trimmed.match(/\b(CONTINUE|PIVOT|WAITING|BLOCKED|DONE)\b/i);
  if (decisionMatch) {
    return {
      status: decisionMatch[1].toLowerCase() as Decision["status"],
      detail: trimmed.slice(0, 500),
    };
  }

  return { status: "unknown", detail: trimmed.slice(0, 500) };
}

function summarizeWorker(agent: Agent): string {
  const text = getLastAssistantText(agent);
  return text.length > 1500 ? text.slice(0, 1500) + "…" : text;
}

// ── Main loop ───────────────────────────────────────────────────────────

async function run() {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`Master-Worker Workflow Prototype`);
  console.log(`Project: ${projectArg}`);
  console.log(`Status: ${status}`);
  console.log(`Goal: ${goal.slice(0, 100)}...`);
  console.log(`${"═".repeat(60)}\n`);

  // ── Phase 1: Planning — reviewer assesses current state ──
  console.log(`[plan] Reviewer assessing project state...`);

  const planningPrompt = `Assess this project and decide what to do next.

## Goal
${goal}

## Milestones
${milestones}

## Current Status: ${status}
${currentState}

## Journal (previous work)
${journalContent.slice(0, 3000)}

Based on your assessment, provide your decision (CONTINUE/PIVOT/WAITING/BLOCKED) and guidance for the worker.`;

  await reviewer.prompt(planningPrompt);

  let decision = extractDecision(getLastAssistantText(reviewer));
  console.log(`[plan] Decision: ${decision.status.toUpperCase()}`);
  console.log(`[plan] ${decision.detail.slice(0, 300)}\n`);

  if (decision.status !== "continue" && decision.status !== "pivot") {
    console.log(`[done] Workflow stopped: ${decision.status}`);
    return;
  }

  // ── Phase 2+: Work-review loop ──
  let iteration = 0;

  while (iteration < MAX_ITERATIONS && (decision.status === "continue" || decision.status === "pivot")) {
    iteration++;

    // ── Work phase ──
    console.log(`${"─".repeat(40)}`);
    console.log(`[work] Iteration ${iteration} starting...`);
    const prevWorkerTurns = workerTurns;

    const guidance = getLastAssistantText(reviewer);

    if (iteration === 1) {
      await worker.prompt(`## Your Task\n${guidance}`);
    } else {
      await worker.prompt(`## Iteration ${iteration} Guidance\n${guidance}`);
    }

    const turns = workerTurns - prevWorkerTurns;
    console.log(`[work] Iteration ${iteration} done (${turns} turns)\n`);

    // ── Review phase ──
    console.log(`[review] Reviewer evaluating iteration ${iteration}...`);
    const summary = summarizeWorker(worker);

      // Use prompt() — sends full history, works with litellm
      let reviewAttempt = 0;
      let reviewText = "";
      while (reviewAttempt < 3) {
        try {
          await reviewer.prompt(`## Worker Output (Iteration ${iteration})\n${summary}\n\nEvaluate and provide your next decision.`);
        } catch (e: any) {
          reviewAttempt++;
          console.log(`[review] prompt error (attempt ${reviewAttempt}/3): ${e.message?.slice(0, 100)}`);
          await new Promise(r => setTimeout(r, 2000 * reviewAttempt));
          continue;
        }
        reviewText = getLastAssistantText(reviewer);
        const lastMsg = reviewer.state.messages[reviewer.state.messages.length - 1] as any;
        if (lastMsg?.stopReason === "error") {
          reviewAttempt++;
          console.log(`[review] API error (attempt ${reviewAttempt}/3): ${lastMsg.errorMessage?.slice(0, 100)}`);
          reviewer.state.messages = reviewer.state.messages.filter((m: any) => m !== lastMsg);
          await new Promise(r => setTimeout(r, 2000 * reviewAttempt));
          continue;
        }
        break;
      }

    decision = extractDecision(reviewText);
    console.log(`[review] Decision: ${decision.status.toUpperCase()}`);
    console.log(`[review] ${decision.detail.slice(0, 200)}\n`);
  }

  // ── Summary ──
  console.log(`${"═".repeat(60)}`);
  console.log(`[done] Workflow completed after ${iteration} iteration(s)`);
  console.log(`       Worker: ${workerTurns} total turns`);
  console.log(`       Reviewer: ${reviewerTurns} total turns`);
  console.log(`       Final decision: ${decision.status.toUpperCase()}`);
  console.log(`${"═".repeat(60)}`);
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
