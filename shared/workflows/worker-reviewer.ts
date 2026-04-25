/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * worker-reviewer — Worker drives, reviewer watches and course-corrects.
 *
 * Pattern B: Worker has full tools and does heavy lifting.
 * Reviewer is read-only, provides strategic guidance after each iteration.
 * Worker sees the project goal but NOT milestones or project status.
 */

import { readFileSync, existsSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";

export const name: string = "worker-reviewer";
export const description: string =
  "Worker-driven workflow: worker does heavy lifting, reviewer course-corrects.";

// ── Helpers (same as master-worker) ─────────────────────────────────────

function extractField(content: string, field: string): string {
  const m = content.match(new RegExp(`^\\*\\*${field}\\*\\*:\\s*(.+)`, "m"));
  return m ? m[1].trim() : "";
}

function extractSection(content: string, heading: string): string {
  const lines = content.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(`^##\\s+${heading}`, "i").test(lines[i])) { start = i + 1; break; }
  }
  if (start === -1) return "";
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (/^## /.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join("\n").trim();
}

interface MilestoneState {
  total: number;
  done: number;
  pending: string[];
  completed: string[];
}

function extractMilestones(content: string): MilestoneState {
  const section = extractSection(content, "Milestones");
  const lines = section.split("\n").filter(l => /^\s*-\s*\[/.test(l));
  const completed = lines.filter(l => /\[x\]/i.test(l)).map(l => l.replace(/^\s*-\s*\[x\]\s*/i, "").trim());
  const pending = lines.filter(l => /\[ \]/.test(l)).map(l => l.replace(/^\s*-\s*\[ \]\s*/i, "").trim());
  return { total: lines.length, done: completed.length, pending, completed };
}

function extractComments(content: string): string {
  return extractSection(content, "Comments");
}

function clearComments(content: string): string {
  const lines = content.split("\n");
  let start = -1, end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (/^## Comments/i.test(lines[i])) { start = i + 1; }
    if (start > 0 && i > start && /^## /.test(lines[i])) { end = i; break; }
  }
  if (start === -1) return content;
  return [...lines.slice(0, start), "", ...lines.slice(end)].join("\n");
}

function updateProjectStatus(file: string, status: string, stopReason?: string, iteration?: number): void {
  let content = readFileSync(file, "utf-8");
  content = content.replace(/^\*\*Status\*\*:.*$/m, `**Status**: ${status}`);
  if (stopReason) {
    if (/^\*\*Stop Reason\*\*:/m.test(content)) {
      content = content.replace(/^\*\*Stop Reason\*\*:.*$/m, `**Stop Reason**: ${stopReason}`);
    } else {
      content = content.replace(/^\*\*Status\*\*:.*$/m, `**Status**: ${status}\n**Stop Reason**: ${stopReason}`);
    }
  }
  if (iteration !== undefined) {
    content = content.replace(/^\*\*Iteration\*\*:.*$/m, `**Iteration**: ${iteration}`);
  }
  writeFileSync(file, content, "utf-8");
}

function checkOffMilestones(content: string, reviewerText: string): string {
  const completedKeys: string[] = [];
  const completionPatterns = [
    /(?:milestone completed|completed milestone|milestone done)[:\s]+["']?(.+?)["']?$/gim,
    /✅\s*["']?(.+?)["']?$/gm,
    /\[x\]\s*(.+)$/gm,
  ];
  for (const pat of completionPatterns) {
    for (const m of reviewerText.matchAll(pat)) {
      completedKeys.push(m[1].trim().slice(0, 30).toLowerCase());
    }
  }
  if (completedKeys.length === 0) return content;
  const lines = content.split("\n");
  let inMilestones = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s*Milestones/i.test(lines[i])) { inMilestones = true; continue; }
    if (inMilestones && /^##\s/.test(lines[i])) break;
    if (!inMilestones) continue;
    const m = lines[i].match(/^(\s*-\s*)\[ \]\s*(.+)/i);
    if (m) {
      const key = m[2].trim().slice(0, 30).toLowerCase();
      if (completedKeys.some(ck => key.startsWith(ck) || ck.startsWith(key))) {
        lines[i] = lines[i].replace("[ ]", "[x]");
      }
    }
  }
  return lines.join("\n");
}

// ── System prompts ──────────────────────────────────────────────────────

function workerSystemPrompt(workspaceDir: string, goal: string): string {
  return `You are the primary worker on a project. You drive progress by producing concrete deliverables.

Your working directory: ${workspaceDir}

## Project Goal
${goal}

Rules:
- Produce concrete deliverables (files, code, test results)
- After each task, summarize what you created and what's left to do
- If stuck, explain what's blocking you
- Do NOT edit project.md or journal.md`;
}

function reviewerSystemPrompt(projectDir: string): string {
  return `You are a reviewer watching a worker's progress on a project.
Your role: evaluate output quality, suggest course corrections, declare milestones complete.

The project directory is: ${projectDir}
You can READ files to verify the worker's claims. Do NOT edit files.

After reviewing worker output, respond with one of these decisions as the FIRST WORD:
CONTINUE — worker is making progress, give specific guidance for next step
PIVOT — current approach isn't working, suggest alternative
DONE — all milestones verified complete with real deliverables
WAITING — needs external input
BLOCKED — stuck on external dependency

When a milestone is genuinely complete (you verified the deliverable exists and works), declare it:
"Milestone completed: <exact milestone text from project.md>"

Be strict: only declare milestones complete when you've verified the deliverable, not when the worker claims it.`;
}

// ── Main ────────────────────────────────────────────────────────────────

const MAX_ITERATIONS = 50;
const MAX_STALL = 3;

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectMatch = ctx.task?.match(/project:\s*(\S+)/);
  if (!projectMatch) return ctx.escalate("Usage: project: <path>");

  const projectDir = projectMatch[1];
  const projectFile = join(projectDir, "project.md");
  const journalFile = join(projectDir, "journal.md");

  if (!existsSync(projectFile)) return ctx.escalate(`No project.md at ${projectFile}`);
  if (!existsSync(journalFile)) writeFileSync(journalFile, "# Journal\n", "utf-8");

  let projectContent = readFileSync(projectFile, "utf-8");
  const goal = extractSection(projectContent, "Goal") || extractField(projectContent, "Goal") || "See project.md";
  const status = extractField(projectContent, "Status").toLowerCase() || "active";
  const initialMs = extractMilestones(projectContent);

  if (["done", "cancelled", "paused"].includes(status)) {
    return ctx.done(`Project is ${status}.`);
  }

  ctx.log(`[worker-reviewer] ${projectDir} | status: ${status} | milestones: ${initialMs.done}/${initialMs.total}`);

  // Create sessions
  const worker = await ctx.createSession({
    systemPrompt: workerSystemPrompt(dirname(projectDir), goal),
    tools: "full",
    label: "worker",
  });

  const reviewer = await ctx.createSession({
    systemPrompt: reviewerSystemPrompt(projectDir),
    tools: "readonly",
    label: "reviewer",
  });

  try {
    let iteration = 0;
    let stallCount = 0;
    let prevDoneCount = initialMs.done;
    let decision = { status: "continue" as string, detail: "" };

    // Worker gets first task from project goal + pending milestones
    let workerTask = `Start working on this project.\n\n## Pending work\n`;
    if (initialMs.pending.length > 0) {
      workerTask += initialMs.pending.map(m => `- ${m}`).join("\n");
    }

    // Handle comments
    const comments = extractComments(projectContent);
    if (comments) {
      workerTask += `\n\n## Notes from reviewer\n${comments}`;
      projectContent = clearComments(projectContent);
      writeFileSync(projectFile, projectContent, "utf-8");
    }

    while (iteration < MAX_ITERATIONS && (decision.status === "continue" || decision.status === "pivot")) {
      iteration++;
      ctx.log(`[work] Iteration ${iteration} starting...`);

      // Worker works
      await worker.prompt(workerTask);
      const workerOutput = worker.lastText();
      const workerSummary = workerOutput.length > 1500 ? workerOutput.slice(0, 1500) + "..." : workerOutput;
      ctx.log(`[work] Iteration ${iteration} done`);

      // Journal
      appendFileSync(journalFile, `\n### Iteration ${iteration} — ${new Date().toISOString()}\n**Worker**: ${workerSummary.slice(0, 500)}\n`, "utf-8");

      // Reviewer evaluates
      ctx.log(`[review] Reviewing iteration ${iteration}...`);
      const currentContent = readFileSync(projectFile, "utf-8");
      const ms = extractMilestones(currentContent);

      let reviewPrompt = `## Worker Output (Iteration ${iteration})\n${workerSummary}\n\n`;
      reviewPrompt += `## Milestones (${ms.done}/${ms.total})\n`;
      if (ms.completed.length > 0) reviewPrompt += `Done: ${ms.completed.join(", ")}\n`;
      if (ms.pending.length > 0) reviewPrompt += `Pending: ${ms.pending.join(", ")}\n`;
      reviewPrompt += `\nVerify the worker's claims by reading the actual files. Then decide.`;

      await reviewer.prompt(reviewPrompt);
      const reviewerText = reviewer.lastText();

      // Extract decision
      const decisionMatch = reviewerText.match(/^(CONTINUE|PIVOT|DONE|WAITING|BLOCKED)/im);
      decision = {
        status: decisionMatch ? decisionMatch[1].toLowerCase() : "continue",
        detail: reviewerText.slice(0, 300),
      };
      ctx.log(`[review] Decision: ${decision.status.toUpperCase()}`);

      // Check off milestones from reviewer declarations
      let updatedContent = readFileSync(projectFile, "utf-8");
      updatedContent = checkOffMilestones(updatedContent, reviewerText);
      writeFileSync(projectFile, updatedContent, "utf-8");

      const newMs = extractMilestones(updatedContent);
      if (newMs.done > prevDoneCount) {
        ctx.log(`[milestone] ${newMs.done}/${newMs.total} (+${newMs.done - prevDoneCount})`);
        stallCount = 0;
      } else if (decision.status === "continue") {
        stallCount++;
      }
      prevDoneCount = newMs.done;

      // All milestones done → stop
      if (newMs.total > 0 && newMs.pending.length === 0) {
        ctx.log(`[done] All ${newMs.total} milestones complete`);
        decision = { status: "done", detail: `All ${newMs.total} milestones complete` };
        break;
      }

      // Stall detection
      if (stallCount >= MAX_STALL && decision.status === "continue") {
        ctx.log(`[stall] ${stallCount} iterations without progress`);
        updateProjectStatus(projectFile, "blocked", `Stalled: ${stallCount} iterations`, iteration);
        return ctx.escalate(`Stalled after ${stallCount} iterations`);
      }

      // Build next worker task from reviewer guidance
      if (decision.status === "continue" || decision.status === "pivot") {
        workerTask = `## Iteration ${iteration + 1} — Reviewer feedback\n${reviewerText}`;
      }

      appendFileSync(journalFile, `**Reviewer**: ${decision.detail.slice(0, 300)}\n`, "utf-8");
      updateProjectStatus(projectFile, "active", undefined, iteration);
    }

    // Wrap up
    const finalMs = extractMilestones(readFileSync(projectFile, "utf-8"));
    let finalStatus = decision.status === "done" || finalMs.pending.length === 0 ? "done" : decision.status;
    let stopReason = finalMs.pending.length === 0 ? `All ${finalMs.total} milestones complete` : decision.detail.slice(0, 200);
    updateProjectStatus(projectFile, finalStatus, stopReason, iteration);

    return finalStatus === "blocked" ? ctx.escalate(stopReason) : ctx.done(`${finalStatus}: ${stopReason}`);

  } finally {
    reviewer.close();
    worker.close();
  }
}
