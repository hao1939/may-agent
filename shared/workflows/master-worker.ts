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
  extractField, extractSection, extractMilestones, checkOffMilestones,
  extractComments, clearComments, updateProjectStatus,
} from "./project-helpers.ts";

export const name: string = "master-worker";

export const description: string =
  "Two-session workflow: orchestrator directs strategy, worker executes. " +
  "Review-first pattern ensures focused work from iteration 1.";

// ── Config ──────────────────────────────────────────────────────────────

const DEFAULT_MAX_ITERATIONS = 50; // safety cap — workflow runs until done/blocked/waiting
const MAX_STALL_ITERATIONS = 2; // escalate after N iterations without milestone progress

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
Your role: assess state, direct the worker, verify deliverables, declare milestone completion.

The project directory is: ${projectDir}
You are the ONLY authority on project status and milestones. The worker cannot see or edit project.md.
You can READ files to verify the worker's claims. MUST NOT edit or write files.

When you receive worker output, evaluate it and decide what to do next.

Respond with one of these decisions as the VERY FIRST WORD of your response (no headers, no preamble):
CONTINUE — progress is being made, guide the next iteration
PIVOT — current approach failed, describe a different strategy
DONE — all milestones are complete, no more work needed
WAITING — work reached a point needing external input (e.g., human review)
BLOCKED — specific external dependency that no worker iteration can resolve

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
  const milestones = extractSection(projectContent, "Milestones") || "";
  const currentState = extractSection(projectContent, "Current State") || "";
  const resources = extractSection(projectContent, "Resources") || "";
  const status = extractField(projectContent, "Status").toLowerCase();
  const maxIterations = parseInt(extractField(projectContent, "Max Iterations")) || DEFAULT_MAX_ITERATIONS;

  if (status === "paused" || status === "cancelled") {
    return ctx.done(`Project status: ${status}. Skipping.`);
  }

  // Check if already done with no pending comments
  const initialMilestones = extractMilestones(projectContent);
  if (status === "done" && initialMilestones.pending.length === 0 && !extractComments(projectContent)) {
    return ctx.done("Project already done. No pending comments.");
  }

  ctx.log(`[master-worker] ${projectMatch[1]} | status: ${status} | milestones: ${initialMilestones.done}/${initialMilestones.total} | max-iter: ${maxIterations}`);

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

## Goal
${goal}

## Milestones
${milestones}

## Current Status: ${status}
${currentState}
`;
    if (resources) planningPrompt += `\n## Resources\n${resources}\n`;
    planningPrompt += `\n## Journal (previous work)\n${journalContent.slice(-3000)}\n`;

    // Handle pending comments
    const comments = extractComments(projectContent);
    if (comments) {
      planningPrompt += `\n## Human Comments (address these)\n${comments}\n`;
      // Clear comments after reading
      projectContent = clearComments(projectContent);
      writeFileSync(projectFile, projectContent, "utf-8");
    }

    planningPrompt += `\nBased on your assessment, provide your decision and guidance for the worker.`;

    await orchestrator.prompt(planningPrompt);

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
    let stallCount = 0;
    let prevDoneCount = initialMilestones.done;

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

      // Build review prompt with current milestone state
      const currentContent = readFileSync(projectFile, "utf-8");
      const ms = extractMilestones(currentContent);
      let reviewPrompt = `## Worker Output (Iteration ${iteration})\n${workerSummary}\n\n`;
      if (ms.total > 0) {
        reviewPrompt += `## Current Milestones (${ms.done}/${ms.total})\n`;
        if (ms.completed.length > 0) reviewPrompt += `Done: ${ms.completed.join(", ")}\n`;
        if (ms.pending.length > 0) reviewPrompt += `Pending: ${ms.pending.join(", ")}\n`;
        reviewPrompt += `\n`;
      }

      // Check for new human comments mid-run
      const newComments = extractComments(currentContent);
      if (newComments) {
        reviewPrompt += `## New Human Comments\n${newComments}\n\n`;
        const cleared = clearComments(currentContent);
        writeFileSync(projectFile, cleared, "utf-8");
      }

      reviewPrompt += `Evaluate and provide your next decision.`;

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
      decision = extractDecision(orchestratorText);
      if (decision.status === "unknown") {
        ctx.log("[review] Decision unclear — treating as CONTINUE");
        decision.status = "continue";
      }
      ctx.log(`[review] Decision: ${decision.status.toUpperCase()}`);

      // ── Milestone tracking ──
      let updatedContent = readFileSync(projectFile, "utf-8");
      updatedContent = checkOffMilestones(updatedContent, orchestratorText);
      writeFileSync(projectFile, updatedContent, "utf-8");

      const newMs = extractMilestones(updatedContent);
      if (newMs.done > prevDoneCount) {
        ctx.log(`[milestone] ${newMs.done}/${newMs.total} complete (+${newMs.done - prevDoneCount})`);
        stallCount = 0;
      } else if (decision.status === "continue") {
        stallCount++;
      }
      prevDoneCount = newMs.done;

      // ── All milestones done → stop regardless of orchestrator decision ──
      if (newMs.total > 0 && newMs.pending.length === 0) {
        ctx.log(`[done] All ${newMs.total} milestones complete — finishing`);
        decision = { status: "done", detail: `All ${newMs.total} milestones complete` };
        break;
      }

      // ── Progress stall detection ──
      if (stallCount >= MAX_STALL_ITERATIONS && decision.status === "continue") {
        ctx.log(`[stall] ${stallCount} iterations without milestone progress — escalating`);
        const reason = `Stalled: ${stallCount} iterations without milestone progress. ${newMs.done}/${newMs.total} milestones done.`;
        updateProjectStatus(projectFile, "blocked", reason, iteration);
        return ctx.escalate(reason);
      }

      // Append orchestrator decision to journal
      appendFileSync(journalFile, `**Orchestrator**: ${decision.detail.slice(0, 300)}\n`, "utf-8");

      // Update iteration count in project.md
      updateProjectStatus(projectFile, "active", undefined, iteration);
    }

    // ── Wrap up ──
    const finalMs = extractMilestones(readFileSync(projectFile, "utf-8"));
    let finalStatus: string;
    let stopReason: string;

    if (decision.status === "done" || (finalMs.total > 0 && finalMs.pending.length === 0)) {
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

// ── Project file updates ────────────────────────────────────────────────

function updateProjectStatus(
  projectFile: string,
  status: string,
  reason?: string,
  iteration?: number,
) {
  let content = readFileSync(projectFile, "utf-8");

  // Update Status field
  content = content.replace(/^\*\*Status\*\*:\s*.+$/m, `**Status**: ${status}`);

  // Update/add Stop Reason
  if (reason !== undefined) {
    if (content.includes("**Stop Reason**:")) {
      content = content.replace(/^\*\*Stop Reason\*\*:\s*.+$/m, `**Stop Reason**: ${reason}`);
    } else {
      content = content.replace(/^(\*\*Status\*\*:\s*.+)$/m, `$1\n**Stop Reason**: ${reason}`);
    }
  }

  // Update/add iteration count
  if (iteration !== undefined) {
    if (content.includes("**Iteration**:")) {
      content = content.replace(/^\*\*Iteration\*\*:\s*.+$/m, `**Iteration**: ${iteration}`);
    } else {
      content = content.replace(/^(\*\*Status\*\*:\s*.+)$/m, `$1\n**Iteration**: ${iteration}`);
    }
  }

  // Update Current State section
  if (reason !== undefined) {
    const stateText = `${status}: ${reason}`;
    if (content.includes("## Current State")) {
      content = content.replace(/(## Current State\s*\n)[\s\S]*?(?=\n## |$)/, `$1${stateText}\n`);
    }
  }

  writeFileSync(projectFile, content, "utf-8");
}
