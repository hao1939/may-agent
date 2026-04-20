/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * persistent-task — Run a task in a loop until done, blocked, or owner intervenes.
 *
 * File structure (directory per project):
 *   <project-dir>/project.md   — goal, milestones, state, comments (field-level updates only)
 *   <project-dir>/journal.md   — iteration log (append-only)
 *
 * Legacy: single .md file still supported (detected by file extension).
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

export const name: string = "persistent-task";

export const description: string =
  "Run a task in a persistent loop until done or blocked. " +
  "Project directory has project.md (spec) + journal.md (log). " +
  "Owner agent monitors and can steer/pause/cancel.";

// ── Types ──────────────────────────────────────────────────────────────

interface PersistentTaskConfig {
  projectDir: string;       // directory containing project.md + journal.md
  projectPath: string;      // path to project.md
  journalPath: string;      // path to journal.md
  owner: string;
  worker: string;
  goal: string;
  maxIterations: number;
  reviewEvery: number;
  isLegacy: boolean;        // true if single-file format
}

interface ProjectState {
  status: string;
  lastIteration: number;
}

// ── Input parsing ──────────────────────────────────────────────────────

function parseInput(raw: string, callingAgent: string): PersistentTaskConfig {
  const field = (name: string): string | undefined => {
    const m = raw.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
    return m ? m[1].trim() : undefined;
  };

  const projectInput = field("project");
  if (!projectInput) throw new Error("Missing required field: project");

  // Detect format: directory (new) vs file (legacy)
  let projectDir: string;
  let projectPath: string;
  let journalPath: string;
  let isLegacy = false;

  if (projectInput.endsWith(".md")) {
    // Legacy: single file
    isLegacy = true;
    projectDir = dirname(projectInput);
    projectPath = projectInput;
    journalPath = projectInput; // journal goes in same file for legacy
  } else {
    // New: directory format
    projectDir = projectInput;
    projectPath = join(projectInput, "project.md");
    journalPath = join(projectInput, "journal.md");
  }

  let goal = field("goal");
  // Read goal from project file if generic
  if (!goal || goal === "see project file" || goal === "continue the project") {
    try {
      const content = readFileSync(projectPath, "utf-8");
      const goalText = extractSection(content, "Goal");
      if (goalText) goal = goalText.split("\n")[0];
    } catch { /* file may not exist yet */ }
  }
  if (!goal) {
    // For legacy projects, use the project name as fallback
    goal = projectInput.replace(/\.md$/, "").split("/").pop() ?? "unknown project";
  }

  const agent = field("agent");
  const owner = field("owner") ?? agent ?? callingAgent;
  const worker = field("worker") ?? agent ?? callingAgent;
  const maxIterations = parseInt(field("maxIterations") ?? "200", 10);
  const reviewEvery = parseInt(field("reviewEvery") ?? "1", 10);

  return { projectDir, projectPath, journalPath, owner, worker, goal, maxIterations, reviewEvery, isLegacy };
}

// ── File helpers ───────────────────────────────────────────────────────

function readFile(path: string): string | null {
  try { return readFileSync(path, "utf-8"); } catch { return null; }
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function updateField(content: string, field: string, value: string): string {
  const regex = new RegExp(`^(\\*\\*${field}\\*\\*:\\s*).*$`, "m");
  if (regex.test(content)) return content.replace(regex, `$1${value}`);
  // Insert after the last ** field before ## sections
  const insertPoint = content.search(/^## /m);
  if (insertPoint > 0) {
    return content.slice(0, insertPoint) + `**${field}**: ${value}\n` + content.slice(insertPoint);
  }
  return content;
}

/** Extract text under a ## heading, up to the next ## heading or end of file. */
function extractSection(content: string, heading: string): string {
  const marker = `## ${heading}\n`;
  const idx = content.indexOf(marker);
  if (idx === -1) return "";
  const after = content.slice(idx + marker.length);
  const nextSection = after.indexOf("\n## ");
  return (nextSection === -1 ? after : after.slice(0, nextSection)).trim();
}

function updateSection(content: string, heading: string, newContent: string): string {
  const marker = `## ${heading}\n`;
  const idx = content.indexOf(marker);
  if (idx === -1) return content + `\n\n## ${heading}\n${newContent}`;
  const after = content.slice(idx + marker.length);
  const nextSection = after.indexOf("\n## ");
  const end = nextSection === -1 ? content.length : idx + marker.length + nextSection;
  return content.slice(0, idx + marker.length) + newContent + content.slice(end);
}

function appendToSection(content: string, heading: string, line: string): string {
  const idx = content.indexOf(`## ${heading}`);
  if (idx === -1) return content + `\n\n## ${heading}\n${line}\n`;
  // Find end of section
  const afterHeading = content.indexOf("\n", idx) + 1;
  const nextSection = content.slice(afterHeading).search(/\n## /);
  const insertAt = nextSection === -1 ? content.length : afterHeading + nextSection;
  return content.slice(0, insertAt) + line + "\n" + content.slice(insertAt);
}

function createProjectDir(config: PersistentTaskConfig): void {
  ensureDir(config.projectDir);
  const now = new Date().toISOString();
  const projectContent = `# Project: ${config.goal}

**Status**: active
**Owner**: ${config.owner}
**Worker**: ${config.worker}
**Priority**: P1
**Started**: ${now}
**Iteration**: 0
**Health**: —

## Goal
${config.goal}

## Milestones

## Current State
Not started.

## Iteration Summary

## Comments
`;
  writeFileSync(config.projectPath, projectContent, "utf-8");
  writeFileSync(config.journalPath, `# Journal\n\n`, "utf-8");
}

function parseProjectState(content: string): ProjectState {
  const statusMatch = content.match(/^\*\*Status\*\*:\s*(.+)$/m);
  const status = statusMatch ? statusMatch[1].trim().toLowerCase().split(" ")[0] : "active";
  const iterHeaders = [...content.matchAll(/^### Iteration (\d+)/gm)];
  // Also check the Iteration field
  const iterField = content.match(/^\*\*Iteration\*\*:\s*(\d+)/m);
  const lastIteration = iterField ? parseInt(iterField[1], 10) :
    (iterHeaders.length > 0 ? Math.max(...iterHeaders.map(m => parseInt(m[1], 10))) : 0);
  return { status, lastIteration };
}

function extractMilestones(content: string): { total: number; done: number; pending: string[] } {
  const milestones: { done: boolean; text: string }[] = [];
  const lines = content.split("\n");
  let inMilestones = false;
  for (const line of lines) {
    if (/^##\s*Milestones/i.test(line)) { inMilestones = true; continue; }
    if (inMilestones && /^##\s/.test(line)) break;
    if (!inMilestones) continue;
    const checkMatch = line.match(/^\s*-\s*\[([ x])\]\s*(.+)/i);
    if (checkMatch) milestones.push({ done: checkMatch[1].toLowerCase() === "x", text: checkMatch[2].trim() });
  }
  return {
    total: milestones.length,
    done: milestones.filter(m => m.done).length,
    pending: milestones.filter(m => !m.done).map(m => m.text),
  };
}

// Check off milestones whose text appears in the reviewer's response
function checkOffMilestones(content: string, reviewerText: string): string {
  const lines = content.split("\n");
  let inMilestones = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s*Milestones/i.test(lines[i])) { inMilestones = true; continue; }
    if (inMilestones && /^##\s/.test(lines[i])) break;
    if (!inMilestones) continue;
    const m = lines[i].match(/^(\s*-\s*)\[ \]\s*(.+)/i);
    if (m) {
      // Check if reviewer text mentions this milestone (fuzzy: first 30 chars)
      const key = m[2].trim().slice(0, 30).toLowerCase();
      if (reviewerText.toLowerCase().includes(key)) {
        lines[i] = lines[i].replace("[ ]", "[x]");
      }
    }
  }
  return lines.join("\n");
}

function extractComments(content: string): string {
  return extractSection(content, "Comments");
}

// Clear the Comments section in project.md after processing
// Track false-done signals for metrics (reset per execute call)

function clearComments(content: string): string {
  return updateSection(content, "Comments", "");
}

// ── Get last reviewer guidance from journal ────────────────────────────

function getLastGuidance(journalContent: string, iteration: number): string | null {
  const prevIter = iteration - 1;
  if (prevIter < 1) return null;
  const regex = new RegExp(
    `### Iteration ${prevIter}[\\s\\S]*?\\*\\*Reviewer\\*\\*:\\s*(.+?)(?=\\n### Iteration|$)`, "s"
  );
  const match = journalContent.match(regex);
  if (!match) return null;
  return match[1].trim().replace(/^CONTINUE[:\s]*/i, "").trim() || null;
}

function getRecentJournalEntries(journalContent: string, iteration: number, count: number): string {
  const entries: string[] = [];
  for (let i = Math.max(1, iteration - count); i < iteration; i++) {
    const regex = new RegExp(`### Iteration ${i}[\\s\\S]*?(?=### Iteration \\d+|$)`);
    const match = journalContent.match(regex);
    if (match) entries.push(match[0].trim());
  }
  return entries.join("\n\n");
}

// ── Prompt builders ────────────────────────────────────────────────────

function buildWorkerPrompt(
  projectContent: string,
  journalContent: string,
  projectPath: string,
  iteration: number,
  goal: string,
  lastGuidance: string | null,
): string {
  const ms = extractMilestones(projectContent);
  const nextMilestone = ms.pending.length > 0 ? ms.pending[0] : null;
  const currentState = extractSection(projectContent, "Current State") || null;
  const recentEntries = getRecentJournalEntries(journalContent, iteration, 3);

  let prompt = `You are working on iteration ${iteration} of a persistent task.\n\n`;
  prompt += `## Goal\n${goal}\n\n`;

  if (ms.total > 0) {
    prompt += `## Milestones (${ms.done}/${ms.total} complete)\n`;
    if (nextMilestone) prompt += `**YOUR TASK THIS ITERATION:** ${nextMilestone}\n\n`;
    if (ms.pending.length > 1) {
      prompt += `Remaining:\n`;
      for (const p of ms.pending.slice(1)) prompt += `- [ ] ${p}\n`;
      prompt += `\n`;
    }
  }

  if (currentState) prompt += `## Current State\n${currentState}\n\n`;
  if (lastGuidance) prompt += `## Owner Guidance for This Iteration\n${lastGuidance}\n\n`;
  if (recentEntries) prompt += `## Recent Progress\n${recentEntries}\n\n`;

  prompt += `## What You Must Produce\n`;
  prompt += `This iteration must end with at least one of:\n`;
  prompt += `1. A milestone completed (create deliverable, verify it works)\n`;
  prompt += `2. A concrete deliverable (file created or modified in workspace)\n`;
  prompt += `3. A specific blocker reported (what exactly is blocking and why)\n\n`;
  prompt += `You CANNOT edit the project file or journal — produce deliverables in your workspace.\n`;

  return prompt;
}

function getAllReviewerGuidance(journalContent: string, iteration: number): string {
  const entries: string[] = [];
  for (let i = 1; i < iteration; i++) {
    const regex = new RegExp(
      `### Iteration ${i}[\\s\\S]*?\\*\\*Reviewer\\*\\*:\\s*(.+?)(?=\\n### Iteration|$)`, "s"
    );
    const match = journalContent.match(regex);
    if (match) {
      const guidance = match[1].trim();
      entries.push(`- **Iteration ${i}**: ${guidance.slice(0, 300)}${guidance.length > 300 ? '...' : ''}`);
    }
  }
  return entries.length > 0 ? entries.join('\n') : '(No previous guidance — this is the first review)';
}

function buildReviewPrompt(
  goal: string,
  iteration: number,
  workerSummary: string,
  projectContent: string,
  journalContent: string,
  continueWithoutProgress: number,
): string {
  const ms = extractMilestones(projectContent);
  const recentEntries = getRecentJournalEntries(journalContent, iteration, 2);
  const previousGuidance = getAllReviewerGuidance(journalContent, iteration);

  let prompt = `[REVIEW ONLY — no file edits expected. Do NOT use edit(), write(), or bash commands that modify files. Only read and analyze.]\n\n`;
  prompt += `You are the PROBLEM-SOLVER for iteration ${iteration} of a persistent task.\n`;
  prompt += `Your job is to unblock the worker and push the project to completion.\n`;
  prompt += `You are NOT a passive evaluator — you are an active strategist.\n`;
  prompt += `If something isn't working, propose an alternative approach.\n`;
  prompt += `Never give the same guidance twice. If previous guidance failed, try a different strategy.\n\n`;
  prompt += `## Goal\n${goal}\n\n`;

  if (ms.total > 0) {
    prompt += `## Milestone Progress: ${ms.done}/${ms.total} complete\n`;
    if (ms.pending.length > 0) {
      prompt += `Remaining:\n`;
      for (const p of ms.pending) prompt += `- [ ] ${p}\n`;
    }
    prompt += `\n`;
  }

  prompt += `## How This System Works (reference)\n`;
  prompt += `- **Milestone check-off**: When you mention a completed milestone by name, the system matches the first 30 characters (case-insensitive) against your response. Include the exact milestone name to check it off.\n`;
  prompt += `- **Evaluator gate**: When you say DONE, an evaluator scores the work 1-10. Score ≥7 passes. It checks: deliverables exist, goal met, concrete evidence present, no shortcuts.\n`;
  prompt += `- **Auto-check override**: If you say DONE but 0 milestones get checked off, the system overrides to CONTINUE. Always mention completed milestone names explicitly.\n`;
  prompt += `- **Worker capabilities**: The worker can read/write files, run bash commands, call sub-agents. It works in the \`.state/\` directory. It CANNOT edit project.md or journal.md directly.\n`;
  prompt += `- **Iteration budget**: Iterations are finite and expensive. Don't waste them repeating failed approaches.\n\n`;

  if (recentEntries) prompt += `## Recent Progress\n${recentEntries}\n\n`;

  prompt += `## Your Previous Guidance (do NOT repeat these)\n${previousGuidance}\n`;
  prompt += `↑ If any of the above guidance didn't produce results, you MUST try a fundamentally different approach.\n\n`;

  const comments = extractComments(projectContent);
  if (comments) prompt += `## Comments (from human/agents — address these in your guidance)\n${comments}\n\n`;

  prompt += `## Latest Worker Output (Iteration ${iteration})\n${workerSummary}\n\n`;

  prompt += `## Your Decision\n`;
  if (continueWithoutProgress >= 2) {
    prompt += `\n⚠️ WARNING: ${continueWithoutProgress} consecutive iterations with no milestone progress. `;
    prompt += `The current approach is not working. You MUST either:\n`;
    prompt += `- PIVOT to a fundamentally different strategy\n`;
    prompt += `- Say BLOCKED only if there's a specific external dependency that no amount of iteration can resolve\n`;
    prompt += `Repeating the same guidance is not acceptable.\n\n`;
  }
  prompt += `Choose ONE:\n\n`;
  prompt += `1. **DONE** — All milestones are genuinely complete.\n`;
  prompt += `   Before saying DONE, verify:\n`;
  prompt += `   (a) You mention each completed milestone by its exact name (for auto-check-off)\n`;
  prompt += `   (b) The worker's output confirms deliverable files exist\n`;
  prompt += `   (c) Quality is sufficient to score ≥7/10 (real artifacts, real evidence, no shortcuts)\n`;
  prompt += `   If any check fails, say CONTINUE with fix instructions instead.\n\n`;
  prompt += `2. **PIVOT** — The current approach has failed. Describe a fundamentally different strategy.\n`;
  prompt += `   Use when: same guidance failed 2+ times, worker is stuck in a loop, the approach has a design flaw.\n`;
  prompt += `   "This is hard" is NOT blocked — that's PIVOT.\n\n`;
  prompt += `3. **BLOCKED** — There is a specific external dependency that no amount of worker iteration can resolve.\n`;
  prompt += `   Examples: missing API key, needs human policy decision, requires access not available.\n\n`;
  prompt += `4. **CONTINUE** — Progress is being made, guide the next iteration.\n\n`;
  prompt += `If CONTINUE or PIVOT, your guidance MUST include all three parts:\n`;
  prompt += `**(a) Concrete output:** What specific file or artifact should the next iteration produce?\n`;
  prompt += `**(b) What's different:** How is this different from your previous guidance? (Say "First attempt" if iteration 1)\n`;
  prompt += `**(c) First step:** One specific action to start with (e.g., "Read file X", "Run command Y")\n\n`;
  prompt += `When milestones are completed, mention them by exact name so they can be checked off.\n`;
  prompt += `Your response MUST start with: DONE, PIVOT, BLOCKED, or CONTINUE`;

  return prompt;
}

function buildEvalPrompt(
  goal: string,
  projectContent: string,
  journalContent: string,
  iteration: number,
  milestoneNote?: string,
): string {
  const ms = extractMilestones(projectContent);
  const recentEntries = getRecentJournalEntries(journalContent, iteration, 5);

  let prompt = `[EVALUATION — you are a REVIEWER, not the worker. Do not do any work. Just assess.]\n\n`;
  prompt += `You are evaluating whether a project's status change is justified.\n`;
  prompt += `You did NOT do this work — a worker agent did. Your job is to judge their output.\n`;
  prompt += `Do NOT confuse yourself with the worker. Do NOT say "I didn't do anything" — YOU are the evaluator, not the doer.\n\n`;
  prompt += `## Goal\n${goal}\n\n`;

  if (ms.total > 0) {
    prompt += `## Milestones (${ms.done}/${ms.total} checked)\n`;
    for (const p of ms.pending) prompt += `- [ ] ${p}\n`;
    prompt += `\n`;
  }

  if (recentEntries) prompt += `## Recent Work\n${recentEntries}\n\n`;

  prompt += `## Evaluate\n`;
  prompt += `Check these criteria:\n`;
  prompt += `1. **Deliverables exist**: Were actual files/artifacts produced? Not just claims.\n`;
  prompt += `2. **Goal met**: Does the work achieve what the goal describes?\n`;
  prompt += `3. **Evidence**: Is there concrete evidence (tool output, file content, test results)?\n`;
  prompt += `4. **Milestones honest**: Are checked milestones genuinely complete?\n`;
  prompt += `5. **No shortcuts**: Did the worker do real work or just claim completion?\n`;
  prompt += `6. **Verification milestones**: If any milestone requires observing, measuring, or verifying something works in production — was it actually observed over time? Building code is not the same as verifying it works. "Implemented auto-fork" ≠ "observed auto-fork fire and agent respond." Score low if verification milestones are claimed done without real observation evidence.\n`;
  prompt += `7. **If blocked**: Is the blocker real and specific? Did the worker try alternatives? Or did they give up too easily?\n`;
  prompt += `8. **Milestone status**: ${milestoneNote || "No milestones defined."}\n`;
  prompt += `\n`;
  prompt += `Your response MUST include:\n`;
  prompt += `SCORE: <1-10> (7+ = genuinely complete, <7 = not done)\n`;
  prompt += `Then explain your reasoning for each criterion.\n`;

  return prompt;
}

function extractDecision(text: string): { status: "done" | "blocked" | "continue"; detail: string } {
  const trimmed = (text ?? "").trim();
  if (/^DONE\b/i.test(trimmed)) return { status: "done", detail: trimmed.replace(/^DONE[:\s]*/i, "").trim() };
  if (/^BLOCKED\b/i.test(trimmed)) return { status: "blocked", detail: trimmed.replace(/^BLOCKED[:\s]*/i, "").trim() };
  if (/^PIVOT\b/i.test(trimmed)) return { status: "continue", detail: `[PIVOT] ${trimmed.replace(/^PIVOT[:\s]*/i, "").trim()}` };
  const detail = trimmed.replace(/^CONTINUE[:\s]*/i, "").trim();
  return { status: "continue", detail: detail || "Continue working toward the goal." };
}

// ── Main workflow ──────────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const config = parseInput(ctx.task, ctx.agent);

  // Create project directory if it doesn't exist
  if (!existsSync(config.projectPath)) {
    createProjectDir(config);
  }
  // Ensure journal exists
  if (!existsSync(config.journalPath) && !config.isLegacy) {
    ensureDir(dirname(config.journalPath));
    writeFileSync(config.journalPath, `# Journal\n\n`, "utf-8");
  }

  let projectContent = readFile(config.projectPath) ?? "";
  let state = parseProjectState(projectContent);

  // Handle non-active states
  if (state.status === "paused") return ctx.done(`Task is paused.`);
  if (state.status === "cancelled") return ctx.done(`Task was cancelled.`);

  // Done/blocked projects: check for pending comments before exiting.
  // Comments can redirect, rescope, or unblock a project.
  const pendingCommentsBeforeStart = extractComments(projectContent);
  if ((state.status === "done" || state.status === "blocked") && !pendingCommentsBeforeStart) {
    return ctx.done(`Task is ${state.status}. No pending comments.`);
  }
  // If there ARE pending comments on a done/blocked project, fall through to the loop
  // so the comment iteration processes them. The comment reviewer can change status.

  let iteration = state.lastIteration + 1;
  let consecutiveFailures = 0;
  let continueWithoutProgress = 0;
  let lastMilestoneDone = extractMilestones(projectContent).done;
  let falseDoneCount = 0;

  // Mark active only if not already done/blocked with pending comments
  // (those need comment iteration to decide the new status)
  if (state.status !== "done" && state.status !== "blocked") {
    projectContent = updateField(projectContent, "Status", "active");
    writeFileSync(config.projectPath, projectContent, "utf-8");
  }

  while (iteration <= config.maxIterations) {
    // Re-read project file (owner may have changed status/comments)
    projectContent = readFile(config.projectPath) ?? projectContent;
    state = parseProjectState(projectContent);

    if (state.status === "paused") return ctx.done(`Paused by owner at iteration ${iteration}.`);
    if (state.status === "cancelled") return ctx.done(`Cancelled by owner at iteration ${iteration}.`);

    // Read journal for context
    const journalContent = config.isLegacy ? projectContent : (readFile(config.journalPath) ?? "");

    // ── Comment iteration ─────────────────────────────────────────
    // Comments in project.md = unprocessed queue. Process then clear.
    const pendingComments = extractComments(projectContent);
    if (pendingComments) {
      ctx.emit({ type: "step_start", step: `comment-iteration-${iteration}` });

      const commentReviewPrompt = buildReviewPrompt(
        config.goal, iteration,
        `[COMMENT ITERATION] Comments to address:\n${pendingComments}`,
        projectContent, journalContent, continueWithoutProgress
      );

      const reviewResult = await ctx.runAgent(config.owner, commentReviewPrompt);
      const decision = extractDecision(reviewResult.status === "error"
        ? "CONTINUE — review errored, auto-continuing"
        : (reviewResult.lastAssistantText ?? ""));

      const now = new Date().toISOString();
      const commentEntry = `### Iteration ${iteration} (comment) — ${now}\n` +
        `**Comment**: ${pendingComments}\n` +
        `**Reviewer**: ${decision.status.toUpperCase()} — ${decision.detail}\n\n`;

      if (config.isLegacy) {
        projectContent += commentEntry;
      } else {
        appendFileSync(config.journalPath, commentEntry);
      }

      // Clear comments — they're now in the journal
      projectContent = clearComments(projectContent);
      projectContent = updateField(projectContent, "Iteration", String(iteration));
      writeFileSync(config.projectPath, projectContent, "utf-8");

      if (decision.status === "done") {
        // LLM evaluation gate
        ctx.emit({ type: "step_start", step: `evaluate-comment-${iteration}` });
        const finalMs = extractMilestones(projectContent);
        const milestoneNote = finalMs.total > 0 ? `Milestones: ${finalMs.done}/${finalMs.total} checked off.` : "";
        const evalPrompt = buildEvalPrompt(config.goal, projectContent, journalContent, iteration, milestoneNote);
        const evalResult = await ctx.runAgent(config.owner, evalPrompt);
        const evalText = evalResult.lastAssistantText ?? "";
        const scoreMatch = evalText.match(/SCORE:\s*(\d+)/i);
        const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
        const evalVerdict = score >= 7 ? "PASS" : "FAIL";

        const evalEntry = `**Evaluator**: ${evalVerdict} (score=${score}/10) — ${evalText.slice(0, 500)}\n\n`;
        if (!config.isLegacy) appendFileSync(config.journalPath, evalEntry);
        projectContent = updateField(projectContent, "Health", `${score}/10 (${evalVerdict})`);
        writeFileSync(config.projectPath, projectContent, "utf-8");

        if (evalVerdict === "FAIL") {
          falseDoneCount++;
          // Check actual milestone progress — don't blindly increment stall counter
          const evalMsDone = extractMilestones(projectContent).done;
          if (evalMsDone > lastMilestoneDone) {
            lastMilestoneDone = evalMsDone;
            continueWithoutProgress = 0;
          } else {
            continueWithoutProgress++;
          }
          if (falseDoneCount >= 3) {
            projectContent = updateField(projectContent, "Status", "blocked");
            projectContent = updateSection(projectContent, "Current State",
              `Blocked: Reviewer marked DONE ${falseDoneCount} times but evaluator scored <7 each time. Goal may be unachievable or misscoped.`);
            writeFileSync(config.projectPath, projectContent, "utf-8");
            return ctx.escalate(`False-done loop: reviewer said DONE ${falseDoneCount}x but evaluator rejected each time at iteration ${iteration}.`);
          }
          iteration++;
          continue;
        }

        // Hard gate: don't mark done if milestones remain unchecked
        const finalMsDone = extractMilestones(projectContent);
        if (finalMsDone.total > 0 && finalMsDone.done < finalMsDone.total) {
          falseDoneCount++;
          const overrideNote = `**Auto-check**: Evaluator PASSED (score=${score}) but only ${finalMsDone.done}/${finalMsDone.total} milestones checked. ` +
            `Overriding to CONTINUE. (false-done #${falseDoneCount})\n\n`;
          if (!config.isLegacy) appendFileSync(config.journalPath, overrideNote);
          continueWithoutProgress++;
          iteration++;
          continue;
        }

        projectContent = updateField(projectContent, "Status", "done");
        projectContent = updateSection(projectContent, "Current State",
          `Complete. ${finalMsDone.done}/${finalMsDone.total} milestones. ${decision.detail.slice(0, 100)}`);
        writeFileSync(config.projectPath, projectContent, "utf-8");
        ctx.emit({ type: "metric", name: "project.false-done", value: falseDoneCount });
        return ctx.done(`Complete after comment at iteration ${iteration}: ${decision.detail}`);
      }
      if (decision.status === "blocked") {
        ctx.emit({ type: "step_start", step: `evaluate-blocked-${iteration}` });
        const blockedMs = extractMilestones(projectContent);
        const blockedNote = blockedMs.total > 0 ? `Milestones: ${blockedMs.done}/${blockedMs.total} checked off.` : "";
        const evalPrompt = buildEvalPrompt(config.goal, projectContent, journalContent, iteration, blockedNote);
        const evalResult = await ctx.runAgent(config.owner, evalPrompt);
        const evalText = evalResult.lastAssistantText ?? "";
        const scoreMatch = evalText.match(/SCORE:\s*(\d+)/i);
        const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
        const evalEntry = `**Evaluator**: BLOCKED eval (score=${score}/10) — ${evalText.slice(0, 500)}\n\n`;
        if (!config.isLegacy) appendFileSync(config.journalPath, evalEntry);

        projectContent = updateField(projectContent, "Status", "blocked");
        projectContent = updateField(projectContent, "Health", `${score}/10 (BLOCKED)`);
        projectContent = updateSection(projectContent, "Current State", `Blocked: ${decision.detail.slice(0, 150)}`);
        writeFileSync(config.projectPath, projectContent, "utf-8");
        return ctx.escalate(`Blocked by comment at iteration ${iteration}: ${decision.detail}`);
      }

      // CONTINUE — set active (may have been blocked/done), increment iteration
      projectContent = updateField(projectContent, "Status", "active");
      writeFileSync(config.projectPath, projectContent, "utf-8");
      iteration++;
      continue;
    }

    // ── Worker phase ─────────────────────────────────────────────
    ctx.emit({ type: "step_start", step: `worker-iteration-${iteration}` });

    const lastGuidance = getLastGuidance(journalContent, iteration);
    const workerPrompt = buildWorkerPrompt(
      projectContent, journalContent, config.projectPath, iteration, config.goal, lastGuidance
    );

    const workerResult = await ctx.runAgent(config.worker, workerPrompt);

    if (workerResult.status === "error") {
      consecutiveFailures++;
      if (consecutiveFailures >= 2) {
        projectContent = updateField(projectContent, "Status", `blocked`);
        projectContent = updateSection(projectContent, "Current State",
          `Blocked: Worker failed ${consecutiveFailures} consecutive times.`);
        writeFileSync(config.projectPath, projectContent, "utf-8");
        return ctx.escalate(`Worker failed ${consecutiveFailures}x at iteration ${iteration}.`);
      }
      continue;
    }
    consecutiveFailures = 0;

    const workerSummary = ctx.summarize(workerResult, { maxLength: 1500 });

    // Append to journal (append-only, never rewrite)
    const now = new Date().toISOString();
    const journalEntry = `### Iteration ${iteration} — ${now}\n` +
      `**Worker**: ${workerSummary}\n`;

    if (config.isLegacy) {
      // Legacy: append to the single file
      projectContent = appendToSection(projectContent, "Progress Log",
        `\n### Iteration ${iteration} — ${now}\n**Worker**: ${workerSummary}\n`);
      writeFileSync(config.projectPath, projectContent, "utf-8");
    } else {
      appendFileSync(config.journalPath, journalEntry);
    }

    // Re-read project file from disk — worker may have checked off milestones or updated sections
    projectContent = readFile(config.projectPath) ?? projectContent;

    // Update project.md fields (not rewrite)
    projectContent = updateField(projectContent, "Iteration", String(iteration));
    const msAfterWorker = extractMilestones(projectContent);
    projectContent = updateSection(projectContent, "Current State",
      `Iteration ${iteration}. Milestones: ${msAfterWorker.done}/${msAfterWorker.total} done.` +
      (msAfterWorker.pending.length > 0 ? ` Next: ${msAfterWorker.pending[0].slice(0, 80)}` : ""));
    writeFileSync(config.projectPath, projectContent, "utf-8");

    // ── Reviewer phase ───────────────────────────────────────────
    if (iteration % config.reviewEvery === 0) {
      ctx.emit({ type: "step_start", step: `review-iteration-${iteration}` });

      const reviewPrompt = buildReviewPrompt(
        config.goal, iteration, workerSummary, projectContent, journalContent, continueWithoutProgress
      );

      const reviewResult = await ctx.runAgent(config.owner, reviewPrompt);

      if (reviewResult.status === "error") {
        const reviewEntry = `**Reviewer**: CONTINUE — review errored, auto-continuing\n\n`;
        if (config.isLegacy) {
          projectContent += reviewEntry;
          writeFileSync(config.projectPath, projectContent, "utf-8");
        } else {
          appendFileSync(config.journalPath, reviewEntry);
        }
        iteration++;
        continue;
      }

      const decision = extractDecision(reviewResult.lastAssistantText ?? "");
      const reviewEntry = `**Reviewer**: ${decision.status.toUpperCase()} — ${decision.detail}\n\n`;

      if (config.isLegacy) {
        projectContent += reviewEntry;
        writeFileSync(config.projectPath, projectContent, "utf-8");
      } else {
        appendFileSync(config.journalPath, reviewEntry);
      }

      // Update milestone checkboxes based on reviewer's assessment
      const beforeMs = extractMilestones(projectContent).done;
      projectContent = checkOffMilestones(projectContent, decision.detail);
      const afterMs = extractMilestones(projectContent).done;
      if (afterMs > beforeMs) {
        writeFileSync(config.projectPath, projectContent, "utf-8");
      }

      if (decision.status === "done") {
        // LLM evaluation gate: verify the work is actually done
        ctx.emit({ type: "step_start", step: `evaluate-iteration-${iteration}` });
        const finalMs = extractMilestones(projectContent);
        const milestoneNote = finalMs.total > 0 ? `Milestones: ${finalMs.done}/${finalMs.total} checked off.` : "";
        const evalPrompt = buildEvalPrompt(config.goal, projectContent, journalContent, iteration, milestoneNote);
        const evalResult = await ctx.runAgent(config.owner, evalPrompt);
        const evalText = evalResult.lastAssistantText ?? "";
        const scoreMatch = evalText.match(/SCORE:\s*(\d+)/i);
        const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
        const evalVerdict = score >= 7 ? "PASS" : "FAIL";

        const evalEntry = `**Evaluator**: ${evalVerdict} (score=${score}/10) — ${evalText.slice(0, 500)}\n\n`;
        if (config.isLegacy) {
          projectContent += evalEntry;
          writeFileSync(config.projectPath, projectContent, "utf-8");
        } else {
          appendFileSync(config.journalPath, evalEntry);
        }

        if (evalVerdict === "FAIL") {
          falseDoneCount++;
          // Check actual milestone progress — don't blindly increment stall counter
          const evalMsDoneLegacy = extractMilestones(projectContent).done;
          if (evalMsDoneLegacy > lastMilestoneDone) {
            lastMilestoneDone = evalMsDoneLegacy;
            continueWithoutProgress = 0;
          } else {
            continueWithoutProgress++;
          }
          projectContent = updateField(projectContent, "Health", `${score}/10 (${evalVerdict})`);
          writeFileSync(config.projectPath, projectContent, "utf-8");
          if (falseDoneCount >= 3) {
            projectContent = updateField(projectContent, "Status", "blocked");
            projectContent = updateSection(projectContent, "Current State",
              `Blocked: Reviewer marked DONE ${falseDoneCount} times but evaluator scored <7 each time. Goal may be unachievable or misscoped.`);
            writeFileSync(config.projectPath, projectContent, "utf-8");
            return ctx.escalate(`False-done loop: reviewer said DONE ${falseDoneCount}x but evaluator rejected each time at iteration ${iteration}.`);
          }
          iteration++;
          continue;
        }

        // Hard gate: don't mark done if milestones remain unchecked
        const finalMsForState = extractMilestones(projectContent);
        if (finalMsForState.total > 0 && finalMsForState.done < finalMsForState.total) {
          falseDoneCount++;
          const overrideNote = `**Auto-check**: Evaluator PASSED (score=${score}) but only ${finalMsForState.done}/${finalMsForState.total} milestones checked. ` +
            `Overriding to CONTINUE. (false-done #${falseDoneCount})\n\n`;
          if (config.isLegacy) {
            projectContent += overrideNote;
            writeFileSync(config.projectPath, projectContent, "utf-8");
          } else {
            appendFileSync(config.journalPath, overrideNote);
          }
          continueWithoutProgress++;
          iteration++;
          continue;
        }

        projectContent = updateField(projectContent, "Status", "done");
        projectContent = updateField(projectContent, "Health", `${score}/10 (${evalVerdict})`);
        projectContent = updateSection(projectContent, "Current State",
          `Complete. ${finalMsForState.done}/${finalMsForState.total} milestones. ${decision.detail.slice(0, 100)}`);
        projectContent = appendToSection(projectContent, "Iteration Summary",
          `- **Iter ${iteration}**: ${decision.detail.slice(0, 100)}\n`);
        writeFileSync(config.projectPath, projectContent, "utf-8");
        ctx.emit({ type: "metric", name: "project.false-done", value: falseDoneCount });
        return ctx.done(`Complete after ${iteration} iterations: ${decision.detail}`);
      }

      if (decision.status === "blocked") {
        ctx.emit({ type: "step_start", step: `evaluate-blocked-${iteration}` });
        const blockedMs = extractMilestones(projectContent);
        const blockedNote = blockedMs.total > 0 ? `Milestones: ${blockedMs.done}/${blockedMs.total} checked off.` : "";
        const evalPrompt = buildEvalPrompt(config.goal, projectContent, journalContent, iteration, blockedNote);
        const evalResult = await ctx.runAgent(config.owner, evalPrompt);
        const evalText = evalResult.lastAssistantText ?? "";
        const scoreMatch = evalText.match(/SCORE:\s*(\d+)/i);
        const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
        const evalEntry = `**Evaluator**: BLOCKED eval (score=${score}/10) — ${evalText.slice(0, 500)}\n\n`;
        if (config.isLegacy) {
          projectContent += evalEntry;
        } else {
          appendFileSync(config.journalPath, evalEntry);
        }

        projectContent = updateField(projectContent, "Status", `blocked`);
        projectContent = updateField(projectContent, "Health", `${score}/10 (BLOCKED)`);
        projectContent = updateSection(projectContent, "Current State",
          `Blocked: ${decision.detail.slice(0, 150)}`);
        writeFileSync(config.projectPath, projectContent, "utf-8");
        return ctx.escalate(`Blocked at iteration ${iteration}: ${decision.detail}`);
      }

      // CONTINUE — track progress and auto-escalate if stuck
      // Re-read from disk — worker or reviewer may have checked off milestones
      const prevContent = projectContent;
      projectContent = readFile(config.projectPath) ?? projectContent;
      const currentMilestoneDone = extractMilestones(projectContent).done;
      if (currentMilestoneDone > lastMilestoneDone) {
        continueWithoutProgress = 0;
        lastMilestoneDone = currentMilestoneDone;
      } else {
        continueWithoutProgress++;
      }

      // Auto-escalate after 5 iterations without milestone progress
      if (continueWithoutProgress >= 5) {
        projectContent = updateField(projectContent, "Status", "blocked");
        projectContent = updateSection(projectContent, "Current State",
          `Blocked: ${continueWithoutProgress} consecutive iterations without milestone progress. Approach needs rethinking.`);
        writeFileSync(config.projectPath, projectContent, "utf-8");
        return ctx.escalate(`Stuck: ${continueWithoutProgress} iterations without progress at iteration ${iteration}.`);
      }

      projectContent = appendToSection(projectContent, "Iteration Summary",
        `- **Iter ${iteration}**: ${workerSummary.slice(0, 100)}\n`);
      writeFileSync(config.projectPath, projectContent, "utf-8");
    }

    iteration++;
  }

  // Max iterations reached
  projectContent = updateField(projectContent, "Status", "paused");
  projectContent = updateSection(projectContent, "Current State",
    `Paused: reached ${config.maxIterations} iteration cap.`);
  writeFileSync(config.projectPath, projectContent, "utf-8");

  return ctx.done(`Paused after ${config.maxIterations} iterations (cap). Resume by re-running.`);
}
