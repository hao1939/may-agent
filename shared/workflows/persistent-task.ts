/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * persistent-task — Run a task in a loop until done, blocked, or owner intervenes.
 *
 * The project markdown file IS the state, audit log, and human dashboard.
 * Each iteration: worker does a chunk → result appended to file → owner reviews.
 * Owner can steer/pause/cancel by editing the project file's Status field.
 *
 * Design docs:
 *   - agents/shared/may-agent-docs/design/persistent-task.md (Bob's spec)
 *   - agents/shared/may-agent-docs/design/persistent-task-amendments.md (Hao's overrides)
 *
 * Input format:
 *   project: <path to project markdown file>
 *   owner: <agent name>         — reviews iterations (or use 'agent:' for both)
 *   worker: <agent name>        — does the work
 *   goal: <one-line goal>
 *   maxIterations: 200          — optional, default 200 (emergency brakes)
 *   reviewEvery: 1              — optional, default 1
 *
 * Short form (owner = worker):
 *   project: <path>
 *   agent: <name>
 *   goal: <goal>
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const name: string = "persistent-task";

export const description: string =
  "Run a task in a persistent loop until done or blocked. " +
  "Project markdown file is the state and audit log. " +
  "Owner agent monitors via heartbeat and can steer/pause/cancel.";

// ── Types ──────────────────────────────────────────────────────────────

interface PersistentTaskConfig {
  projectPath: string;
  owner: string;
  worker: string;
  goal: string;
  maxIterations: number;
  reviewEvery: number;
}

interface ProjectState {
  status: string;
  lastIteration: number;
  /** true if last iteration has worker result but no assessment */
  pendingReview: boolean;
}

// ── Input parsing ──────────────────────────────────────────────────────

function parseInput(raw: string, callingAgent: string): PersistentTaskConfig {
  const field = (name: string): string | undefined => {
    const m = raw.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
    return m ? m[1].trim() : undefined;
  };

  const projectPath = field("project");
  if (!projectPath) throw new Error("Missing required field: project");

  const goal = field("goal");
  if (!goal) throw new Error("Missing required field: goal");

  // owner/worker or agent (short form)
  const agent = field("agent");
  const owner = field("owner") ?? agent ?? callingAgent;
  const worker = field("worker") ?? agent ?? callingAgent;

  const maxIterations = parseInt(field("maxIterations") ?? "200", 10);
  const reviewEvery = parseInt(field("reviewEvery") ?? "1", 10);

  return { projectPath, owner, worker, goal, maxIterations, reviewEvery };
}

// ── Markdown helpers ───────────────────────────────────────────────────

function readProjectFile(path: string): string | null {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

function writeProjectFile(path: string, content: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, content, "utf-8");
}

function parseProjectState(content: string): ProjectState {
  // Extract Status field
  const statusMatch = content.match(/^\*\*Status\*\*:\s*(.+)$/m);
  const status = statusMatch ? statusMatch[1].trim().toLowerCase() : "active";

  // Find highest iteration number
  const iterHeaders = [...content.matchAll(/^### Iteration (\d+)/gm)];
  const lastIteration = iterHeaders.length > 0
    ? Math.max(...iterHeaders.map(m => parseInt(m[1], 10)))
    : 0;

  // Check if last iteration has a pending review (worker result but no assessment)
  let pendingReview = false;
  if (lastIteration > 0) {
    const lastIterRegex = new RegExp(
      `### Iteration ${lastIteration}[\\s\\S]*?(?=### Iteration \\d+|## Outcome|$)`
    );
    const lastIterBlock = content.match(lastIterRegex);
    if (lastIterBlock) {
      const hasWorkerResult = /\*\*Worker result\*\*:/.test(lastIterBlock[0]);
      const hasAssessment = /\*\*Owner assessment\*\*:/.test(lastIterBlock[0]);
      pendingReview = hasWorkerResult && !hasAssessment;
    }
  }

  return { status, lastIteration, pendingReview };
}

function createProjectFile(config: PersistentTaskConfig): string {
  const now = new Date().toISOString();
  return `# Task: ${config.goal}

**Status**: active
**Owner**: ${config.owner}
**Worker**: ${config.worker}
**Started**: ${now}
**Updated**: ${now}
**Iteration**: 0

## Goal
${config.goal}

## Progress Log

## Current State
Not started.

## Outcome
`;
}

function updateField(content: string, field: string, value: string): string {
  const regex = new RegExp(`^(\\*\\*${field}\\*\\*:\\s*).*$`, "m");
  if (regex.test(content)) {
    return content.replace(regex, `$1${value}`);
  }
  return content;
}

function appendIterationWorker(
  content: string,
  iteration: number,
  taskSummary: string,
  workerResult: string,
  filesTouched: string,
): string {
  const now = new Date().toISOString();
  const block =
    `\n### Iteration ${iteration} — ${now}\n` +
    `**Worker task**: ${taskSummary}\n` +
    `**Worker result**: ${workerResult}\n` +
    `**Files touched**: ${filesTouched}\n`;

  // Insert before ## Current State or ## Outcome
  const insertPoint = content.search(/^## (Current State|Outcome)/m);
  if (insertPoint === -1) {
    return content + block;
  }
  return content.slice(0, insertPoint) + block + "\n" + content.slice(insertPoint);
}

function appendAssessment(content: string, iteration: number, assessment: string): string {
  // Find the iteration block and append the assessment
  const iterHeader = `### Iteration ${iteration}`;
  const idx = content.indexOf(iterHeader);
  if (idx === -1) return content + `\n${assessment}\n`;

  // Find the next iteration header or section header after this one
  const afterHeader = idx + iterHeader.length;
  const nextSection = content.slice(afterHeader).search(/^### Iteration \d+|^## (Current State|Outcome)/m);
  const insertAt = nextSection === -1 ? content.length : afterHeader + nextSection;

  return content.slice(0, insertAt) + `**Owner assessment**: ${assessment}\n\n` + content.slice(insertAt);
}

function updateCurrentState(content: string, state: string): string {
  const regex = /^## Current State\n[\s\S]*?(?=\n## |\n$)/m;
  if (regex.test(content)) {
    return content.replace(regex, `## Current State\n${state}`);
  }
  return content;
}

// ── Prompt builders ────────────────────────────────────────────────────

function buildWorkerPrompt(
  projectContent: string,
  iteration: number,
  goal: string,
  lastGuidance: string | null,
): string {
  // Extract last 3 iterations for context
  const iterBlocks: string[] = [];
  for (let i = Math.max(1, iteration - 3); i < iteration; i++) {
    const regex = new RegExp(
      `### Iteration ${i}[\\s\\S]*?(?=### Iteration \\d+|## Current State|## Outcome|$)`
    );
    const match = projectContent.match(regex);
    if (match) iterBlocks.push(match[0].trim());
  }

  let prompt = `You are working on iteration ${iteration} of a persistent task.\n\n`;
  prompt += `## Goal\n${goal}\n\n`;

  if (iterBlocks.length > 0) {
    prompt += `## Recent Progress (last ${iterBlocks.length} iterations)\n`;
    prompt += iterBlocks.join("\n\n") + "\n\n";
  }

  if (lastGuidance) {
    prompt += `## Owner Guidance for This Iteration\n${lastGuidance}\n\n`;
  }

  prompt += `## Instructions\n`;
  prompt += `Do a meaningful chunk of work toward the goal. `;
  prompt += `When done, summarize what you accomplished and what files you modified.`;

  return prompt;
}

function buildReviewPrompt(
  goal: string,
  iteration: number,
  workerSummary: string,
  recentProgress: string,
): string {
  let prompt = `[REVIEW ONLY — no file edits expected. You are assessing worker output, not writing code.]\n\n`;
  prompt += `You are reviewing iteration ${iteration} of a persistent task.\n\n`;
  prompt += `## Goal\n${goal}\n\n`;

  if (recentProgress) {
    prompt += `## Recent Progress\n${recentProgress}\n\n`;
  }

  prompt += `## Latest Worker Output (Iteration ${iteration})\n${workerSummary}\n\n`;

  prompt += `## Your Assessment\n`;
  prompt += `Assess the current state:\n`;
  prompt += `1. Is the goal achieved? If yes, respond starting with DONE and a summary.\n`;
  prompt += `2. Is the task blocked on something the worker can't resolve? If yes, respond starting with BLOCKED and the reason.\n`;
  prompt += `3. Otherwise, respond starting with CONTINUE and specific guidance for the next iteration.\n\n`;
  prompt += `Your response MUST start with one of: DONE, BLOCKED, CONTINUE`;

  return prompt;
}

function extractDecision(text: string): { status: "done" | "blocked" | "continue"; detail: string } {
  const trimmed = (text ?? "").trim();
  if (/^DONE\b/i.test(trimmed)) {
    return { status: "done", detail: trimmed.replace(/^DONE[:\s]*/i, "").trim() };
  }
  if (/^BLOCKED\b/i.test(trimmed)) {
    return { status: "blocked", detail: trimmed.replace(/^BLOCKED[:\s]*/i, "").trim() };
  }
  // Default to continue (safest — owner can always pause via Status field)
  const detail = trimmed.replace(/^CONTINUE[:\s]*/i, "").trim();
  return { status: "continue", detail: detail || "Continue working toward the goal." };
}

// ── Extract recent guidance from project content ───────────────────────

function getLastGuidance(content: string, iteration: number): string | null {
  // Find the assessment from the previous iteration
  const prevIter = iteration - 1;
  if (prevIter < 1) return null;

  const regex = new RegExp(
    `### Iteration ${prevIter}[\\s\\S]*?\\*\\*Owner assessment\\*\\*:\\s*(.+?)(?=\\n### Iteration|\\n## |$)`,
    "s"
  );
  const match = content.match(regex);
  if (!match) return null;

  const assessment = match[1].trim();
  // Strip the CONTINUE prefix to get just the guidance
  return assessment.replace(/^CONTINUE[:\s]*/i, "").trim() || null;
}

// ── Main workflow ──────────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Parse input
  const config = parseInput(ctx.task, ctx.agent);

  // Read or create project file
  let content = readProjectFile(config.projectPath);
  if (!content) {
    content = createProjectFile(config);
    writeProjectFile(config.projectPath, content);
  }

  let state = parseProjectState(content);

  // Check for active/stale lock (§4.6 — heuristic, not mutex)
  if (state.status === "active" && state.lastIteration > 0) {
    const updatedMatch = content.match(/^\*\*Updated\*\*:\s*(.+)$/m);
    if (updatedMatch) {
      const lastUpdated = new Date(updatedMatch[1].trim()).getTime();
      if (Date.now() - lastUpdated < 30 * 60_000) {
        return ctx.escalate(
          `Project appears to be actively running (updated ${updatedMatch[1].trim()}). ` +
          `Wait 30 minutes or manually set Status to paused.`
        );
      }
    }
  }

  // Handle owner-paused or cancelled
  if (state.status === "paused") {
    return ctx.done(`Task is paused. Owner can resume by setting Status back to active.`);
  }
  if (state.status === "cancelled") {
    return ctx.done(`Task was cancelled by owner.`);
  }
  if (state.status === "done") {
    return ctx.done(`Task is already done.`);
  }

  // Determine starting iteration
  let iteration = state.lastIteration + 1;
  // If there's a pending review (crash recovery §4.5), start with review
  let skipWorkerPhase = state.pendingReview;
  if (skipWorkerPhase) {
    iteration = state.lastIteration; // re-review this iteration
  }

  let consecutiveFailures = 0;

  // Mark active
  content = updateField(content, "Status", "active");
  writeProjectFile(config.projectPath, content);

  while (iteration <= config.maxIterations) {
    // ── Check owner intervention between iterations ──────────────
    content = readProjectFile(config.projectPath)!;
    state = parseProjectState(content);

    if (state.status === "paused") {
      return ctx.done(`Paused by owner at iteration ${iteration}.`);
    }
    if (state.status === "cancelled") {
      return ctx.done(`Cancelled by owner at iteration ${iteration}.`);
    }

    // ── Worker phase ─────────────────────────────────────────────
    if (!skipWorkerPhase) {
      ctx.emit({ type: "step_start", step: `worker-iteration-${iteration}` });

      const lastGuidance = getLastGuidance(content, iteration);
      const workerPrompt = buildWorkerPrompt(content, iteration, config.goal, lastGuidance);

      const workerResult = await ctx.runAgent(config.worker, workerPrompt);

      if (workerResult.status === "error") {
        consecutiveFailures++;
        if (consecutiveFailures >= 2) {
          // Mark blocked in project file
          content = updateField(content, "Status", "blocked");
          content = updateField(content, "Updated", new Date().toISOString());
          content = updateCurrentState(content, `Blocked: Worker failed ${consecutiveFailures} consecutive times.`);
          writeProjectFile(config.projectPath, content);
          return ctx.escalate(`Worker failed ${consecutiveFailures}x consecutively at iteration ${iteration}.`);
        }
        // Retry once — don't increment iteration
        continue;
      }
      consecutiveFailures = 0;

      // Persist worker output BEFORE review (crash safety §4.5)
      const workerSummary = ctx.summarize(workerResult, { maxLength: 3000 });
      const truncatedResult = ctx.summarize(workerResult, { maxLength: 1500 });

      // Extract file paths from worker result
      const workerText = workerResult.lastAssistantText ?? "";
      const fileMatches = workerText.match(/(?:^|\s)((?:[\w./-]+\/)*[\w.-]+\.\w{1,10})(?=[\s,;:)]|$)/gm);
      const filesTouched = fileMatches
        ? [...new Set(fileMatches.map((f: string) => f.trim()))].slice(0, 20).join(", ")
        : "(see worker session)";

      content = appendIterationWorker(
        content,
        iteration,
        `Iteration ${iteration} — work toward goal`,
        truncatedResult,
        filesTouched,
      );
      content = updateField(content, "Updated", new Date().toISOString());
      content = updateField(content, "Iteration", String(iteration));
      content = updateCurrentState(content, `Iteration ${iteration} complete. ${truncatedResult.slice(0, 200)}`);
      writeProjectFile(config.projectPath, content);
    }
    skipWorkerPhase = false; // only skip once (crash recovery)

    // ── Owner review phase ───────────────────────────────────────
    if (iteration % config.reviewEvery === 0) {
      ctx.emit({ type: "step_start", step: `review-iteration-${iteration}` });

      // Build recent progress for review
      const recentBlocks: string[] = [];
      for (let i = Math.max(1, iteration - 2); i <= iteration; i++) {
        const regex = new RegExp(
          `### Iteration ${i}[\\s\\S]*?(?=### Iteration \\d+|## Current State|## Outcome|$)`
        );
        const match = content.match(regex);
        if (match) recentBlocks.push(match[0].trim());
      }

      // Re-read content (worker may have modified project file)
      content = readProjectFile(config.projectPath)!;

      const reviewPrompt = buildReviewPrompt(
        config.goal,
        iteration,
        recentBlocks[recentBlocks.length - 1] ?? "(no worker output)",
        recentBlocks.join("\n\n"),
      );

      const reviewResult = await ctx.runAgent(config.owner, reviewPrompt);

      // If review errors, treat as CONTINUE (don't let review failures kill the task §4.1)
      if (reviewResult.status === "error") {
        content = appendAssessment(content, iteration, "CONTINUE — review errored, auto-continuing");
        content = updateField(content, "Updated", new Date().toISOString());
        writeProjectFile(config.projectPath, content);
        iteration++;
        continue;
      }

      const decision = extractDecision(reviewResult.lastAssistantText ?? "");

      // Persist assessment
      content = appendAssessment(content, iteration, `${decision.status.toUpperCase()} — ${decision.detail}`);
      content = updateField(content, "Updated", new Date().toISOString());
      writeProjectFile(config.projectPath, content);

      if (decision.status === "done") {
        content = updateField(content, "Status", "done");
        content = updateCurrentState(content, decision.detail);
        writeProjectFile(config.projectPath, content);
        return ctx.done(`Complete after ${iteration} iterations: ${decision.detail}`);
      }

      if (decision.status === "blocked") {
        content = updateField(content, "Status", "blocked");
        content = updateCurrentState(content, `Blocked: ${decision.detail}`);
        writeProjectFile(config.projectPath, content);
        return ctx.escalate(`Blocked at iteration ${iteration}: ${decision.detail}`);
      }

      // CONTINUE — guidance is captured in the assessment for next iteration
    } else {
      // Auto-continue (no review this iteration)
      content = appendAssessment(content, iteration, "CONTINUE — auto (review skipped)");
      content = updateField(content, "Updated", new Date().toISOString());
      writeProjectFile(config.projectPath, content);
    }

    iteration++;
  }

  // Iteration cap reached — not a failure, just a pause
  content = updateField(content, "Status", "paused");
  content = updateCurrentState(
    content,
    `Paused: reached ${config.maxIterations} iteration cap. Resume by re-running.`,
  );
  writeProjectFile(config.projectPath, content);

  return ctx.done(
    `Paused after ${config.maxIterations} iterations (emergency cap). ` +
    `Project file preserved at ${config.projectPath}. Resume by re-running.`
  );
}
