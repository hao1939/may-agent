/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * master-worker — Two persistent sessions (orchestrator + worker) running
 * a review-first → work → review → work loop.
 *
 * Project.md fields:
 *   **Workflow**: master-worker          (selects this workflow)
 *   **Max Iterations**: 5               (optional, default 5)
 *   **Status**: active/paused/cancelled/blocked/waiting/done
 *   **Owner**: bob
 *
 * Usage via CLI:
 *   bun src/app/may.ts --run-workflow master-worker "project: agents/shared/projects/my-project"
 */

import { readFileSync, existsSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import {
  extractField, extractSection, extractMilestones, updateProjectStatus,
} from "./project-helpers.ts";

export const name: string = "master-worker";

export const description: string =
  "Two-session workflow: orchestrator directs strategy, worker executes. " +
  "Review-first pattern ensures focused work from iteration 1.";

// ── Config ──────────────────────────────────────────────────────────────

const DEFAULT_MAX_ITERATIONS = 50; // safety cap — workflow runs until done/blocked/waiting

// ── Decision extraction ─────────────────────────────────────────────────

interface Decision {
  status: "continue" | "pivot" | "waiting" | "blocked" | "done" | "unknown";
  detail: string;
}

function extractDecision(text: string): Decision {
  const trimmed = text.trim();
  const firstLine = trimmed.split("\n")[0] || "";
  const upper = firstLine.toUpperCase();

  // Check first line starts with a decision keyword
  for (const s of ["CONTINUE", "PIVOT", "WAITING", "BLOCKED", "DONE"] as const) {
    if (upper.startsWith(s)) {
      return { status: s.toLowerCase() as Decision["status"], detail: trimmed.slice(0, 500) };
    }
  }

  // Check for "Decision: KEYWORD", "**KEYWORD**", or "**Proceed**" patterns
  const decisionPattern = /(?:\*{0,2}Decision\*{0,2}[:\s]+\*{0,2}|^|\n)\*{0,2}(CONTINUE|PIVOT|BLOCKED|WAITING|DONE)\*{0,2}/im;
  const patternMatch = trimmed.match(decisionPattern);
  if (patternMatch) {
    return { status: patternMatch[1].toLowerCase() as Decision["status"], detail: trimmed.slice(0, 500) };
  }

  // "Proceed" / "move forward" / "start working" → CONTINUE
  if (/\b(proceed|move forward|start working|begin work|let'?s begin|let'?s start)\b/i.test(trimmed)) {
    return { status: "continue", detail: trimmed.slice(0, 500) };
  }

  // Fallback: scan for uppercase keywords (skip DONE — too common as regular word)
  for (const keyword of ["CONTINUE", "PIVOT", "BLOCKED", "WAITING"] as const) {
    if (new RegExp(`\\b${keyword}\\b`).test(trimmed)) {
      return { status: keyword.toLowerCase() as Decision["status"], detail: trimmed.slice(0, 500) };
    }
  }

  return { status: "unknown", detail: trimmed.slice(0, 500) };
}

// ── System prompts ──────────────────────────────────────────────────────

function orchestratorSystemPrompt(projectDir: string): string {
  return `You are the orchestrator and project maintainer.
Your role: assess state, direct the worker, verify deliverables, update project.md.

The project directory is: ${projectDir}
You are the ONLY authority on project status and milestones. The worker cannot see or edit project.md.

You MUST update project.md directly:
- Check off milestones: change [ ] to [x] when you verify the deliverable exists and works
- Update Current State with findings and decisions
- Keep the file clean and accurate

You can read any file to verify claims. You can edit project.md. Do NOT edit other files.

When you receive worker output, evaluate it and decide what to do next.

Respond with one of these decisions as the VERY FIRST WORD of your response (no headers, no preamble):
CONTINUE — progress is being made, guide the next iteration
PIVOT — current approach failed, describe a different strategy
WAITING — paused by design (deprioritized, waiting for external condition)
BLOCKED — something is broken that needs fixing before we can continue

NOTE: You cannot close a project. Projects run until human or May closes them.
Push metrics toward targets. Milestones are a work log, not a completion trigger.

Example response format:
CONTINUE

(a) Next iteration should produce...
(b) What's different...
(c) First step...

When milestones are completed, explicitly list which ones are done using the exact text from project.md, e.g.:
"Milestone completed: Create .state/fib.ts script"`;
}

function workerSystemPrompt(projectDir: string): string {
  const outputsDir = projectDir + "/outputs";
  return `You are a worker. You receive focused tasks and produce concrete deliverables.

Your outputs directory: ${outputsDir}
Put ALL deliverables (reports, code, analysis) in this directory.

Rules:
- All deliverables go in ${outputsDir}
- Do NOT edit project.md, journal.md, or discussion.md
- Focus on the specific task in the guidance
- When done, summarize what you created and where`;
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

  // Ensure journal exists
  if (!existsSync(journalFile)) {
    writeFileSync(journalFile, "# Journal\n", "utf-8");
  }

  // ── Read project files ──
  let projectContent = readFileSync(projectFile, "utf-8");
  const journalContent = readFileSync(journalFile, "utf-8");

  const goal = extractSection(projectContent, "Goal") || extractField(projectContent, "Goal") || "See project.md";
  const status = extractField(projectContent, "Status").toLowerCase();
  const maxIterations = parseInt(extractField(projectContent, "Max Iterations")) || DEFAULT_MAX_ITERATIONS;

  if (status === "paused" || status === "cancelled") {
    return ctx.done(`Project status: ${status}. Skipping.`);
  }

  // Check if already done with no pending comments
  if (status === "closed") {
    // Check discussion.md for unread comments
    const discFile = join(projectDir, "discussion.md");
    let hasUnread = false;
    try {
      if (existsSync(discFile)) {
        const disc = readFileSync(discFile, "utf-8");
        const lastMarker = disc.lastIndexOf("---read @");
        const unread = lastMarker >= 0 ? disc.slice(disc.indexOf("\n", lastMarker) + 1).trim() : disc.replace(/^# Discussion\s*/, "").trim();
        hasUnread = !!unread;
      }
    } catch {}
    if (!hasUnread) return ctx.done("Project is closed. No unread comments.");
  }

  ctx.log(`[master-worker] ${projectMatch[1]} | status: ${status} | max-iter: ${maxIterations}`);

  // ── Create sessions ──
  const orchestrator = await ctx.createSession({
    systemPrompt: orchestratorSystemPrompt(projectDir),
    tools: "full",
    label: "orchestrator",
  });

  const worker = await ctx.createSession({
    systemPrompt: workerSystemPrompt(dirname(projectDir)),
    tools: "full",
    label: "worker",
  });

  try {
    // ── Phase 1: Planning — orchestrator assesses current state ──
    ctx.log("[plan] Orchestrator assessing project state...");

    let planningPrompt = `Assess this project and decide what to do next.

## project.md
${projectContent}

## journal.md (last 3000 chars)
${journalContent.slice(-3000)}
`;

    // Handle pending comments from discussion.md
    const discussionFile = join(projectDir, "discussion.md");
    let unreadComments = "";
    try {
      if (existsSync(discussionFile)) {
        const disc = readFileSync(discussionFile, "utf-8");
        const lastMarker = disc.lastIndexOf("---read @");
        const unread = lastMarker >= 0 ? disc.slice(disc.indexOf("\n", lastMarker) + 1).trim() : disc.replace(/^# Discussion\s*/, "").trim();
        if (unread) unreadComments = unread;
      }
    } catch {}
    if (unreadComments) {
      planningPrompt += `\n## Unread Comments (address these)\n${unreadComments}\n`;
    }

    planningPrompt += `\nBased on your assessment, provide your decision and guidance for the worker.`;

    await orchestrator.prompt(planningPrompt);

    // Mark comments as read (append-only, never delete)
    if (unreadComments) {
      try {
        appendFileSync(discussionFile, `\n---read @plan---\n`, "utf-8");
      } catch {}
    }

    let decision = extractDecision(orchestrator.lastText());
    ctx.log(`[plan] Decision: ${decision.status.toUpperCase()}`);

    // Treat "unknown" as CONTINUE for the planning phase — orchestrator gave guidance but didn't use the keyword
    if (decision.status === "unknown") {
      ctx.log("[plan] Decision unclear — treating as CONTINUE");
      decision.status = "continue";
    }

    if (decision.status !== "continue" && decision.status !== "pivot") {
      const stopReason = decision.detail.slice(0, 200);
      updateProjectStatus(projectFile, decision.status, stopReason);
      return decision.status === "blocked"
        ? ctx.escalate(stopReason)
        : ctx.done(`${decision.status}: ${stopReason}`);
    }

    // ── Phase 2+: Work-review loop ──
    let iteration = 0;

    while (iteration < maxIterations && (decision.status === "continue" || decision.status === "pivot")) {
      iteration++;

      // ── Work phase ──
      ctx.log(`[work] Iteration ${iteration}/${maxIterations} starting...`);
      const guidance = orchestrator.lastText();

      // Worker gets ONLY the orchestrator's guidance — no project.md, no milestones
      const workerPrompt = `## Task (Iteration ${iteration})\n${guidance}`;

      await worker.prompt(workerPrompt);
      ctx.log(`[work] Iteration ${iteration} done`);

      // ── Journal ──
      const workerText = worker.lastText();
      const workerSummary = workerText.length > 1500 ? workerText.slice(0, 1500) + "..." : workerText;
      appendFileSync(journalFile, `\n### Iteration ${iteration} — ${new Date().toISOString()}\n**Worker**: ${workerSummary.slice(0, 500)}\n`, "utf-8");

      // ── Review phase ──
      ctx.log(`[review] Orchestrator evaluating iteration ${iteration}...`);

      // Check for new comments since last read
      let newComments = "";
      try {
        if (existsSync(discussionFile)) {
          const disc = readFileSync(discussionFile, "utf-8");
          const lastMarker = disc.lastIndexOf("---read @");
          const unread = lastMarker >= 0 ? disc.slice(disc.indexOf("\n", lastMarker) + 1).trim() : "";
          if (unread) newComments = unread;
        }
      } catch {}

      let reviewPrompt = `## Worker Output (Iteration ${iteration})
${workerSummary}

Read project.md for current state, metrics, and plan. Update it as needed.
Then provide your decision and guidance for the next iteration.`;
      if (newComments) {
        reviewPrompt += `\n\n## New Comments (address these)\n${newComments}`;
      }

      let reviewAttempt = 0;
      while (reviewAttempt < 3) {
        try {
          await orchestrator.prompt(reviewPrompt);
          break;
        } catch (e: any) {
          reviewAttempt++;
          ctx.log(`[review] Error (attempt ${reviewAttempt}/3): ${e.message?.slice(0, 100)}`);
          if (reviewAttempt >= 3) throw e;
          await new Promise(r => setTimeout(r, 2000 * reviewAttempt));
        }
      }

      const orchestratorText = orchestrator.lastText();
      // Mark new comments as read
      if (newComments) {
        try { appendFileSync(discussionFile, `\n---read @iter${iteration}---\n`, "utf-8"); } catch {}
      }
      decision = extractDecision(orchestratorText);
      if (decision.status === "unknown") {
        ctx.log("[review] Decision unclear — treating as CONTINUE");
        decision.status = "continue";
      }
      ctx.log(`[review] Decision: ${decision.status.toUpperCase()}`);

      // Append orchestrator decision to journal
      appendFileSync(journalFile, `**Orchestrator**: ${decision.detail.slice(0, 300)}\n`, "utf-8");

      // Update iteration count in project.md
      updateProjectStatus(projectFile, "active", undefined, iteration);

      // Emit iteration event for metrics tracking
      try { ctx.emit({ type: "emit", event: "project.iteration", data: { project: projectDir, iteration } }); } catch {}
    }

    // ── Wrap up ──
    const finalContent = readFileSync(projectFile, "utf-8");
    const finalMs = extractMilestones(finalContent);
    const projectType = extractField(finalContent, "Type").toLowerCase();
    let finalStatus: string;
    let stopReason: string;

    if (decision.status === "done" || (projectType !== "continuous" && finalMs.total > 0 && finalMs.pending.length === 0)) {
      finalStatus = "done";
      stopReason = `All ${finalMs.total} milestones complete`;
    } else if (decision.status === "blocked") {
      finalStatus = "blocked";
      stopReason = decision.detail.slice(0, 200);
    } else if (decision.status === "waiting") {
      finalStatus = "waiting";
      stopReason = decision.detail.slice(0, 200);
    } else if (iteration >= maxIterations) {
      finalStatus = "blocked";
      stopReason = `Safety cap: ${maxIterations} iterations reached without resolution. ${finalMs.done}/${finalMs.total} milestones done.`;
    } else {
      finalStatus = decision.status;
      stopReason = decision.detail.slice(0, 200);
    }

    updateProjectStatus(projectFile, finalStatus, stopReason, iteration);
    ctx.log(`[done] ${finalStatus} after ${iteration} iteration(s). ${finalMs.done}/${finalMs.total} milestones. ${stopReason}`);

    if (finalStatus === "blocked") return ctx.escalate(stopReason);
    return ctx.done(`${finalStatus} after ${iteration} iteration(s). ${stopReason}`);

  } finally {
    orchestrator.close();
    worker.close();
  }
}
