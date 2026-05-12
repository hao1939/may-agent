/// <reference path="../../types/workflow-defs.d.ts" />

/**
 * persistent-task — Run a task in a loop until done, blocked, or owner intervenes.
 *
 * File structure (directory per project):
 *   <project-dir>/project.md   — goal, milestones, state, comments (field-level updates only)
 *   <project-dir>/journal.md   — iteration log (append-only)
 *
 * Legacy: single .md file still supported (detected by file extension).
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, statSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { ProjectCache } from "./project-cache.js";
import { shouldBudgetCheckpoint, buildBudgetCheckpointEntry, estimateTurnsUsed, resetBudgetState } from "./budget-checkpoint.js";
import { onProjectCreate } from "./hooks/validate-on-create.js";

export const name: string = "project";

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

// Module-level cache instance — lives for the duration of one workflow run.
// Each run of the project workflow creates a fresh import context, so stale data
// doesn't leak across runs. The cache is also flushed at the start of each run().
const _cache = new ProjectCache();

function readFile(path: string): string | null {
  return _cache.read(path);
}

/** Flush the project cache (call at workflow start for safety). */
export function flushProjectCache(): void {
  _cache.flush();
}

/** Write-through helper: writes to disk and updates cache. */
function cachedWrite(path: string, content: string): void {
  writeFileSync(path, content, "utf-8");
  _cache.invalidate(path);
}

/** Append-through helper: appends to disk and invalidates cache. */
function cachedAppend(path: string, content: string): void {
  appendFileSync(path, content);
  _cache.invalidate(path);
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const PROJECT_FIELD_TO_META_KEY: Record<string, string> = {
  "Project": "name",
  "Name": "name",
  "Owner": "owner",
  "Status": "status",
  "Type": "type",
  "Priority": "priority",
  "Workflow": "workflow",
  "Iteration": "iteration",
  "Max Iterations": "max_iterations",
  "Stop Reason": "stop_reason",
  "Resume Condition": "resume_condition",
};

function projectMetaKeyForField(field: string): string {
  return PROJECT_FIELD_TO_META_KEY[field] ?? field.toLowerCase().replace(/\s+/g, "_");
}

function projectFrontmatterBounds(content: string): { end: number } | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (!match) return null;
  return { end: match[0].length };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function updateField(content: string, field: string, value: string): string {
  const frontmatter = projectFrontmatterBounds(content);
  if (frontmatter) {
    const key = projectMetaKeyForField(field);
    const sanitized = value.replace(/\s+/g, " ").trim();
    const lines = content.slice(0, frontmatter.end).split("\n");
    const lineRe = new RegExp(`^${escapeRegExp(key)}:\\s*`);
    const idx = lines.findIndex(line => lineRe.test(line));
    if (idx >= 0) {
      lines[idx] = `${key}: ${sanitized}`;
    } else {
      const closingIdx = lines.findIndex((line, lineIdx) => lineIdx > 0 && line.trim() === "---");
      lines.splice(closingIdx >= 1 ? closingIdx : lines.length, 0, `${key}: ${sanitized}`);
    }
    return lines.join("\n") + content.slice(frontmatter.end);
  }

  const regex = new RegExp(`^(\\*\\*${escapeRegExp(field)}\\*\\*:\\s*).*$`, "m");
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

function currentGoal(projectContent: string, fallback: string): string {
  return extractSection(projectContent, "Goal") || fallback;
}

function extractDirectiveBlock(text: string, name: string): string | null {
  const pattern = new RegExp(`(?:^|\\n)${escapeRegExp(name)}:\\s*([\\s\\S]*?)(?=\\n(?:GOAL_UPDATE|CURRENT_STATE_UPDATE|SIGNALS_UPDATE|PLAN_UPDATE|CONTEXT_UPDATE):|\\n\\*\\*|\\n## |$)`, "i");
  const match = text.match(pattern);
  return match?.[1]?.trim() || null;
}

export function applyReviewerProjectDirectives(projectContent: string, reviewerText: string): string {
  const updates: Array<[string, string]> = [
    ["Goal", "GOAL_UPDATE"],
    ["Current State", "CURRENT_STATE_UPDATE"],
    ["Signals", "SIGNALS_UPDATE"],
    ["Plan", "PLAN_UPDATE"],
  ];

  let next = projectContent;
  for (const [section, directive] of updates) {
    const value = extractDirectiveBlock(reviewerText, directive);
    if (value) next = updateSection(next, section, value.endsWith("\n") ? value : `${value}\n`);
  }
  return next;
}

export function stripReviewerDirectives(text: string): string {
  return text
    .replace(/\n?CONTEXT_UPDATE:\s*[\s\S]*?(?=\n(?:GOAL_UPDATE|CURRENT_STATE_UPDATE|SIGNALS_UPDATE|PLAN_UPDATE):|\n\*\*|\n## |$)/gi, "")
    .replace(/\n?GOAL_UPDATE:\s*[\s\S]*?(?=\n(?:CONTEXT_UPDATE|CURRENT_STATE_UPDATE|SIGNALS_UPDATE|PLAN_UPDATE):|\n\*\*|\n## |$)/gi, "")
    .replace(/\n?CURRENT_STATE_UPDATE:\s*[\s\S]*?(?=\n(?:GOAL_UPDATE|CONTEXT_UPDATE|SIGNALS_UPDATE|PLAN_UPDATE):|\n\*\*|\n## |$)/gi, "")
    .replace(/\n?SIGNALS_UPDATE:\s*[\s\S]*?(?=\n(?:GOAL_UPDATE|CONTEXT_UPDATE|CURRENT_STATE_UPDATE|PLAN_UPDATE):|\n\*\*|\n## |$)/gi, "")
    .replace(/\n?PLAN_UPDATE:\s*[\s\S]*?(?=\n(?:GOAL_UPDATE|CONTEXT_UPDATE|CURRENT_STATE_UPDATE|SIGNALS_UPDATE):|\n\*\*|\n## |$)/gi, "")
    .trim();
}

function currentStateLine(label: string, detail: string): string {
  const cleaned = detail.trim();
  return cleaned ? `${label}: ${cleaned}` : `${label}.`;
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

/** Auto-catalog files in outputs/ and update ## Artifacts section */
function catalogOutputs(projectDir: string, projectContent: string): string {
  const outputsDir = join(projectDir, "outputs");
  if (!existsSync(outputsDir)) return projectContent;
  try {
    const files = readdirSync(outputsDir).filter(f => {
      try { return statSync(join(outputsDir, f)).isFile(); } catch { return false; }
    });
    if (files.length === 0) return projectContent;
    const listing = files.map(f => `- outputs/${f}`).join("\n") + "\n";
    return updateSection(projectContent, "Artifacts", listing);
  } catch { return projectContent; }
}

function createProjectDir(config: PersistentTaskConfig): void {
  ensureDir(config.projectDir);
  ensureDir(join(config.projectDir, "outputs"));
  const projectId = basename(config.projectDir);
  const projectContent = `---
id: ${projectId}
owner: ${config.owner}
status: active
type: milestone
priority: P1
workflow: project
iteration: 0
worker: ${config.worker}
---

# Project: ${config.goal}

## Goal
${config.goal}

## Current State
Not started.

## Signals
- Project created from workflow request; refine metrics and signals during the first iteration.

## Context
(Key discoveries and facts will be accumulated here by the reviewer across iterations.)

## Plan
- [ ] Define success criteria and first milestone

## Validation
- Success criteria are explicit and checked before status changes.

## Resources

## Artifacts

## Journal

`;
  cachedWrite(config.projectPath, projectContent);
  cachedWrite(config.journalPath, `# Journal\n\n`);
  writeFileSync(join(config.projectDir, "discussion.md"), `# Discussion\n\n`, "utf-8");

  // Validate the new project.md structure
  const validation = onProjectCreate(projectContent);
  if (!validation.valid) {
    console.warn(`[project] Validation warnings for ${config.projectPath}:`, validation.errors);
  }
}

function parseProjectState(content: string): ProjectState {
  const frontmatterStatus = content.match(/^---\s*\n[\s\S]*?\nstatus:\s*(.+?)\s*\n[\s\S]*?\n---\s*(?:\n|$)/i);
  const statusMatch = content.match(/^\*\*Status\*\*:\s*(.+)$/m);
  const status = (frontmatterStatus?.[1] || statusMatch?.[1] || "active").trim().toLowerCase().split(" ")[0];
  const iterHeaders = [...content.matchAll(/^### Iteration (\d+)/gm)];
  // Also check the Iteration field
  const frontmatterIter = content.match(/^---\s*\n[\s\S]*?\niteration:\s*(\d+)\s*\n[\s\S]*?\n---\s*(?:\n|$)/i);
  const iterField = frontmatterIter || content.match(/^\*\*Iteration\*\*:\s*(\d+)/m);
  const lastIteration = iterField ? parseInt(iterField[1], 10) :
    (iterHeaders.length > 0 ? Math.max(...iterHeaders.map(m => parseInt(m[1], 10))) : 0);
  return { status, lastIteration };
}

function parseLastJournalIteration(content: string): number {
  const iterHeaders = [...content.matchAll(/^### Iteration (\d+)/gm)];
  return iterHeaders.length > 0 ? Math.max(...iterHeaders.map(m => parseInt(m[1], 10))) : 0;
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

/** Get unread comments from discussion.md (content after last ---read--- marker) */
function getUnreadComments(projectDir: string): string {
  try {
    const discPath = join(projectDir, "discussion.md");
    if (!existsSync(discPath)) return "";
    const content = readFileSync(discPath, "utf-8");
    const lastMarker = content.lastIndexOf("---read @iter");
    if (lastMarker === -1) {
      // No marker yet — everything after "# Discussion\n" is unread
      const headerEnd = content.indexOf("\n", content.indexOf("# Discussion"));
      return headerEnd === -1 ? "" : content.slice(headerEnd + 1).trim();
    }
    // Content after the last marker line
    const afterMarker = content.indexOf("\n", lastMarker);
    return afterMarker === -1 ? "" : content.slice(afterMarker + 1).trim();
  } catch { return ""; }
}

/** Mark discussion as read by appending a marker */
function markDiscussionRead(projectDir: string, iteration: number): void {
  try {
    const discPath = join(projectDir, "discussion.md");
    if (!existsSync(discPath)) return;
    appendFileSync(discPath, `\n---read @iter${iteration}---\n`);
  } catch { /* ignore */ }
}

/** Check both legacy Comments section and discussion.md for pending comments */
function getPendingComments(projectContent: string, projectDir: string): string {
  const legacyComments = extractComments(projectContent);
  const discComments = getUnreadComments(projectDir);
  const parts = [legacyComments, discComments].filter(Boolean);
  return parts.join("\n");
}

function parseFeatures(content: string): Set<string> {
  const notes = extractSection(content, "Process Notes");
  const match = notes.match(/features:\s*(.+)/i);
  if (!match) return new Set();
  return new Set(match[1].split(",").map(f => f.trim()).filter(Boolean));
}

function parseMetrics(content: string): Array<{ id: string; target: string; baseline: string }> {
  const section = extractSection(content, "Metrics");
  if (!section) return [];
  return section.split("\n").filter(l => l.startsWith("- ")).map(line => {
    const m = line.match(/^- (\S+):\s*target\s*([<>]=?\s*[\d.]+%?),?\s*baseline\s*([\d.]+%?)/);
    return m ? { id: m[1], target: m[2].trim(), baseline: m[3].trim() } : null;
  }).filter(Boolean) as Array<{ id: string; target: string; baseline: string }>;
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
  const guidance = match[1].trim();
  if (/^(WAITING|BLOCKED)\b/i.test(guidance)) return null;
  return guidance.replace(/^(CONTINUE|PIVOT)[:\s]*/i, "").trim() || null;
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
  const context = extractSection(projectContent, "Context") || null;
  const recentEntries = getRecentJournalEntries(journalContent, iteration, 3);
  const features = parseFeatures(projectContent);
  const focused = features.has("focused-context");
  const processNotes = extractSection(projectContent, "Process Notes");
  const projectDir = dirname(projectPath);
  const outputsDir = join(projectDir, "outputs");

  let prompt = `You are working on iteration ${iteration} of a persistent task.\n\n`;

  // Current milestone
  if (nextMilestone) {
    prompt += `## Current Milestone\n${nextMilestone}\n`;
    prompt += `(${ms.done}/${ms.total} milestones complete)\n\n`;
  }

  // Context: why
  prompt += `## Goal\n${goal}\n\n`;
  if (currentState) prompt += `## Current State\n${currentState}\n\n`;
  if (context) prompt += `## Context (accumulated knowledge)\n${context}\n\n`;

  if (lastGuidance) {
    prompt += `## Prior Reviewer Guidance\n`;
    prompt += `Use this as a starting point only if it is still consistent with Current State and Context above. Current State and Context are newer authority when they conflict.\n\n`;
    prompt += `${lastGuidance}\n\n`;
  }

  // Reference: how
  const resources = extractSection(projectContent, "Resources");
  if (resources && !focused) prompt += `## Resources\n${resources}\n\n`;

  if (processNotes) prompt += `## Process Notes\n${processNotes}\n\n`;

  if (ms.pending.length > 1 && !focused) {
    prompt += `## Remaining Milestones\n`;
    for (const p of ms.pending.slice(1)) prompt += `- [ ] ${p}\n`;
    prompt += `\n`;
  }

  if (recentEntries && !focused) prompt += `## Recent Progress\n${recentEntries}\n\n`;

  // Constraints
  prompt += `## Rules\n`;
  prompt += `- Produce a concrete deliverable when it advances the current goal. If the current blocker/precondition is still unmet, finish(blocked/partial) with evidence instead of inventing files.\n`;
  prompt += `- For remote hosts or remote absolute paths (for example \`ssh devbox\`, \`devbox:/...\`, or \`/home/...\` on a remote machine), use the available remote tool when one exists. Prefer exact command tools such as \`ssh_exec\` for command output; use delegation tools such as \`cc_worker\` for exploratory remote work. Do not route remote commands through local bash just because they look like shell commands.\n`;
  prompt += `- A local path/guard warning means the command used the wrong local tool. It is not evidence that remote access is unavailable. Only claim remote access is blocked after trying the remote/delegation path and recording the exact result.\n`;
  prompt += `- Put all output files in: ${outputsDir}/\n`;
  prompt += `- Before finish(success), call read() on every file you write() or edit(); tests and grep can supplement read-back but do not replace it.\n`;
  prompt += `- Before finish(success), run \`cd /app/agents && git status --short\`, classify every dirty path, and stage only intentional deliverables with explicit paths (never broad \`git add .\`). If an intentional deliverable is under the ignored canonical \`shared/projects/\` tree, use \`git add -f <that exact path>\` and explain why.\n`;
  prompt += `- If unrelated or unsafe dirty paths remain, do not commit them just to satisfy the guard; finish(partial/blocked) with the exact path and owner/escalation needed.\n`;
  prompt += `- After committing, re-run \`cd /app/agents && git status --short\`; success requires a clean agents worktree or an explicit blocker, and verification_evidence must cite the clean-status check plus commit id.\n`;
  prompt += `- You CANNOT edit the project file or journal.\n`;

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
  features?: Set<string>,
): string {
  const ms = extractMilestones(projectContent);
  const recentEntries = getRecentJournalEntries(journalContent, iteration, 2);
  const previousGuidance = getAllReviewerGuidance(journalContent, iteration);

  let prompt = `You are the PROJECT DRIVER for iteration ${iteration} of a persistent task.\n`;
  prompt += `Your job is to unblock the worker and push the project to completion.\n`;
  prompt += `You are NOT a passive evaluator — you are an active strategist.\n`;
  prompt += `You may inspect, run commands, or edit files when that is the cleanest way to understand, unblock, or advance the project.\n`;
  prompt += `Your scope is different from the worker's scope: you own judgment, project state, next direction, and unblock strategy. You are not read-only.\n`;
  prompt += `If something isn't working, change the approach instead of repeating guidance.\n`;
  prompt += `Never give the same guidance twice. If previous guidance failed, try a different strategy.\n\n`;
  prompt += `## Goal\n${goal}\n\n`;

  const metrics = parseMetrics(projectContent);
  if (metrics.length > 0) {
    prompt += `## Metrics\n`;
    for (const m of metrics) prompt += `- ${m.id}: target ${m.target}, baseline ${m.baseline}\n`;
    prompt += `Milestones being done does NOT mean the goal is met. Check whether metrics moved toward targets.\n\n`;
  }

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
  prompt += `- **Project state authority**: If the human changed the goal, scope, signals, plan, or current state, update the project with explicit directives. Use \`GOAL_UPDATE:\`, \`SIGNALS_UPDATE:\`, \`PLAN_UPDATE:\`, and/or \`CURRENT_STATE_UPDATE:\`. The workflow will apply these to project.md after your review.\n`;
  prompt += `- **Context maintenance**: You maintain the ## Context section of project.md. After each iteration, add key discoveries/facts that future iterations will need. Remove stale info. Keep it concise — facts only, not narrative.\n`;
  prompt += `  Format your context updates as: CONTEXT_UPDATE: <bullet points to add or replace>\n`;
  prompt += `- **Agent cannot mark done**: Only human/May can mark a project done. If you say DONE, it's auto-converted to WAITING with "awaiting review".\n`;
  prompt += `- **Worker capabilities**: The worker can read/write files, run local bash commands, call sub-agents, and use any local tools exposed by the runtime (including exact remote command tools such as \`ssh_exec\` and delegation tools such as \`cc_worker\` when present). Output goes to the project's outputs/ directory. It CANNOT edit project.md or journal.md directly.\n`;
  prompt += `- **Remote work convention**: For remote hosts or remote absolute paths (for example \`ssh devbox\`, \`devbox:/...\`, or \`/home/...\` on a remote machine), tell the worker to use the available remote tool first. Prefer exact command tools such as \`ssh_exec\` when exact stdout/stderr matters; use delegation tools such as \`cc_worker\` when the worker should reason or inspect. Do not declare remote access blocked from a local bash path-guard warning alone; that warning usually means the command was routed through the wrong local tool.\n`;
  prompt += `- **Iteration budget**: Iterations are finite and expensive. Don't waste them repeating failed approaches.\n\n`;

  if (features?.has("verify-before-stop")) {
    prompt += `## Verification Required (feature: verify-before-stop)\n`;
    prompt += `Before saying WAITING or BLOCKED, you MUST verify:\n`;
    prompt += `- Do deliverables actually exist? (check the file system)\n`;
    prompt += `- Are files non-empty and meaningful?\n`;
    prompt += `- Do milestones match reality, not just claims?\n\n`;
  }

  if (recentEntries) prompt += `## Recent Progress\n${recentEntries}\n\n`;

  prompt += `## Your Previous Guidance (do NOT repeat these)\n${previousGuidance}\n`;
  prompt += `↑ If any of the above guidance didn't produce results, you MUST try a fundamentally different approach.\n\n`;

  const comments = extractComments(projectContent);
  if (comments) prompt += `## Comments (from human/agents — address these in your guidance)\n${comments}\n\n`;

  prompt += `## Latest Worker Output (Iteration ${iteration})\n${workerSummary}\n\n`;

  prompt += `## Before You Decide — Externalize Your Beliefs (EXP-215)\n`;
  prompt += `State in 3 bullets before making your decision:\n`;
  prompt += `1. **I believe**: What is true about the current state of this project?\n`;
  prompt += `2. **I'm uncertain about**: What don't you know or haven't verified?\n`;
  prompt += `3. **I'd change my mind if**: What evidence would flip your assessment?\n\n`;

  prompt += `## Your Decision\n`;
  prompt += `## Questions You Must Answer Each Review\n`;
  prompt += `Before deciding CONTINUE/PIVOT/WAITING/BLOCKED, answer these:\n`;
  prompt += `1. **Is the goal closer?** Not "were milestones checked" — did the actual outcome metric improve?\n`;
  prompt += `2. **What did we learn?** What worked, what didn't, what surprised us?\n`;
  prompt += `3. **Is the current milestone the right next step?** Or should we adjust based on what we learned?\n`;
  prompt += `4. **Are we closing the loop?** Did we just fix a symptom, or did we prevent recurrence (skill/guard/handler)?\n`;
  prompt += `5. **Is it verified?** Every skill/workflow created must be testable. Is there a gym scenario or test that confirms it works? If not, writing the test IS the next milestone.\n`;
  prompt += `6. **What's blocking progress?** Be specific — not "it's hard" but "X dependency is missing" or "approach Y failed because Z".\n\n`;
  prompt += `If the proposed blocker is access to a remote host, verify that the worker tried the remote/delegation tool path first. A local bash guard warning is not enough evidence for WAITING or BLOCKED.\n\n`;

  if (continueWithoutProgress >= 2) {
    prompt += `\n⚠️ STALL DETECTED: ${continueWithoutProgress} consecutive iterations with no milestone progress.\n`;
    prompt += `The current approach is NOT working. You MUST:\n`;
    prompt += `1. List 3 alternative approaches ranked by feasibility\n`;
    prompt += `2. Pick approach #1 and write the EXACT first command for the worker\n`;
    prompt += `3. Say PIVOT (not CONTINUE) — continuing the same strategy is forbidden\n`;
    prompt += `If all approaches require external resources unavailable to the worker, say BLOCKED.\n\n`;
  }
  prompt += `Choose ONE:\n\n`;
  prompt += `1. **CONTINUE** — Progress is being made, guide the next iteration.\n\n`;
  prompt += `2. **PIVOT** — The current approach has failed. Describe a fundamentally different strategy.\n`;
  prompt += `   Use when: same guidance failed 2+ times, worker is stuck in a loop, the approach has a design flaw.\n`;
  prompt += `   "This is hard" is NOT blocked — that's PIVOT.\n\n`;
  prompt += `3. **WAITING** — Work has reached a point where a precondition must be met before continuing.\n`;
  prompt += `   Format: WAITING: <reason>. Resume when: <specific condition>\n`;
  prompt += `   Examples: "PR submitted, waiting for merge", "All milestones complete, waiting for review"\n\n`;
  prompt += `4. **BLOCKED** — There is a specific external dependency that no amount of worker iteration can resolve.\n`;
  prompt += `   Format: BLOCKED: <reason>. Resume when: <specific condition>\n`;
  prompt += `   Examples: missing API key, needs human policy decision, requires access not available.\n\n`;
  prompt += `If CONTINUE or PIVOT, your guidance MUST include all three parts:\n`;
  prompt += `**(a) Concrete output:** What specific file or artifact should the next iteration produce?\n`;
  prompt += `**(b) What's different:** How is this different from your previous guidance? (Say "First attempt" if iteration 1)\n`;
  prompt += `**(c) First step:** One specific action to start with (e.g., "Read file X", "Run command Y")\n\n`;
  prompt += `When milestones are completed, mention them by exact name so they can be checked off.\n`;
  prompt += `Your response MUST start with: CONTINUE, PIVOT, WAITING, or BLOCKED`;

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
  prompt += `1. **Deliverables exist**: Were actual files/artifacts created or updated? (Not just claims — the files must exist.)\n`;
  prompt += `2. **Goal addressed**: Does the work make meaningful progress toward the stated goal?\n`;
  prompt += `3. **Honest reporting**: Are milestone checkmarks and status claims accurate?\n`;
  if (milestoneNote) prompt += `4. **Milestone status**: ${milestoneNote}\n`;
  prompt += `\nIf blocked: Is the blocker real and specific? Did the worker try alternatives?\n`;

  const metrics = parseMetrics(projectContent);
  if (metrics.length > 0) {
    prompt += `\n**Metrics**: This project declares target metrics. Check whether they improved:\n`;
    for (const m of metrics) prompt += `   - ${m.id}: target ${m.target}, baseline ${m.baseline}\n`;
    prompt += `   Score low if milestones are done but metrics have not moved toward targets.\n`;
  }
  prompt += `\n`;
  prompt += `Your response MUST include:\n`;
  prompt += `SCORE: <1-10> (7+ = genuinely complete, <7 = not done)\n`;
  prompt += `Then explain your reasoning for each criterion.\n`;

  return prompt;
}

function extractDecision(text: string): { status: "waiting" | "blocked" | "continue"; detail: string; resumeCondition: string } {
  const trimmed = (text ?? "").trim();
  const resumeMatch = trimmed.match(/Resume when:\s*(.+)/i);
  const resumeCondition = resumeMatch ? resumeMatch[1].trim() : "";
  if (/^DONE\b/i.test(trimmed)) {
    return { status: "waiting", detail: `[Auto-converted from DONE] ${trimmed.replace(/^DONE[:\s]*/i, "").trim()}`, resumeCondition: "Human/May review confirms done, or provides additional work" };
  }
  if (/^WAITING\b/i.test(trimmed)) return { status: "waiting", detail: trimmed.replace(/^WAITING[:\s]*/i, "").trim(), resumeCondition };
  if (/^BLOCKED\b/i.test(trimmed)) return { status: "blocked", detail: trimmed.replace(/^BLOCKED[:\s]*/i, "").trim(), resumeCondition };
  if (/^PIVOT\b/i.test(trimmed)) return { status: "continue", detail: `[PIVOT] ${trimmed.replace(/^PIVOT[:\s]*/i, "").trim()}`, resumeCondition: "" };
  const detail = trimmed.replace(/^CONTINUE[:\s]*/i, "").trim();
  return { status: "continue", detail: detail || "Continue working toward the goal.", resumeCondition: "" };
}


function emitProjectEvent(ctx: WorkflowContext, config: PersistentTaskConfig, event: string, extra?: Record<string, unknown>): void {
  const name = config.isLegacy
    ? config.projectPath.split("/").pop()?.replace(/\.md$/, "") ?? "unknown"
    : config.projectDir.split("/").pop() ?? "unknown";
  const projectId = `${config.owner}/${name}`;
  ctx.dispatchEvent(event, { projectId, owner: config.owner, ...extra });
}

// ── Stopped/Blocked handler helpers ──────────────────────────────────

interface LoopState {
  projectContent: string;
  continueWithoutProgress: number;
}

type StopHandlerResult =
  | { outcome: "continue" }
  | { outcome: "stopped"; result: WorkflowResult };

/**
 * Append an entry to the journal, handling legacy vs directory format.
 */
function appendJournalEntry(
  config: PersistentTaskConfig,
  projectContent: string,
  entry: string,
  isCommentIteration: boolean,
): string {
  if (isCommentIteration) {
    if (!config.isLegacy) cachedAppend(config.journalPath, entry);
  } else {
    if (config.isLegacy) {
      projectContent += entry;
      cachedWrite(config.projectPath, projectContent);
    } else {
      cachedAppend(config.journalPath, entry);
    }
  }
  return projectContent;
}

/**
 * Handle a WAITING decision (including auto-converted DONE).
 * If `evaluator-gate` feature is enabled, run evaluator first.
 */
async function handleWaitingDecision(
  ctx: WorkflowContext,
  config: PersistentTaskConfig,
  ls: LoopState,
  journalContent: string,
  iteration: number,
  decision: { status: string; detail: string; resumeCondition: string },
  isCommentIteration: boolean,
  features: Set<string>,
): Promise<StopHandlerResult> {
  // Optional evaluator gate (feature flag)
  if (features.has("evaluator-gate")) {
    const stepLabel = isCommentIteration ? `evaluate-comment-${iteration}` : `evaluate-iteration-${iteration}`;
    ctx.emit({ type: "step_start", step: stepLabel });
    const ms = extractMilestones(ls.projectContent);
    const milestoneNote = ms.total > 0 ? `Milestones: ${ms.done}/${ms.total} checked off.` : "";

    // JS fast-path: all milestones checked off → auto-pass without LLM session
    if (ms.total > 0 && ms.done === ms.total) {
      const evalEntry = `**Evaluator**: PASS (score=8/10) — JS fast-path: all ${ms.total} milestones checked off, skipping LLM evaluation.\n\n`;
      ls.projectContent = appendJournalEntry(config, ls.projectContent, evalEntry, isCommentIteration);
      // Fall through to normal WAITING handling — no LLM session needed
    } else {
    const evalPrompt = buildEvalPrompt(config.goal, ls.projectContent, journalContent, iteration, milestoneNote);
    const evalResult = await ctx.runAgent(config.owner, evalPrompt);
    const evalText = evalResult.lastAssistantText ?? "";
    const scoreMatch = evalText.match(/SCORE:\s*(\d+)/i);
    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
    if (score < 7) {
      // Count previous evaluator FAILs to enforce auto-advance cap
      const prevFails = (journalContent.match(/\*\*Evaluator\*\*: FAIL/g) || []).length;
      const maxEvalAttempts = 2;
      if (prevFails + 1 >= maxEvalAttempts) {
        // Auto-advance: evaluator rejected too many times, let human review decide
        const evalEntry = `**Evaluator**: FAIL (score=${score}/10) — auto-advancing to WAITING after ${prevFails + 1} evaluator rejections (cap=${maxEvalAttempts}). ${evalText.slice(0, 300)}\n\n`;
        ls.projectContent = appendJournalEntry(config, ls.projectContent, evalEntry, isCommentIteration);
        // Fall through to normal WAITING handling instead of returning continue
      } else {
        const evalEntry = `**Evaluator**: FAIL (score=${score}/10) — overriding WAITING to CONTINUE. ${evalText.slice(0, 300)}\n\n`;
        ls.projectContent = appendJournalEntry(config, ls.projectContent, evalEntry, isCommentIteration);
        return { outcome: "continue" };
      }
    }
    const evalEntry = `**Evaluator**: PASS (score=${score}/10) — ${evalText.slice(0, 300)}\n\n`;
    ls.projectContent = appendJournalEntry(config, ls.projectContent, evalEntry, isCommentIteration);
    } // close else (LLM evaluation path)
  }

  // Log auto-conversion in journal
  if (decision.detail.startsWith("[Auto-converted from DONE]")) {
    const note = `**Auto-converted**: DONE → WAITING (awaiting human/May review). Agent cannot mark projects done.\n\n`;
    ls.projectContent = appendJournalEntry(config, ls.projectContent, note, isCommentIteration);
  }

  const cleanDetail = stripReviewerDirectives(decision.detail) || decision.detail;
  ls.projectContent = updateField(ls.projectContent, "Status", "waiting");
  ls.projectContent = updateField(ls.projectContent, "Stop Reason", cleanDetail.slice(0, 200));
  ls.projectContent = updateField(ls.projectContent, "Resume Condition", decision.resumeCondition || "Human/May review needed");
  ls.projectContent = updateSection(ls.projectContent, "Current State", currentStateLine("Waiting", cleanDetail));
  cachedWrite(config.projectPath, ls.projectContent);
  emitProjectEvent(ctx, config, "project.waiting", { iteration, reason: cleanDetail.slice(0, 100) });
  const msg = isCommentIteration
    ? `Waiting after comment at iteration ${iteration}: ${cleanDetail}`
    : `Waiting at iteration ${iteration}: ${cleanDetail}`;
  return { outcome: "stopped", result: ctx.done(msg) };
}

/**
 * Handle a BLOCKED decision: record stop reason, mark blocked.
 */
async function handleBlockedDecision(
  ctx: WorkflowContext,
  config: PersistentTaskConfig,
  ls: LoopState,
  iteration: number,
  decision: { status: string; detail: string; resumeCondition: string },
  isCommentIteration: boolean,
): Promise<WorkflowResult> {
  const cleanDetail = stripReviewerDirectives(decision.detail) || decision.detail;
  ls.projectContent = updateField(ls.projectContent, "Status", "blocked");
  ls.projectContent = updateField(ls.projectContent, "Stop Reason", cleanDetail.slice(0, 200));
  ls.projectContent = updateField(ls.projectContent, "Resume Condition", decision.resumeCondition || "Blocker resolved");
  ls.projectContent = updateSection(ls.projectContent, "Current State", currentStateLine("Blocked", cleanDetail));
  cachedWrite(config.projectPath, ls.projectContent);
  emitProjectEvent(ctx, config, "project.blocked", { iteration, reason: cleanDetail.slice(0, 100) });
  const msg = isCommentIteration
    ? `Blocked by comment at iteration ${iteration}: ${cleanDetail}`
    : `Blocked at iteration ${iteration}: ${cleanDetail}`;
  return ctx.escalate(msg);
}

/**
 * Process decisions. DONE is already converted to WAITING by extractDecision().
 * Only human/May can mark done via [done] comment.
 */
async function processDecision(
  ctx: WorkflowContext,
  config: PersistentTaskConfig,
  ls: LoopState,
  journalContent: string,
  iteration: number,
  decision: { status: string; detail: string; resumeCondition: string },
  isCommentIteration: boolean,
  features: Set<string>,
): Promise<WorkflowResult | null> {
  if (decision.status === "waiting") {
    const result = await handleWaitingDecision(ctx, config, ls, journalContent, iteration, decision, isCommentIteration, features);
    if (result.outcome === "stopped") return result.result;
    return null; // evaluator-gate overrode to CONTINUE
  }
  if (decision.status === "blocked") {
    return handleBlockedDecision(ctx, config, ls, iteration, decision, isCommentIteration);
  }
  return null; // continue
}

// ── Comment directive handler (reduces duplication) ───────────────────

interface DirectiveConfig {
  label: string;          // e.g. "CONTINUE", "PAUSED", "CANCELLED", "RESUMED", "DONE"
  status: string;         // new status field value
  event: string;          // event name to emit
  trigger: string;        // event trigger value
  currentState?: string;  // optional Current State update
  clearStopFields?: boolean; // clear Stop Reason + Resume Condition
  returnResult?: string;  // if set, return ctx.done(this). If null, continue loop.
}

function handleDirectiveComment(
  config: PersistentTaskConfig,
  projectContent: string,
  pendingComments: string,
  iteration: number,
  directive: DirectiveConfig,
  ctx: WorkflowContext,
): string {
  const now = new Date().toISOString();
  const commentEntry = `### Iteration ${iteration} (comment) — ${now}\n` +
    `**Comment**: ${pendingComments}\n` +
    `**Reviewer**: ${directive.label} — Marked ${directive.status} by human/May (JS fast-path, no LLM review needed).\n\n`;

  if (config.isLegacy) {
    projectContent += commentEntry;
  } else {
    cachedAppend(config.journalPath, commentEntry);
  }

  projectContent = clearComments(projectContent);
  projectContent = updateField(projectContent, "Iteration", String(iteration));
  projectContent = updateField(projectContent, "Status", directive.status);
  if (directive.clearStopFields) {
    projectContent = updateField(projectContent, "Stop Reason", "");
    projectContent = updateField(projectContent, "Resume Condition", "");
  }
  if (directive.currentState) {
    projectContent = updateSection(projectContent, "Current State", directive.currentState);
  }
  cachedWrite(config.projectPath, projectContent);
  markDiscussionRead(config.projectDir, iteration);
  emitProjectEvent(ctx, config, directive.event, { iteration, trigger: directive.trigger });
  return projectContent;
}

// ── Main workflow ──────────────────────────────────────────────────────

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  _cache.flush(); // Start each execution with a clean cache
  const config = parseInput(ctx.task, ctx.agent);

  // Create project directory if it doesn't exist
  if (!existsSync(config.projectPath)) {
    createProjectDir(config);
  }
  // Ensure journal exists
  if (!existsSync(config.journalPath) && !config.isLegacy) {
    ensureDir(dirname(config.journalPath));
    cachedWrite(config.journalPath, `# Journal\n\n`);
  }

  let projectContent = readFile(config.projectPath) ?? "";
  const journalContentAtStart = config.isLegacy ? projectContent : (readFile(config.journalPath) ?? "");
  let state = parseProjectState(projectContent);

  // Handle non-active states
  if (state.status === "paused") return ctx.done(`Task is paused.`);
  if (state.status === "cancelled") return ctx.done(`Task was cancelled.`);

  // Done/blocked projects: check for pending comments before exiting.
  // Comments can redirect, rescope, or unblock a project.
  const pendingCommentsBeforeStart = getPendingComments(projectContent, config.projectDir);
  if ((state.status === "done" || state.status === "blocked" || state.status === "waiting") && !pendingCommentsBeforeStart) {
    return ctx.done(`Task is ${state.status}. No pending comments.`);
  }
  // If there ARE pending comments on a done/blocked project, fall through to the loop
  // so the comment iteration processes them. The comment reviewer can change status.

  const durableLastIteration = Math.max(state.lastIteration, parseLastJournalIteration(journalContentAtStart));
  if (durableLastIteration > state.lastIteration) {
    projectContent = updateField(projectContent, "Iteration", String(durableLastIteration));
    cachedWrite(config.projectPath, projectContent);
    state = { ...state, lastIteration: durableLastIteration };
  }

  let iteration = durableLastIteration + 1;
  let consecutiveFailures = 0;
  let continueWithoutProgress = 0;
  let lastMilestoneDone = extractMilestones(projectContent).done;

  // Mark active only if not already done/blocked/waiting with pending comments
  // (those need comment iteration to decide the new status)
  if (state.status !== "done" && state.status !== "blocked" && state.status !== "waiting") {
    projectContent = updateField(projectContent, "Status", "active");
    cachedWrite(config.projectPath, projectContent);
  }

  while (iteration <= config.maxIterations) {
    // Re-read project file (owner may have changed status/comments)
    projectContent = readFile(config.projectPath) ?? projectContent;
    state = parseProjectState(projectContent);

    if (state.status === "paused") return ctx.done(`Paused by owner at iteration ${iteration}.`);
    if (state.status === "cancelled") return ctx.done(`Cancelled by owner at iteration ${iteration}.`);

    // Read journal for context
    const journalContent = config.isLegacy ? projectContent : (readFile(config.journalPath) ?? "");
    const features = parseFeatures(projectContent);

    // ── Comment iteration ─────────────────────────────────────────
    // Comments from meta.json or legacy ## Comments section. Process then mark read/clear.
    const pendingComments = getPendingComments(projectContent, config.projectDir);
    if (pendingComments) {
      ctx.emit({ type: "step_start", step: `comment-iteration-${iteration}` });

      // [done] comment = human/May marking project done — handle in pure JS (no LLM needed)
      const isDoneComment = /^\[done\]/m.test(pendingComments);
      const isResumeComment = /^\[resume\]/m.test(pendingComments);
      const isPauseComment = /^\[pause\]/m.test(pendingComments);
      const isCancelComment = /^\[cancel\]/m.test(pendingComments);
      const isContinueComment = /^\[continue\]/m.test(pendingComments);

      // JS fast-paths for mechanical directive comments (no LLM session needed)
      if (isContinueComment) {
        projectContent = handleDirectiveComment(config, projectContent, pendingComments, iteration,
          { label: "CONTINUE", status: "active", event: "project.resumed", trigger: "continue-comment", clearStopFields: true }, ctx);
        iteration++;
        continue;
      }

      if (isPauseComment) {
        projectContent = handleDirectiveComment(config, projectContent, pendingComments, iteration,
          { label: "PAUSED", status: "paused", event: "project.paused", trigger: "pause-comment", currentState: `Paused by human/May at iteration ${iteration}.` }, ctx);
        return ctx.done(`Project paused by human/May at iteration ${iteration}.`);
      }

      if (isCancelComment) {
        projectContent = handleDirectiveComment(config, projectContent, pendingComments, iteration,
          { label: "CANCELLED", status: "cancelled", event: "project.cancelled", trigger: "cancel-comment", currentState: `Cancelled by human/May at iteration ${iteration}.` }, ctx);
        return ctx.done(`Project cancelled by human/May at iteration ${iteration}.`);
      }

      if (isResumeComment) {
        projectContent = handleDirectiveComment(config, projectContent, pendingComments, iteration,
          { label: "RESUMED", status: "active", event: "project.resumed", trigger: "resume-comment", clearStopFields: true, currentState: `Resumed by human/May at iteration ${iteration}. Continuing work.` }, ctx);
        iteration++;
        continue;
      }

      if (isDoneComment) {
        projectContent = handleDirectiveComment(config, projectContent, pendingComments, iteration,
          { label: "DONE", status: "done", event: "project.completed", trigger: "done-comment", clearStopFields: true, currentState: `Completed. Marked done by human/May.` }, ctx);
        return ctx.done(`Project marked done by human/May at iteration ${iteration}.`);
      }

      // Non-done comments: run LLM reviewer to decide how to handle
      const commentWorkerSummary = `[COMMENT ITERATION] Comments to address:\n${pendingComments}`;

      const commentReviewPrompt = buildReviewPrompt(
        currentGoal(projectContent, config.goal), iteration,
        commentWorkerSummary,
        projectContent, journalContent, continueWithoutProgress, features
      );

      const projectContentBeforeReview = projectContent;
      const reviewResult = await ctx.runAgent(config.owner, commentReviewPrompt);
      const decision = extractDecision(reviewResult.status === "error"
        ? "CONTINUE — review errored, auto-continuing"
        : (reviewResult.lastAssistantText ?? ""));
      const reviewerText = reviewResult.lastAssistantText ?? "";
      const refreshedAfterReview = readFile(config.projectPath);
      const reviewerEditedProject = !!refreshedAfterReview && refreshedAfterReview !== projectContentBeforeReview;
      if (refreshedAfterReview) projectContent = refreshedAfterReview;

      const now = new Date().toISOString();
      const commentEntry = `### Iteration ${iteration} (comment) — ${now}\n` +
        `**Comment**: ${pendingComments}\n` +
        `**Reviewer**: ${decision.status.toUpperCase()} — ${decision.detail}\n\n`;

      if (config.isLegacy) {
        projectContent += commentEntry;
      } else {
        cachedAppend(config.journalPath, commentEntry);
      }

      // Clear comments — they're now in the journal
      projectContent = clearComments(projectContent);
      projectContent = applyReviewerProjectDirectives(projectContent, reviewerText);
      projectContent = updateField(projectContent, "Iteration", String(iteration));
      cachedWrite(config.projectPath, projectContent);

      // Mark discussion as read BEFORE processDecision can exit early
      markDiscussionRead(config.projectDir, iteration);

      {
        const ls: LoopState = { projectContent, continueWithoutProgress };
        const exitResult = await processDecision(ctx, config, ls, journalContent, iteration, decision, true, features);
        projectContent = ls.projectContent; continueWithoutProgress = ls.continueWithoutProgress;
        if (exitResult) return exitResult;
      }

      // CONTINUE — set active (may have been blocked/waiting), clear stop fields
      projectContent = updateField(projectContent, "Status", "active");
      projectContent = updateField(projectContent, "Stop Reason", "");
      projectContent = updateField(projectContent, "Resume Condition", "");
      if (!extractDirectiveBlock(reviewerText, "CURRENT_STATE_UPDATE") && !reviewerEditedProject) {
        projectContent = updateSection(projectContent, "Current State",
          `Active: human/May comment processed at iteration ${iteration}. Continuing with reviewer direction.\n` +
          `${decision.detail}\n`);
      }
      cachedWrite(config.projectPath, projectContent);
      iteration++;
      continue;
    }

    // ── Worker phase ─────────────────────────────────────────────
    ctx.emit({ type: "step_start", step: `worker-iteration-${iteration}` });

    const lastGuidance = getLastGuidance(journalContent, iteration);
    const workerPrompt = buildWorkerPrompt(
      projectContent, journalContent, config.projectPath, iteration, currentGoal(projectContent, config.goal), lastGuidance
    );

    const workerResult = await ctx.runAgent(config.worker, workerPrompt);

    if (workerResult.status === "error") {
      consecutiveFailures++;
      if (consecutiveFailures >= 2) {
        projectContent = updateField(projectContent, "Status", `blocked`);
        projectContent = updateSection(projectContent, "Current State",
          `Blocked: Worker failed ${consecutiveFailures} consecutive times.`);
        cachedWrite(config.projectPath, projectContent);
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
      cachedWrite(config.projectPath, projectContent);
    } else {
      cachedAppend(config.journalPath, journalEntry);
    }

    // Re-read project file from disk — worker may have checked off milestones or updated sections
    projectContent = readFile(config.projectPath) ?? projectContent;

    // Update iteration count (don't overwrite Current State - reviewer will update it after review)
    projectContent = updateField(projectContent, "Iteration", String(iteration));

    // Auto-catalog outputs/
    if (!config.isLegacy) {
      projectContent = catalogOutputs(config.projectDir, projectContent);
    }
    cachedWrite(config.projectPath, projectContent);

    // ── Budget checkpoint: auto-save before hitting turn limit ──
    if (shouldBudgetCheckpoint(config.projectDir, iteration, config.reviewEvery)) {
      const turnsEst = estimateTurnsUsed(iteration, iteration % config.reviewEvery === 0);
      const cpEntry = buildBudgetCheckpointEntry(iteration, turnsEst);
      if (config.isLegacy) {
        projectContent = appendToSection(projectContent, "Progress Log", cpEntry);
        cachedWrite(config.projectPath, projectContent);
      } else {
        cachedAppend(config.journalPath, cpEntry);
      }
      ctx.emit({ type: "budget_checkpoint", iteration, turnsEstimate: turnsEst });
      ctx.log(`[project] Budget checkpoint at iteration ${iteration} (~${turnsEst} turns)`);
      // Update status so if workflow is killed, the state reflects progress
      projectContent = updateField(projectContent, "Status", "paused");
      projectContent = updateSection(projectContent, "Current State",
        `Paused: budget checkpoint at iteration ${iteration}. ~${turnsEst}/${60} turns used. Resume to continue.`);
      cachedWrite(config.projectPath, projectContent);
      return ctx.done(`Budget checkpoint at iteration ${iteration} — saved progress before turn limit.`);
    }

    // ── Reviewer phase ───────────────────────────────────────────
    if (iteration % config.reviewEvery === 0) {
      ctx.emit({ type: "step_start", step: `review-iteration-${iteration}` });

      const reviewPrompt = buildReviewPrompt(
        currentGoal(projectContent, config.goal), iteration, workerSummary, projectContent, journalContent, continueWithoutProgress, features
      );

      const projectContentBeforeReview = projectContent;
      const reviewResult = await ctx.runAgent(config.owner, reviewPrompt);

      if (reviewResult.status === "error") {
        const reviewEntry = `**Reviewer**: CONTINUE — review errored, auto-continuing\n\n`;
        if (config.isLegacy) {
          projectContent += reviewEntry;
          cachedWrite(config.projectPath, projectContent);
        } else {
          cachedAppend(config.journalPath, reviewEntry);
        }
        iteration++;
        continue;
      }

      const decision = extractDecision(reviewResult.lastAssistantText ?? "");
      const reviewerText = reviewResult.lastAssistantText ?? "";
      const refreshedAfterReview = readFile(config.projectPath);
      const reviewerEditedProject = !!refreshedAfterReview && refreshedAfterReview !== projectContentBeforeReview;
      if (refreshedAfterReview) projectContent = refreshedAfterReview;
      const reviewEntry = `**Reviewer**: ${decision.status.toUpperCase()} — ${decision.detail}\n\n`;

      if (config.isLegacy) {
        projectContent += reviewEntry;
        cachedWrite(config.projectPath, projectContent);
      } else {
        cachedAppend(config.journalPath, reviewEntry);
      }

      // Update milestone checkboxes based on reviewer's assessment
      const beforeMs = extractMilestones(projectContent).done;
      projectContent = checkOffMilestones(projectContent, decision.detail);
      projectContent = applyReviewerProjectDirectives(projectContent, reviewerText);
      const afterMs = extractMilestones(projectContent).done;
      if (afterMs > beforeMs || projectContent !== readFile(config.projectPath)) cachedWrite(config.projectPath, projectContent);

      // Apply context updates from reviewer
      const contextMatch = decision.detail.match(/CONTEXT_UPDATE:\s*([\s\S]*?)(?=\n\*\*|\n##|\n\(|$)/i);
      if (contextMatch) {
        const newContext = contextMatch[1].trim();
        if (newContext) {
          const existingContext = extractSection(projectContent, "Context");
          const updatedContext = existingContext
            ? existingContext + "\n" + newContext
            : newContext;
          projectContent = updateSection(projectContent, "Context", updatedContext + "\n");
          cachedWrite(config.projectPath, projectContent);
        }
      }

      if (decision.status === "waiting" || decision.status === "blocked") {
        const ls: LoopState = { projectContent, continueWithoutProgress };
        const exitResult = await processDecision(ctx, config, ls, journalContent, iteration, decision, false, features);
        projectContent = ls.projectContent; continueWithoutProgress = ls.continueWithoutProgress;
        if (exitResult) return exitResult;
        // false done — continue to progress tracking
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

      // Emit iteration event for metrics tracking
      emitProjectEvent(ctx, config, "project.iteration", { iteration });

      // Auto-escalate after 5 iterations without milestone progress
      if (continueWithoutProgress >= 5) {
        projectContent = updateField(projectContent, "Status", "blocked");
        projectContent = updateSection(projectContent, "Current State",
          `Blocked: ${continueWithoutProgress} consecutive iterations without milestone progress. Approach needs rethinking.`);
        emitProjectEvent(ctx, config, "project.blocked", { iteration, health: 0, reason: decision.detail.slice(0, 100) });
        cachedWrite(config.projectPath, projectContent);
        return ctx.escalate(`Stuck: ${continueWithoutProgress} iterations without progress at iteration ${iteration}.`);
      }

      // Update Current State with reviewer's synthesis
      const ms = extractMilestones(projectContent);
      const reviewerInsight = decision.detail.replace(/^CONTINUE[:\s]*/i, "").trim();
      const reviewerStateUpdate = extractDirectiveBlock(reviewerText, "CURRENT_STATE_UPDATE");

      if (reviewerStateUpdate || !reviewerEditedProject) {
        projectContent = updateSection(projectContent, "Current State",
          reviewerStateUpdate
            ? `${reviewerStateUpdate}\n`
            : `Iteration ${iteration}. Milestones: ${ms.done}/${ms.total} done.\n` +
              (reviewerInsight ? `Reviewer: ${reviewerInsight}` : ""));

        cachedWrite(config.projectPath, projectContent);
      }

    }

    iteration++;
  }

  // Max iterations reached
  projectContent = updateField(projectContent, "Status", "paused");
  projectContent = updateSection(projectContent, "Current State",
    `Paused: reached ${config.maxIterations} iteration cap.`);
  cachedWrite(config.projectPath, projectContent);

  return ctx.done(`Paused after ${config.maxIterations} iterations (cap). Resume by re-running.`);
}
