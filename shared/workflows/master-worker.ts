/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * master-worker — Two persistent sessions (reviewer + worker) running
 * a review-first → work → review → work loop.
 *
 * Usage via CLI:
 *   bun run may --workflow master-worker --input "project: agents/bob/workspace/projects/my-project"
 */

import { readFileSync, existsSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve, join } from "node:path";

export const name: string = "master-worker";

export const description: string =
  "Two-session workflow: reviewer directs strategy, worker executes. " +
  "Review-first pattern ensures focused work from iteration 1.";

// ── Config ──────────────────────────────────────────────────────────────

const MAX_ITERATIONS = 5;

// ── Helpers ─────────────────────────────────────────────────────────────

function extractField(content: string, field: string): string {
  const m = content.match(new RegExp(`^\\*\\*${field}\\*\\*:\\s*(.+)`, "m"));
  return m ? m[1].trim() : "";
}

function extractSection(content: string, heading: string): string {
  const re = new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, "m");
  const m = content.match(re);
  return m ? m[1].trim() : "";
}

interface Decision {
  status: "continue" | "pivot" | "waiting" | "blocked" | "done" | "unknown";
  detail: string;
}

function extractDecision(text: string): Decision {
  const trimmed = text.trim();
  const firstLine = trimmed.split("\n")[0] || "";
  const upper = firstLine.toUpperCase();

  for (const s of ["CONTINUE", "PIVOT", "WAITING", "BLOCKED", "DONE"] as const) {
    if (upper.startsWith(s)) {
      return { status: s.toLowerCase() as Decision["status"], detail: trimmed.slice(0, 500) };
    }
  }

  // Fallback: scan full text
  const decisionMatch = trimmed.match(/\b(CONTINUE|PIVOT|WAITING|BLOCKED|DONE)\b/i);
  if (decisionMatch) {
    return { status: decisionMatch[1].toLowerCase() as Decision["status"], detail: trimmed.slice(0, 500) };
  }

  return { status: "unknown", detail: trimmed.slice(0, 500) };
}

// ── System prompts ──────────────────────────────────────────────────────

function reviewerSystemPrompt(projectRoot: string): string {
  return `You are the reviewer and strategist for a persistent project.
Your role: assess the current state, direct the worker, make decisions.
You can READ files to verify claims but MUST NOT edit, write, or run destructive commands.

Your working directory is: ${projectRoot}

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
}

function workerSystemPrompt(projectRoot: string): string {
  return `You are a worker on a persistent project. You receive guidance from a reviewer and produce concrete deliverables each iteration.

Your working directory is: ${projectRoot}

Rules:
- Do NOT edit project.md or journal.md — those are managed by the system
- Produce concrete deliverables (files, test results, code changes)
- If you get stuck, explain what's blocking you clearly
- Focus on the specific task given in the reviewer's guidance`;
}

// ── Main ────────────────────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // ── Parse project dir from task ──
  const projectMatch = ctx.task?.match(/project:\s*(\S+)/);
  if (!projectMatch) {
    return ctx.escalate("Usage: --input \"project: <path-to-project-dir>\"");
  }

  const projectDir = resolve(ctx.projectRoot, projectMatch[1]);
  const projectFile = join(projectDir, "project.md");
  const journalFile = join(projectDir, "journal.md");

  if (!existsSync(projectFile)) {
    return ctx.escalate(`No project.md found at: ${projectFile}`);
  }

  // ── Read project files ──
  const projectContent = readFileSync(projectFile, "utf-8");
  const journalContent = existsSync(journalFile) ? readFileSync(journalFile, "utf-8") : "";

  const goal = extractSection(projectContent, "Goal") || extractField(projectContent, "Goal") || "See project.md";
  const milestones = extractSection(projectContent, "Milestones") || "";
  const currentState = extractSection(projectContent, "Current State") || "";
  const status = extractField(projectContent, "Status").toLowerCase();

  if (status === "paused" || status === "cancelled") {
    return ctx.done(`Project status: ${status}. Skipping.`);
  }

  ctx.log(`Master-worker workflow for: ${projectMatch[1]} (status: ${status})`);

  // ── Create sessions ──
  const reviewer = await ctx.createSession({
    systemPrompt: reviewerSystemPrompt(ctx.projectRoot),
    tools: "readonly",
    label: "reviewer",
  });

  const worker = await ctx.createSession({
    systemPrompt: workerSystemPrompt(ctx.projectRoot),
    tools: "full",
    label: "worker",
  });

  try {
    // ── Phase 1: Planning — reviewer assesses current state ──
    ctx.log("[plan] Reviewer assessing project state...");

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

    let decision = extractDecision(reviewer.lastText());
    ctx.log(`[plan] Decision: ${decision.status.toUpperCase()}`);

    if (decision.status !== "continue" && decision.status !== "pivot") {
      // Update project status
      const stopReason = decision.detail.slice(0, 200);
      updateProjectStatus(projectFile, projectContent, decision.status, stopReason);
      return decision.status === "blocked"
        ? ctx.escalate(stopReason)
        : ctx.done(`${decision.status}: ${stopReason}`);
    }

    // ── Phase 2+: Work-review loop ──
    let iteration = 0;

    while (iteration < MAX_ITERATIONS && (decision.status === "continue" || decision.status === "pivot")) {
      iteration++;

      // ── Work phase ──
      ctx.log(`[work] Iteration ${iteration} starting...`);
      const guidance = reviewer.lastText();

      if (iteration === 1) {
        await worker.prompt(`## Your Task\n${guidance}`);
      } else {
        await worker.prompt(`## Iteration ${iteration} Guidance\n${guidance}`);
      }

      ctx.log(`[work] Iteration ${iteration} done`);

      // ── Journal ──
      const workerText = worker.lastText();
      const workerSummary = workerText.length > 1500 ? workerText.slice(0, 1500) + "..." : workerText;
      appendFileSync(journalFile, `\n### Iteration ${iteration} — ${new Date().toISOString()}\n**Worker**: ${workerSummary.slice(0, 300)}\n`, "utf-8");

      // ── Review phase ──
      ctx.log(`[review] Reviewer evaluating iteration ${iteration}...`);

      let reviewAttempt = 0;
      while (reviewAttempt < 3) {
        try {
          await reviewer.prompt(`## Worker Output (Iteration ${iteration})\n${workerSummary}\n\nEvaluate and provide your next decision.`);
          break;
        } catch (e: any) {
          reviewAttempt++;
          ctx.log(`[review] Error (attempt ${reviewAttempt}/3): ${e.message?.slice(0, 100)}`);
          if (reviewAttempt >= 3) throw e;
          await new Promise(r => setTimeout(r, 2000 * reviewAttempt));
        }
      }

      decision = extractDecision(reviewer.lastText());
      ctx.log(`[review] Decision: ${decision.status.toUpperCase()}`);

      // Append reviewer decision to journal
      appendFileSync(journalFile, `**Reviewer**: ${decision.detail.slice(0, 300)}\n`, "utf-8");
    }

    // ── Wrap up ──
    const stopReason = decision.status === "continue"
      ? `Reached ${MAX_ITERATIONS} iteration cap`
      : decision.detail.slice(0, 200);

    updateProjectStatus(projectFile, readFileSync(projectFile, "utf-8"), decision.status, stopReason, iteration);

    if (decision.status === "blocked") {
      return ctx.escalate(stopReason);
    }

    return ctx.done(`Completed after ${iteration} iteration(s). Final: ${decision.status.toUpperCase()} — ${stopReason}`);

  } finally {
    reviewer.close();
    worker.close();
  }
}

// ── Project file updates ────────────────────────────────────────────────

function updateProjectStatus(
  projectFile: string,
  content: string,
  status: string,
  reason: string,
  iteration?: number,
) {
  let updated = content;

  // Update Status field
  updated = updated.replace(/^\*\*Status\*\*:\s*.+$/m, `**Status**: ${status}`);

  // Update/add Stop Reason
  if (updated.includes("**Stop Reason**:")) {
    updated = updated.replace(/^\*\*Stop Reason\*\*:\s*.+$/m, `**Stop Reason**: ${reason}`);
  } else {
    updated = updated.replace(/^\*\*Status\*\*:\s*.+$/m, `**Status**: ${status}\n**Stop Reason**: ${reason}`);
  }

  // Update iteration count
  if (iteration !== undefined) {
    if (updated.includes("**Iteration**:")) {
      updated = updated.replace(/^\*\*Iteration\*\*:\s*.+$/m, `**Iteration**: ${iteration}`);
    } else {
      updated = updated.replace(/^\*\*Status\*\*:\s*.+$/m, (match) => `${match}\n**Iteration**: ${iteration}`);
    }
  }

  writeFileSync(projectFile, updated, "utf-8");
}
