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
      const goalMatch = content.match(/^## Goal\n([\s\S]*?)(?=\n## |$)/m);
      if (goalMatch) goal = goalMatch[1].trim().split("\n")[0];
    } catch { /* file may not exist yet */ }
  }
  if (!goal) throw new Error("Missing required field: goal");

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
  return content;
}

function updateSection(content: string, heading: string, newContent: string): string {
  const regex = new RegExp(`^## ${heading}\\n[\\s\\S]*?(?=\\n## |$)`, "m");
  if (regex.test(content)) return content.replace(regex, `## ${heading}\n${newContent}`);
  // Section doesn't exist — append it
  return content + `\n\n## ${heading}\n${newContent}`;
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
**Started**: ${now}
**Iteration**: 0

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

function extractComments(content: string): string {
  const idx = content.indexOf("## Comments\n");
  if (idx === -1) return "";
  const after = content.slice(idx + "## Comments\n".length);
  // Stop at next section heading or end of file
  const nextSection = after.indexOf("\n## ");
  const text = nextSection === -1 ? after : after.slice(0, nextSection);
  return text.trim();
}

// Clear the Comments section in project.md after processing
// Track false-done signals for metrics (reset per execute call)

function clearComments(content: string): string {
  // Comments is the last section — replace everything after the heading
  const idx = content.indexOf("## Comments\n");
  if (idx === -1) return content;
  return content.slice(0, idx) + "## Comments\n";
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
  const stateMatch = projectContent.match(/^## Current State\n([\s\S]*?)(?=\n## |$)/m);
  const currentState = stateMatch ? stateMatch[1].trim() : null;
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

  let prompt = `[REVIEW ONLY — no file edits expected.]\n\n`;
  prompt += `You are reviewing iteration ${iteration} of a persistent task.\n\n`;
  prompt += `## Goal\n${goal}\n\n`;

  if (ms.total > 0) {
    prompt += `## Milestone Progress: ${ms.done}/${ms.total} complete\n`;
    if (ms.pending.length > 0) {
      prompt += `Remaining:\n`;
      for (const p of ms.pending) prompt += `- [ ] ${p}\n`;
    }
    prompt += `\n`;
  }

  if (recentEntries) prompt += `## Recent Progress\n${recentEntries}\n\n`;

  const comments = extractComments(projectContent);
  if (comments) prompt += `## Comments (from human/agents — address these in your guidance)\n${comments}\n\n`;

  prompt += `## Latest Worker Output (Iteration ${iteration})\n${workerSummary}\n\n`;

  prompt += `## Your Assessment\n`;
  if (continueWithoutProgress >= 2) {
    prompt += `\n⚠️ WARNING: ${continueWithoutProgress} consecutive iterations with no milestone progress. `;
    prompt += `The current approach is not working. You MUST either:\n`;
    prompt += `- Try a fundamentally different approach (not the same instruction again)\n`;
    prompt += `- Say BLOCKED and explain what's preventing progress\n`;
    prompt += `Repeating the same guidance is not acceptable.\n\n`;
  }
  prompt += `1. Are ALL milestones complete? → DONE with summary.\n`;
  prompt += `2. Is the task blocked or stuck in a loop? → BLOCKED with reason.\n`;
  prompt += `3. Otherwise → CONTINUE with specific guidance for the next iteration.\n\n`;
  prompt += `If CONTINUE: say exactly what the next iteration should do and what output to produce.\n`;
  prompt += `Your response MUST start with: DONE, BLOCKED, or CONTINUE`;

  return prompt;
}

function buildEvalPrompt(
  goal: string,
  projectContent: string,
  journalContent: string,
  iteration: number,
): string {
  const ms = extractMilestones(projectContent);
  const recentEntries = getRecentJournalEntries(journalContent, iteration, 5);

  let prompt = `[EVALUATION ONLY — no file edits.]\n\n`;
  prompt += `You are evaluating whether a project is truly complete.\n\n`;
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
  prompt += `5. **No shortcuts**: Did the worker do real work or just claim completion?\n\n`;
  prompt += `Your response MUST include:\n`;
  prompt += `SCORE: <1-10> (7+ = genuinely complete, <7 = not done)\n`;
  prompt += `Then explain your reasoning for each criterion.\n`;

  return prompt;
}

function extractDecision(text: string): { status: "done" | "blocked" | "continue"; detail: string } {
  const trimmed = (text ?? "").trim();
  if (/^DONE\b/i.test(trimmed)) return { status: "done", detail: trimmed.replace(/^DONE[:\s]*/i, "").trim() };
  if (/^BLOCKED\b/i.test(trimmed)) return { status: "blocked", detail: trimmed.replace(/^BLOCKED[:\s]*/i, "").trim() };
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
  if (state.status === "done") return ctx.done(`Task is already done.`);

  let iteration = state.lastIteration + 1;
  let consecutiveFailures = 0;
  let continueWithoutProgress = 0;
  let lastMilestoneDone = extractMilestones(projectContent).done;
  let falseDoneCount = 0;

  // Mark active (field-level update)
  projectContent = updateField(projectContent, "Status", "active");
  writeFileSync(config.projectPath, projectContent, "utf-8");

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
        const finalMs = extractMilestones(projectContent);
        if (finalMs.total > 0 && finalMs.done < finalMs.total) {
          falseDoneCount++;
          const overrideNote = `**Auto-check**: Reviewer said DONE but only ${finalMs.done}/${finalMs.total} milestones checked. ` +
            `Overriding to CONTINUE. (false-done #${falseDoneCount})`;
          if (!config.isLegacy) appendFileSync(config.journalPath, overrideNote + "\n\n");
          iteration++;
          continue;
        }

        // LLM evaluation gate
        ctx.emit({ type: "step_start", step: `evaluate-comment-${iteration}` });
        const evalPrompt = buildEvalPrompt(config.goal, projectContent, journalContent, iteration);
        const evalResult = await ctx.runAgent(config.owner, evalPrompt);
        const evalText = evalResult.lastAssistantText ?? "";
        const scoreMatch = evalText.match(/SCORE:\s*(\d+)/i);
        const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
        const evalVerdict = score >= 7 ? "PASS" : "FAIL";

        const evalEntry = `**Evaluator**: ${evalVerdict} (score=${score}/10) — ${evalText.slice(0, 500)}\n\n`;
        if (!config.isLegacy) appendFileSync(config.journalPath, evalEntry);

        if (evalVerdict === "FAIL") {
          falseDoneCount++;
          iteration++;
          continue;
        }

        projectContent = updateField(projectContent, "Status", "done");
        projectContent = updateSection(projectContent, "Current State", decision.detail);
        writeFileSync(config.projectPath, projectContent, "utf-8");
        ctx.emit({ type: "metric", name: "project.false-done", value: falseDoneCount });
        return ctx.done(`Complete after comment at iteration ${iteration}: ${decision.detail}`);
      }
      if (decision.status === "blocked") {
        projectContent = updateField(projectContent, "Status", "blocked");
        projectContent = updateSection(projectContent, "Current State", `Blocked: ${decision.detail}`);
        writeFileSync(config.projectPath, projectContent, "utf-8");
        return ctx.escalate(`Blocked by comment at iteration ${iteration}: ${decision.detail}`);
      }

      // CONTINUE — increment iteration, worker gets reviewer guidance next
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
    projectContent = updateSection(projectContent, "Current State",
      `Iteration ${iteration} complete. ${workerSummary.slice(0, 200)}`);
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

      if (decision.status === "done") {
        const finalMs = extractMilestones(projectContent);
        // Fast pre-filter: unchecked milestones
        if (finalMs.total > 0 && finalMs.done < finalMs.total) {
          falseDoneCount++;
          const overrideNote = `**Auto-check**: Reviewer said DONE but only ${finalMs.done}/${finalMs.total} milestones checked. ` +
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

        // LLM evaluation gate: verify the work is actually done
        ctx.emit({ type: "step_start", step: `evaluate-iteration-${iteration}` });
        const evalPrompt = buildEvalPrompt(config.goal, projectContent, journalContent, iteration);
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
          continueWithoutProgress++;
          iteration++;
          continue;
        }

        projectContent = updateField(projectContent, "Status", "done");
        projectContent = updateSection(projectContent, "Current State", decision.detail);
        projectContent = appendToSection(projectContent, "Iteration Summary",
          `- **Iter ${iteration}**: ${decision.detail.slice(0, 100)}\n`);
        writeFileSync(config.projectPath, projectContent, "utf-8");
        ctx.emit({ type: "metric", name: "project.false-done", value: falseDoneCount });
        return ctx.done(`Complete after ${iteration} iterations: ${decision.detail}`);
      }

      if (decision.status === "blocked") {
        projectContent = updateField(projectContent, "Status", `blocked`);
        projectContent = updateSection(projectContent, "Current State", `Blocked: ${decision.detail}`);
        writeFileSync(config.projectPath, projectContent, "utf-8");
        return ctx.escalate(`Blocked at iteration ${iteration}: ${decision.detail}`);
      }

      // CONTINUE — track progress and auto-escalate if stuck
      // Re-read from disk — worker or reviewer may have checked off milestones
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
