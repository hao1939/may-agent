/// <reference path="../../types/workflow-defs.d.ts" />

/**
 * master-worker — Two persistent sessions (orchestrator + worker) running
 * a review-first → work → review → work loop.
 *
 * Project.md frontmatter:
 *   workflow: master-worker             (selects this workflow)
 *   max_iterations: 5                   (optional, default 50)
 *   status: active                      (paused/cancelled/blocked/waiting/closed stop dispatch)
 *   owner: bob
 *
 * Usage via CLI:
 *   bun src/app/may.ts --run-workflow master-worker "project: agents/shared/projects/my-project"
 */

import { readFileSync, existsSync, writeFileSync, appendFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import {
  extractField, extractSection, updateProjectStatus,
} from "./project-helpers.ts";
import { validateDispatch } from "./dispatch-validator.ts";
import {
  saveIncrementalCheckpoint,
  detectIncompleteCheckpoint,
  markCheckpointComplete,
  cleanupCheckpoints,
  type CheckpointData,
} from "./incremental-checkpoint.ts";
import { validateOutput, type ValidationResult } from "./output-validator.ts";
import { withRetry, isRetryableError } from "./provider-retry.ts";
import { estimateComplexity } from "./complexity-estimator.ts";
import { IterationTimer } from "./iteration-timer.ts";
import { recordIteration } from "../lib/iteration-monitor.ts";
import { recordUsage } from "../lib/cost-tracker.ts";
import { createBudget, type Budget as IterationBudget } from "./iteration-budget.ts";

// Global iteration timer for observability
const iterationTimer = new IterationTimer();

export const name: string = "master-worker";

export const description: string =
  "Two-session workflow: orchestrator directs strategy, worker executes. " +
  "Review-first pattern ensures focused work from iteration 1.";

// ── Config ──────────────────────────────────────────────────────────────

const DEFAULT_MAX_ITERATIONS = 50; // safety cap — workflow runs until done/blocked/waiting

// ── Workflow-owned live signals ────────────────────────────────────────

interface LiveRuntimeMetric {
  id: string;
  name: string | null;
  owner: string | null;
  priority: string | null;
  current: number | null;
  target: number | null;
  threshold: number | null;
  alertOp: string | null;
}

interface LiveRuntimeAlert {
  id: number;
  metricId: string | null;
  message: string | null;
  createdAt: number | null;
  metricName: string | null;
  owner: string | null;
  priority: string | null;
  current: number | null;
  target: number | null;
  threshold: number | null;
  latestJudgment: string | null;
  latestJudgmentAt: number | null;
}

export interface LiveRuntimeSignals {
  available: boolean;
  collectedAt: string;
  p0p1Metrics: LiveRuntimeMetric[];
  openAlerts: LiveRuntimeAlert[];
  counts: {
    activeP0P1Metrics: number;
    openP0P1Alerts: number;
    openLowerPriorityAlerts: number;
    activeProjectCount: number | null;
  };
  error?: string;
}

function normalizeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function firstFunctionText(result: any): string {
  return String(result?.lastAssistantText ?? result?.output ?? result ?? "");
}

function unavailableLiveRuntimeSignals(error: string): LiveRuntimeSignals {
  return {
    available: false,
    collectedAt: new Date().toISOString(),
    p0p1Metrics: [],
    openAlerts: [],
    counts: {
      activeP0P1Metrics: 0,
      openP0P1Alerts: 0,
      openLowerPriorityAlerts: 0,
      activeProjectCount: null,
    },
    error,
  };
}

export async function collectLiveRuntimeSignals(ctx: WorkflowContext): Promise<LiveRuntimeSignals> {
  const load = async () => {
    const getDb = (ctx as any).getDb;
    if (typeof getDb !== "function") {
      return unavailableLiveRuntimeSignals("runtime DB is not available in this workflow context");
    }

    const db = getDb.call(ctx) as any;
    const p0p1Rows = db.prepare(
      `SELECT id, name, owner, priority, current, target, threshold, alert_op as alertOp
       FROM metrics
       WHERE COALESCE(status, 'active') = 'active'
         AND COALESCE(priority, 'P2') IN ('P0', 'P1')
       ORDER BY COALESCE(priority, 'P2') ASC, id ASC`,
    ).all() as any[];

    const alertRows = db.prepare(
      `SELECT ma.id, ma.metric_id as metricId, ma.message, ma.created_at as createdAt,
              m.name as metricName, m.owner, COALESCE(m.priority, 'P2') as priority,
              m.current, m.target, m.threshold,
              (
                SELECT e.data
                FROM events e
                WHERE e.event_type = 'metric.alert_judged'
                  AND (
                    json_extract(e.data, '$.alertId') = ma.id
                    OR json_extract(e.data, '$.metricId') = ma.metric_id
                  )
                ORDER BY e.timestamp DESC
                LIMIT 1
              ) as latestJudgment,
              (
                SELECT e.timestamp
                FROM events e
                WHERE e.event_type = 'metric.alert_judged'
                  AND (
                    json_extract(e.data, '$.alertId') = ma.id
                    OR json_extract(e.data, '$.metricId') = ma.metric_id
                  )
                ORDER BY e.timestamp DESC
                LIMIT 1
              ) as latestJudgmentAt
       FROM metric_alerts ma
       LEFT JOIN metrics m ON m.id = ma.metric_id
       WHERE ma.resolved_at IS NULL
       ORDER BY COALESCE(m.priority, 'P2') ASC, ma.created_at ASC
       LIMIT 20`,
    ).all() as any[];

    const activeProject = db.prepare(
      `SELECT current
       FROM metrics
       WHERE id = 'project.active-count' OR name = 'project.active-count'
       ORDER BY updated_at DESC
       LIMIT 1`,
    ).get() as { current?: number } | null;

    const openP0P1Alerts = alertRows.filter((row) => ["P0", "P1"].includes(String(row.priority ?? "P2"))).length;
    return {
      available: true,
      collectedAt: new Date().toISOString(),
      p0p1Metrics: p0p1Rows.map((row) => ({
        id: String(row.id),
        name: normalizeString(row.name),
        owner: normalizeString(row.owner),
        priority: normalizeString(row.priority),
        current: normalizeNumber(row.current),
        target: normalizeNumber(row.target),
        threshold: normalizeNumber(row.threshold),
        alertOp: normalizeString(row.alertOp),
      })),
      openAlerts: alertRows.map((row) => ({
        id: Number(row.id),
        metricId: normalizeString(row.metricId),
        message: normalizeString(row.message),
        createdAt: normalizeNumber(row.createdAt),
        metricName: normalizeString(row.metricName),
        owner: normalizeString(row.owner),
        priority: normalizeString(row.priority),
        current: normalizeNumber(row.current),
        target: normalizeNumber(row.target),
        threshold: normalizeNumber(row.threshold),
        latestJudgment: normalizeString(row.latestJudgment),
        latestJudgmentAt: normalizeNumber(row.latestJudgmentAt),
      })),
      counts: {
        activeP0P1Metrics: p0p1Rows.length,
        openP0P1Alerts,
        openLowerPriorityAlerts: Math.max(0, alertRows.length - openP0P1Alerts),
        activeProjectCount: normalizeNumber(activeProject?.current),
      },
    } satisfies LiveRuntimeSignals;
  };

  try {
    if (typeof (ctx as any).runFunction === "function") {
      const result = await (ctx as any).runFunction("collect-live-runtime-signals", async () => JSON.stringify(await load()));
      return JSON.parse(firstFunctionText(result)) as LiveRuntimeSignals;
    }
    return await load();
  } catch (error) {
    return unavailableLiveRuntimeSignals(String(error instanceof Error ? error.message : error).slice(0, 300));
  }
}

function metricValue(value: number | null): string {
  return value === null ? "?" : String(value);
}

export function formatLiveRuntimeSignals(signals: LiveRuntimeSignals): string {
  const lines = [
    "## Live Runtime Signals (workflow-collected)",
    `Status: ${signals.available ? "available" : "unavailable"}`,
    `Collected at: ${signals.collectedAt}`,
  ];

  if (!signals.available) {
    lines.push(`Error: ${signals.error ?? "unknown"}`);
    lines.push("Do not claim live metric health from this block. Query the runtime DB only if current metric evidence is required.");
    return lines.join("\n");
  }

  lines.push(
    `Counts: active P0/P1 metrics=${signals.counts.activeP0P1Metrics}; open P0/P1 alerts=${signals.counts.openP0P1Alerts}; open lower-priority alerts=${signals.counts.openLowerPriorityAlerts}; active projects=${metricValue(signals.counts.activeProjectCount)}`,
  );

  if (signals.p0p1Metrics.length) {
    lines.push("P0/P1 metrics:");
    for (const metric of signals.p0p1Metrics.slice(0, 12)) {
      lines.push(
        `- ${metric.id} (${metric.priority ?? "P?"}, owner=${metric.owner ?? "?"}): current=${metricValue(metric.current)}, target=${metricValue(metric.target)}, threshold=${metricValue(metric.threshold)}, alert_op=${metric.alertOp ?? "?"}`,
      );
    }
  } else {
    lines.push("P0/P1 metrics: none active.");
  }

  if (signals.openAlerts.length) {
    lines.push("Open alerts:");
    for (const alert of signals.openAlerts) {
      let judgment = "latest_judgment=none";
      if (alert.latestJudgment) {
        try {
          const data = JSON.parse(alert.latestJudgment) as Record<string, unknown>;
          judgment = `latest_judgment=operation:${String(data.operation ?? "unknown")}, next:${String(data.nextValidation ?? data.next_validation ?? "unknown")}`;
        } catch {
          judgment = "latest_judgment=unparseable";
        }
      }
      lines.push(
        `- #${alert.id} ${alert.metricId ?? "unknown"} (${alert.priority ?? "P?"}, owner=${alert.owner ?? "?"}): ${alert.message ?? "no message"} | current=${metricValue(alert.current)}, target=${metricValue(alert.target)}, threshold=${metricValue(alert.threshold)} | ${judgment}`,
      );
    }
  } else {
    lines.push("Open alerts: none.");
  }

  return lines.join("\n");
}

// ── Decision extraction ─────────────────────────────────────────────────

interface Decision {
  status: "continue" | "pivot" | "waiting" | "blocked" | "done" | "unknown";
  detail: string;
}

function hasUncheckedTaskItems(content: string): boolean {
  return /^\s*[-*+]\s+\[\s\]\s+\S/m.test(content);
}

function hasCompleteTaskList(content: string): boolean {
  const taskItems = content.match(/^\s*[-*+]\s+\[[ xX]\]\s+\S.*$/gm) ?? [];
  return taskItems.length > 0 && !hasUncheckedTaskItems(content);
}

function guardDoneWithPendingProjectWork(
  decision: Decision,
  projectFile: string,
  ctx: WorkflowContext,
  phase: "plan" | "review",
): Decision {
  if (decision.status !== "done") return decision;

  let currentContent = "";
  try {
    currentContent = readFileSync(projectFile, "utf-8");
  } catch {
    return decision;
  }

  if (!hasUncheckedTaskItems(currentContent)) return decision;

  const detail = [
    "CONTINUE",
    "",
    "DONE refused: project.md still has unchecked task-list items.",
    "Next iteration must resolve, explicitly re-plan, or mark those items blocked/waiting with evidence before idling this workflow pass.",
  ].join("\n");
  ctx.log(`[${phase}] DONE refused: project.md still has unchecked task-list items`);
  return { status: "continue", detail };
}

function coerceUnknownToDoneWhenNoPendingProjectWork(
  decision: Decision,
  projectFile: string,
  ctx: WorkflowContext,
  phase: "plan" | "review",
): Decision {
  if (decision.status !== "unknown") return decision;

  let currentContent = "";
  try {
    currentContent = readFileSync(projectFile, "utf-8");
  } catch {
    return decision;
  }

  if (!hasCompleteTaskList(currentContent)) return decision;

  const detail = "DONE\n\nProject has task-list items and all are checked. No immediate operation for this workflow pass; keep the project active for future metric/event checks.";
  ctx.log(`[${phase}] Unknown decision treated as DONE: project.md has no unchecked task-list items`);
  return { status: "done", detail };
}

function safeLastText(session: { lastText?: () => string } | null | undefined): string {
  try {
    const text = session?.lastText?.();
    return typeof text === "string" ? text : "";
  } catch {
    return "";
  }
}

export function extractDecision(text: string): Decision {
  const trimmed = text.trim();
  const firstLine = trimmed.split("\n")[0] || "";
  const upper = firstLine.toUpperCase();

  // Check first line starts with a decision keyword
  for (const s of ["CONTINUE", "PIVOT", "WAITING", "BLOCKED"] as const) {
    if (upper.startsWith(s)) {
      return { status: s.toLowerCase() as Decision["status"], detail: trimmed.slice(0, 500) };
    }
  }

  // Check for DONE/COMPLETE — project is finished, stop dispatching
  if (upper.startsWith("DONE") || upper.startsWith("COMPLETE")) {
    return { status: "done", detail: trimmed.slice(0, 500) };
  }

  // Check for "Decision: KEYWORD", "**KEYWORD**", or "**Proceed**" patterns
  const decisionPattern = /(?:\*{0,2}Decision\*{0,2}[:\s]+\*{0,2}|^|\n)\*{0,2}(CONTINUE|PIVOT|BLOCKED|WAITING)\*{0,2}/im;
  const patternMatch = trimmed.match(decisionPattern);
  if (patternMatch) {
    return { status: patternMatch[1].toLowerCase() as Decision["status"], detail: trimmed.slice(0, 500) };
  }

  // Terminal no-op phrasing from orchestrators should stop the current run,
  // not become worker guidance. This commonly appears when a durable project
  // stays active for future observation after all plan items are complete.
  const planComplete = /\ball\s+(?:\d+\s+)?(?:plan\s+items|tasks?|items|milestones)\s+(?:are\s+)?(?:verified\s+)?(?:complete|completed|checked off)\b/i.test(trimmed);
  const metricsHealthy = /\ball\s+(?:P\d\/?)*\s*metrics\s+(?:are\s+)?(?:at|above|in range|healthy|green)\b/i.test(trimmed);
  const noNewWork = /\bno\s+(?:new\s+)?work\s+(?:is\s+)?(?:needed|required|remaining)\b/i.test(trimmed);
  const activeObservation = /\bproject\s+(?:stays|remains)\s+active\s+for\s+(?:ongoing\s+)?observation\b/i.test(trimmed);
  const noImmediateOperation = /\bno\s+immediate\s+(?:next\s+)?operation\b/i.test(trimmed);
  if ((planComplete && (metricsHealthy || noNewWork || activeObservation)) || (noNewWork && activeObservation) || noImmediateOperation) {
    return { status: "done", detail: trimmed.slice(0, 500) };
  }

  // "Proceed" / "move forward" / "start working" → CONTINUE
  if (/\b(proceed|move forward|start working|begin work|let'?s begin|let'?s start)\b/i.test(trimmed)) {
    return { status: "continue", detail: trimmed.slice(0, 500) };
  }

  // Fallback: check DONE/COMPLETE first — a completed project should stop (EXP-700, Fix 1)
  // Previously CONTINUE was checked before DONE, causing 58% post-DONE overrun (EXP-650)
  if (/\b(DONE|COMPLETE|COMPLETED)\b/i.test(trimmed) && /\b(project|all\s+metrics|all\s+milestones|stop\s+dispatching|finished|stop)\b/i.test(trimmed)) {
    return { status: "done", detail: trimmed.slice(0, 500) };
  }

  // Then scan for other uppercase keywords
  for (const keyword of ["CONTINUE", "PIVOT", "BLOCKED", "WAITING"] as const) {
    if (new RegExp(`\\b${keyword}\\b`).test(trimmed)) {
      return { status: keyword.toLowerCase() as Decision["status"], detail: trimmed.slice(0, 500) };
    }
  }

  return { status: "unknown", detail: trimmed.slice(0, 500) };
}

// ── System prompts ──────────────────────────────────────────────────────

export function orchestratorSystemPrompt(projectDir: string): string {
  return `You are the orchestrator and project maintainer.
Your role: assess state, direct the worker when there is real work, verify deliverables, and update project.md when project state changes.

The project directory is: ${projectDir}
You are the ONLY authority on project status. The worker cannot see or edit project.md.

Update project.md directly when there is a material state change:
- Check off plan items when you verify the deliverable exists and works
- Update Current State with findings and decisions
- When you reach "Re-plan", review metrics and write new plan items + another Re-plan
- Keep Status as: active (working), waiting (need input), or blocked (something broken)
- If all plan items are done and metrics are healthy, do not edit just to create activity.

You can read any file to verify claims. You can edit project.md. Do NOT edit other files.

Your job is to PUSH THE PROJECT FORWARD:
1. Understand the goal. Metrics are signals, not the goal itself.
2. Design good metrics that measure real progress toward the goal. Refine them as you learn.
3. Do the work that moves metrics toward targets — the actual improvement, not just measurement.
4. When the goal is not met, write new plan items based on what you learned. When the goal is met for this pass, stop cleanly.

Metrics tell you where you are. The work is what gets you there.
Good metrics are measurable, connected to the goal, and have clear targets.
Bad metrics get gamed or ignored. If a metric doesn't drive real progress, redefine it.
Use the workflow-collected Live Runtime Signals block as primary current metric evidence.
Only call query_db if those signals are unavailable, missing, or inconsistent with other facts.
If you must manually query because Live Runtime Signals are unavailable, treat that as a workflow reliability issue:
- Continue only after collecting the needed live facts yourself.
- Record the workflow signal failure as a finding or plan item unless you can fix it immediately.
- Do not silently normalize manual fallback; the workflow should collect these facts on later runs.
The embedded project.md is context, not current metric evidence.
For projects whose goal/signals explicitly mention reliability, closed-loop, or metric alerts:
- Open alerts in the Live Runtime Signals block are in scope even when they are lower priority or owned by another agent.
- Do not mark an alert-related plan item complete merely because the metric has an owner.
- Completion requires durable evidence: latest judgment, concrete operation, and next validation signal; otherwise CONTINUE by nudging the owner, adding/adjusting a project, calibrating the metric, or documenting a real exception.

Respond with one of these decisions as the VERY FIRST WORD:
CONTINUE — guide the next iteration. If metrics are at target, raise them or find new problems.
PIVOT — current approach isn't working, try something different.
DONE — this execution has no immediate next operation. The project remains active for future metric/event checks.
BLOCKED — something external is broken that you cannot fix.
WAITING — you need something specific from a human (approval, credentials, access). Say exactly what.

Push forward on real goals. But recognize when this execution should stop:
- If ALL plan items are checked off AND ALL metrics are at/above target → say DONE for this run.
- If project.md still contains unchecked task-list items like "- [ ]", do not say DONE.
- If saying DONE because metrics are healthy, cite live metric evidence from the workflow-collected block, not only project.md prose.
- Do NOT invent new work (extra tests, tooling, docs) after goals are met. That's busywork.
- Expanding scope requires explicit new goals from the project owner, not the orchestrator.
- Do NOT close the project when saying DONE. Durable projects stay active so cron/event checks can maintain them.
- For observation-only DONE, do not modify project.md or commit generated runtime files.

Example response format:
CONTINUE

(a) Next iteration should produce...
(b) What's different...
(c) First step...

VERIFICATION RULE: After each worker iteration, verify deliverables exist with read() or bash(ls).
If the worker claims success but files don't exist, the worker is wrong.
If 3+ consecutive iterations produce no files, WRITE THE FILE YOURSELF or provide exact content in guidance.`;
}

export function workerSystemPrompt(projectDir: string): string {
  const outputsDir = projectDir + "/outputs";
  return `You are a worker. You receive focused tasks and produce concrete deliverables.

Your outputs directory: ${outputsDir}
Put ALL deliverables (reports, code, analysis) in this directory.

Rules:
- All deliverables go in ${outputsDir}
- Do NOT edit project.md, journal.md, or discussion.md
- Focus on the specific task in the guidance
- When done, summarize what you created and where

WRITE-FIRST CONSTRAINT:
- When your task says to write or produce a file, your FIRST tool call SHOULD be write() unless you must inspect code/data first to create a substantive deliverable.
- Do NOT claim files "already exist" without verifying via read(). False completion claims are a critical failure mode.
- If your task provides the exact content to write, write it immediately. Otherwise gather the minimum context needed, then write/edit the deliverable.

SESSION CONTRACT:
- You are starting a FRESH session. Your job is to produce FILES, not verify state.
- If the task seems "already done": produce a verification report or improvement.
- If truly nothing remains: write a completion-evidence file documenting WHY with specific tool output.
- An empty session (0 files produced) is always a failure, regardless of project state.`;
}

// ── Output verification ─────────────────────────────────────────────────

/** Snapshot file mtimes in a directory (recursive, 2 levels deep) */
export function snapshotOutputs(dir: string): Map<string, number> {
  const snap = new Map<string, number>();
  if (!existsSync(dir)) return snap;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isFile()) {
        snap.set(full, statSync(full).mtimeMs);
      } else if (entry.isDirectory()) {
        for (const sub of readdirSync(full, { withFileTypes: true })) {
          if (sub.isFile()) {
            const subFull = join(full, sub.name);
            snap.set(subFull, statSync(subFull).mtimeMs);
          }
        }
      }
    }
  } catch {}
  return snap;
}

/** Compare before/after snapshots, return list of new or modified files */
export function diffSnapshots(before: Map<string, number>, after: Map<string, number>): string[] {
  const changed: string[] = [];
  for (const [path, mtime] of after) {
    const prev = before.get(path);
    if (prev === undefined || mtime > prev) {
      changed.push(path);
    }
  }
  return changed;
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

  // Pre-flight validation via dispatch-validator
  const validation = validateDispatch(ctx.task, ctx.projectRoot);
  if (!validation.valid) {
    return ctx.escalate(`Dispatch validation failed:\n${validation.errors.join("\n")}`);
  }

  if (!existsSync(projectFile)) {
    ctx.log?.(`Skipping: no project.md at ${projectFile}`);
    return { status: "skipped", reason: "project-not-found", path: projectFile };
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

  if (status === "paused" || status === "cancelled" || status === "done" || status === "complete" || status === "completed") {
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
  let orchestrator = await ctx.createSession({
    systemPrompt: orchestratorSystemPrompt(projectDir),
    tools: "full",
    label: "orchestrator",
  });

  // Create worker sessions per iteration, not once for the whole workflow.
  // Reusing a persistent worker conversation causes old SESSION INTENT blocks and
  // prior assistant/user turns to accumulate, which has produced blank/error
  // worker sessions when later iterations inherit stale instructions.
  let worker: Awaited<ReturnType<WorkflowContext["createSession"]>> | null = null;

  try {
    // ── Phase 1: Planning — orchestrator assesses current state ──
    ctx.log("[plan] Orchestrator assessing project state...");

    const liveRuntimeSignals = await collectLiveRuntimeSignals(ctx);
    const liveRuntimeSignalsBlock = formatLiveRuntimeSignals(liveRuntimeSignals);
    ctx.log(`[plan] Live runtime signals: ${liveRuntimeSignals.available ? "available" : `unavailable (${liveRuntimeSignals.error ?? "unknown"})`}`);

    let planningPrompt = `Assess this project and decide what to do next.

${liveRuntimeSignalsBlock}

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

    const planningResult = await withRetry(() => orchestrator.prompt(planningPrompt), {
      maxRetries: 3,
      baseDelayMs: 1000,
      onRetry: (err, attempt, delay) => ctx.log(`[plan] ⚠️ Provider error, retry ${attempt} after ${delay}ms: ${String(err).slice(0, 80)}`),
    });
    if (!planningResult.success) {
      const err = planningResult.error instanceof Error ? planningResult.error : new Error(String(planningResult.error));
      ctx.log(`[plan] Provider failed after ${planningResult.attempts} attempt(s): ${err.message.slice(0, 200)}`);
      throw err;
    }


    // Mark comments as read (append-only, never delete)
    if (unreadComments) {
      try {
        appendFileSync(discussionFile, `\n---read @plan---\n`, "utf-8");
      } catch {}
    }

    let decision = coerceUnknownToDoneWhenNoPendingProjectWork(
      guardDoneWithPendingProjectWork(
        extractDecision(safeLastText(orchestrator)),
        projectFile,
        ctx,
        "plan",
      ),
      projectFile,
      ctx,
      "plan",
    );
    ctx.log(`[plan] Decision: ${decision.status.toUpperCase()}`);

    // Treat "unknown" as CONTINUE for the planning phase — orchestrator gave guidance but didn't use the keyword
    if (decision.status === "unknown") {
      ctx.log("[plan] Decision unclear — treating as CONTINUE");
      decision.status = "continue";
    }

    if (decision.status !== "continue" && decision.status !== "pivot") {
      const stopReason = decision.detail.slice(0, 200);
      // DONE ends this workflow pass but keeps the durable project active.
      const safeStatus = decision.status;
      updateProjectStatus(projectFile, safeStatus === "done" ? "active" : safeStatus, safeStatus === "done" ? undefined : stopReason);
      return safeStatus === "blocked"
        ? ctx.escalate(stopReason)
        : ctx.done(`${safeStatus}: ${stopReason}`);
    }

    // ── Phase 2+: Work-review loop ──
    let iteration = 0;

    // Clean up old checkpoints at workflow start
    cleanupCheckpoints(projectDir, 5);

    while (iteration < maxIterations && (decision.status === "continue" || decision.status === "pivot")) {
      iteration++;

      // ── Work phase ──
      ctx.log(`[work] Iteration ${iteration}/${maxIterations} starting...`);
      const iterationId = `iter-${iteration}`;
      iterationTimer.startIteration(iterationId);
      const guidance = decision.detail || safeLastText(orchestrator);

      // Estimate task complexity and set appropriate timeout
      const complexity = estimateComplexity(guidance);
      ctx.log(`[work] 📊 Complexity: ${complexity.score}/5 (${complexity.description}), timeout: ${complexity.timeoutMs}ms`);

      // Create iteration budget based on complexity score
      const iterBudget = createBudget(complexity.score);
      const budgetConfig = iterBudget.getConfig();
      ctx.log(`[work] 💰 Budget: ${budgetConfig.maxTimeMs / 1000}s time, ${budgetConfig.maxTokens} tokens`);

      const outputsDir = join(dirname(projectDir), "outputs");

      // Generate a session-scoped checkpoint ID for this iteration
      const checkpointSessionId = `iter-${iteration}-${Date.now()}`;

      // Detect incomplete checkpoint from a previous crashed iteration
      const incompleteCheckpoint = detectIncompleteCheckpoint(projectDir);
      if (incompleteCheckpoint) {
        ctx.log(`[work] 🔄 Found incomplete checkpoint from session ${incompleteCheckpoint.sessionId} (iteration ${incompleteCheckpoint.iteration}, step ${incompleteCheckpoint.step}). Resuming context.`);
        // Mark the old one complete so we don't re-detect it
        markCheckpointComplete(projectDir, incompleteCheckpoint.sessionId);
      }

      // Track consecutive zero-output iterations for escalation
      if (typeof (ctx as any)._consecutiveZeroOutput === 'undefined') {
        (ctx as any)._consecutiveZeroOutput = 0;
      }
      const MAX_ZERO_OUTPUT = 3;

      // Snapshot outputs before worker runs
      const beforeSnap = snapshotOutputs(outputsDir);

      // V3 GUARDRAIL: Pre-create stub file for write-first tasks
      let stubFilePath: string | null = null;
      const writeFirstFileMatch = guidance.match(/(?:write|produce|create|generate)\s*\(?[`']([^`']+)[`']/i)
        || guidance.match(/outputs\/([^\s`'*]+)/i);
      if (writeFirstFileMatch) {
        const targetFile = writeFirstFileMatch[1].startsWith('outputs/')
          ? writeFirstFileMatch[1]
          : writeFirstFileMatch[0].startsWith('outputs/')
            ? writeFirstFileMatch[0].match(/outputs\/[^\s`'*)]+/)?.[0] || null
            : null;
        if (targetFile) {
          stubFilePath = join(outputsDir, '..', targetFile);
          const stubContent = `<!-- STUB: This file was pre-created by the workflow. Replace this content with your deliverable. -->\n`;
          writeFileSync(stubFilePath, stubContent, 'utf-8');
          ctx.log(`[work] 📝 V3: Pre-created stub file: ${targetFile}`);
        }
      }

      // Worker gets ONLY the orchestrator's guidance — no project.md access.
      // Start a fresh worker conversation every iteration so previous SESSION INTENT
      // blocks cannot be replayed as stale user/assistant context.
      try { worker?.close(); } catch {}
      worker = await ctx.createSession({
        systemPrompt: workerSystemPrompt(dirname(projectDir)),
        tools: "full",
        label: "worker",
      });

      // EXP-910: Session Intent Header separates intent from context to prevent ghost completions
      let workerPrompt = `## 🎯 SESSION INTENT (this is your job RIGHT NOW)
Action: Complete iteration ${iteration} — produce files as evidence of progress.
Success = at least one file written/edited with substantive content.
Failure = reporting "already done" or producing 0 files.

---

## 📋 YOUR TASK (from orchestrator)
${guidance}`;
      if (stubFilePath) {
        const relPath = stubFilePath.replace(/.*?(outputs\/)/, 'outputs/');
        workerPrompt = `## 🎯 SESSION INTENT (this is your job RIGHT NOW)
Action: Complete iteration ${iteration} — produce files as evidence of progress.
Success = at least one file written/edited with substantive content.
Failure = reporting "already done" or producing 0 files.

---

## 📋 YOUR TASK (from orchestrator)
WRITE-FIRST CONSTRAINT:\n- A stub file has been pre-created at \`${relPath}\`. Your FIRST tool call MUST be edit() to replace the stub content.\n- Use this structure for your first edit:\n\n# [Task Summary]\n## Status: IN_PROGRESS\n## What I know so far\n[1-2 sentences: what the task needs]\n## My plan\n[numbered steps]\n## Work output below\n[your actual deliverable content starts here]\n\n- After this first edit, continue working normally. Update the file as you make progress.\n\n${guidance}`;
      }

      // EXP-500: Pre-read injection for edit tasks targeting existing files
      if (!stubFilePath) {
        const editTargetMatch = guidance.match(/(?:edit|update|modify|change|fix|replace|add to|append)\s+(?:in\s+)?[`']([^`']+)[`']/i)
          || guidance.match(/(?:edit|update|modify)\s+(\S+\.\w{1,5})/i);
        if (editTargetMatch) {
          const targetFile = editTargetMatch[1];
          const candidates = [
            join(outputsDir, targetFile),
            join(outputsDir, '..', targetFile),
            targetFile.startsWith('/') ? targetFile : join(projectDir, targetFile),
          ];
          for (const candidate of candidates) {
            try {
              if (existsSync(candidate) && statSync(candidate).isFile() && statSync(candidate).size < 50000) {
                const content = readFileSync(candidate, 'utf-8');
                const lines = content.split('\n');
                const preview = lines.slice(0, 200).join('\n');
                const truncated = lines.length > 200 ? `\n[... ${lines.length - 200} more lines truncated]` : '';
                workerPrompt += `\n\n---\nCURRENT FILE STATE (auto-injected for accurate edit):\nPath: ${candidate}\n\`\`\`\n${preview}${truncated}\n\`\`\`\nUse exact text from above as oldText in edit() calls.`;
                ctx.log(`[work] EXP-500: Pre-read injected ${candidate} (${lines.length} lines)`);
                break;
              }
            } catch { /* skip unreadable files */ }
          }
        }
      }

      // EXP-510: Completion quality injection for worker sessions
      workerPrompt += `\n\n---\nCOMPLETION REQUIREMENTS (structural — do not skip):\n1. Produce at least one file write/edit as deliverable evidence\n2. VERIFICATION GATE (mandatory): For every file you write() or edit(), you MUST read() it back BEFORE calling finish(). Your finish() call will be rejected if deliverables include files you haven't read after modifying. List each verified file in your summary.\n3. Call finish() with: status ('success'|'partial'|'failure'), summary (1-2 sentences of what you did), and deliverables (list of files modified)\n4. If task cannot be completed, finish(status:'blocked') with explanation\n\nDo NOT call finish({}) with empty input. Your finish() call IS your deliverable receipt.\n5. PATH RULE: ALL file paths must be relative to the project root (e.g. agents/bob/workspace/file.md). NEVER use absolute paths (/Users/*, /home/*, /root/*, ~/*).`;
      ctx.log(`[work] EXP-510: Completion quality block injected`);

      // EXP-565: Threat-framed verify-after-edit gate (proven +100pp in gym)
      workerPrompt += `\n\n⚠️ VERIFY-AFTER-EDIT RULE (session REJECTED if violated):\nAfter EVERY write() or edit() call, you MUST immediately read() the same file to confirm the change landed correctly. If you call finish() without verifying each modified file, your session will be REJECTED and marked as a failure. This is non-negotiable.`;
      ctx.log(`[work] EXP-565: Threat-framed verify-after-edit gate injected`);

      // EXP-720: Few-shot dry-run logging (measure match rate before full injection)
      try {
        const { selectExamples } = await import("./fewshot-inject-helpers.js");
        const matches = selectExamples(guidance);
        if (matches.length > 0) {
          const logLine = JSON.stringify({
            ts: new Date().toISOString(),
            iteration,
            matchedFiles: matches,
            guidancePreview: guidance.slice(0, 200),
          });
          appendFileSync("agents/shared/exp720-fewshot-dryrun.log", logLine + "\n");
          ctx.log(`[work] EXP-720 dry-run: ${matches.length} few-shot match(es) — NOT injected yet`);
        }
      } catch { /* EXP-720: non-critical — don't break worker flow */ }

      let workerResult = await withRetry(() => worker!.prompt(workerPrompt), {
        maxRetries: 3,
        baseDelayMs: 1000,
        onRetry: (err, attempt, delay) => ctx.log(`[work] ⚠️ Provider error on worker, retry ${attempt} after ${delay}ms: ${String(err).slice(0, 80)}`),
      });
      if (!workerResult.success) {
        const err = workerResult.error instanceof Error ? workerResult.error : new Error(String(workerResult.error));
        const errMsg = err.message.slice(0, 200);
        ctx.log(`[work] Provider failed after ${workerResult.attempts} attempt(s): ${errMsg}`);

        // The May API can return a synthetic "Clean start (fresh)" interruption
        // when a persisted worker session is reaped/restarted mid-iteration.
        // Retrying on the same SessionHandle just replays into the stale handle;
        // start a fresh worker session once and rerun the exact same prompt.
        if (/Clean start \(fresh\)/i.test(err.message)) {
          ctx.log("[work] Worker session was reaped (Clean start); recreating worker session and retrying once");
          try { worker?.close(); } catch {}
          worker = await ctx.createSession({
            systemPrompt: workerSystemPrompt(dirname(projectDir)),
            tools: "full",
            label: "worker",
          });
          workerResult = await withRetry(() => worker!.prompt(workerPrompt), {
            maxRetries: 1,
            baseDelayMs: 1000,
            onRetry: (retryErr, attempt, delay) => ctx.log(`[work] ⚠️ Provider error on fresh worker, retry ${attempt} after ${delay}ms: ${String(retryErr).slice(0, 80)}`),
          });
          if (!workerResult.success) {
            const retryErr = workerResult.error instanceof Error ? workerResult.error : new Error(String(workerResult.error));
            ctx.log(`[work] Fresh worker failed after ${workerResult.attempts} attempt(s): ${retryErr.message.slice(0, 200)}`);
            throw retryErr;
          }
        } else {
          throw err;
        }
      }
      ctx.log(`[work] Iteration ${iteration} done`);

      // Capture the worker text immediately after prompt completion. A session can
      // finish successfully via tool-only messages and then emit an empty final
      // assistant text; in that case, use the structured prompt result so the
      // review phase does not treat successful work as a blank/error response.
      const workerTextAfterPrompt = safeLastText(worker) || ctx.summarize(workerResult.value, { maxLength: 1500 });

      // Track budget consumption (approximate tokens from response length)
      const approxTokens = Math.ceil(workerTextAfterPrompt.length / 4);
      iterBudget.consume(approxTokens);
      const budgetStatus = iterBudget.check();
      if (budgetStatus.exceeded) {
        ctx.log(`[work] ⚠️ Budget exceeded! time=${budgetStatus.timeExceeded}, tokens=${budgetStatus.tokensExceeded} (consumed ~${approxTokens} tokens)`);
      } else {
        ctx.log(`[work] 💰 Budget OK: ${budgetStatus.tokensRemaining} tokens remaining, ${Math.round(budgetStatus.timeRemaining / 1000)}s time remaining`);
      }

      // End iteration timer and log duration
      const timing = iterationTimer.endIteration(iterationId);
      ctx.log(`[work] ⏱️ Iteration ${iteration} took ${timing.durationFormatted}`);
      const stats = iterationTimer.getStats();
      if (stats.count > 1) {
        ctx.log(`[work] 📈 Stats: avg=${Math.round(stats.avg)}ms, median=${Math.round(stats.median)}ms, p95=${Math.round(stats.p95)}ms (n=${stats.count})`);
      }

      // Save incremental checkpoint after worker completes
      saveIncrementalCheckpoint(projectDir, {
        sessionId: checkpointSessionId,
        iteration,
        step: 1,
        timestamp: Date.now(),
        task: guidance.slice(0, 500),
        toolsCalled: ["worker.prompt"],
        partialResults: { workerResponseLength: workerTextAfterPrompt.length },
        completed: false,
      });

      // Verify worker produced output
      const afterSnap = snapshotOutputs(outputsDir);
      let changedFiles = diffSnapshots(beforeSnap, afterSnap);

      // V3 GUARDRAIL: Check if stub file was left unchanged (< 100 bytes = still a stub)
      if (stubFilePath && changedFiles.length > 0) {
        const stubIdx = changedFiles.indexOf(stubFilePath);
        if (stubIdx !== -1) {
          try {
            const fileSize = statSync(stubFilePath).size;
            if (fileSize < 100) {
              ctx.log(`[work] ⚠️ V3: Stub file ${stubFilePath.split('/').pop()} still < 100 bytes (${fileSize}B) — treating as zero output`);
              changedFiles.splice(stubIdx, 1);
            }
          } catch {}
        }
      }
      if (changedFiles.length === 0) {
        (ctx as any)._consecutiveZeroOutput++;
        const consecutive = (ctx as any)._consecutiveZeroOutput;
        ctx.log(`[work] ⚠️ WARNING: Iteration ${iteration} produced NO output files (${consecutive}/${MAX_ZERO_OUTPUT} consecutive)`);
        appendFileSync(journalFile, `\n### Iteration ${iteration} — ${new Date().toISOString()}\n**⚠️ No output files produced (${consecutive} consecutive failures)**\n`, "utf-8");
        // Dead retry block removed — ENABLE_ZERO_OUTPUT_RETRY was never enabled,
        // 0% recovery rate confirmed (EXP-511). Zero-output is handled by the
        // consecutive counter + escalation below.
        if (consecutive >= MAX_ZERO_OUTPUT) {
          ctx.log(`[work] 🚨 ESCALATION: ${MAX_ZERO_OUTPUT} consecutive zero-output iterations. Injecting write-first constraint into review.`);
        }
        // Auto-terminate after 2x MAX_ZERO_OUTPUT consecutive failures
        if (consecutive >= MAX_ZERO_OUTPUT * 2) {
          ctx.log(`[work] 🛑 AUTO-TERMINATE: ${consecutive} consecutive zero-output iterations. Worker cannot produce files. Stopping workflow.`);
          appendFileSync(journalFile, `\n**🛑 AUTO-TERMINATED**: ${consecutive} consecutive zero-output iterations. Worker is non-functional.\n`, "utf-8");
          decision = { status: "blocked", detail: `Auto-terminated: ${consecutive} consecutive zero-output iterations. Worker cannot produce deliverables.` };
          break;
        }
      } else {
        // Validate outputs before accepting them
        const validFiles: string[] = [];
        const rejectedFiles: string[] = [];
        for (const filePath of changedFiles) {
          try {
            const content = readFileSync(filePath, 'utf-8');
            const filename = filePath.split('/').pop() || '';
            const result = validateOutput(filename, content, { outputDir: outputsDir, checkDuplicates: true });
            if (result.valid) {
              validFiles.push(filePath);
              if (result.warnings.length > 0) {
                ctx.log(`[validate] ⚠️ ${filename}: ${result.warnings.join(', ')}`);
              }
            } else {
              rejectedFiles.push(filePath);
              ctx.log(`[validate] ❌ Rejected ${filename}: ${result.errors.join(', ')}`);
            }
          } catch {
            validFiles.push(filePath); // Can't read = skip validation
          }
        }
        if (rejectedFiles.length > 0) {
          ctx.log(`[validate] Rejected ${rejectedFiles.length} file(s), accepted ${validFiles.length}`);
        }
        changedFiles = validFiles;
        (ctx as any)._consecutiveZeroOutput = 0;
        ctx.log(`[work] ✅ Iteration ${iteration} produced ${changedFiles.length} file(s): ${changedFiles.map(f => f.split('/').pop()).join(', ')}`);
      }

      // ── Record iteration metrics ──
      try {
        recordIteration({
          id: iterationId,
          deliverableProduced: changedFiles.length > 0,
          firstAttempt: !(ctx as any)[`_retried_${iteration}`],
          durationMs: timing.durationMs,
          targetPath: changedFiles[0]?.split('/').pop(),
        });
      } catch { /* non-critical */ }

      // ── Record cost/usage metrics ──
      try {
        const outputLen = workerTextAfterPrompt.length;
        recordUsage({
          agent: (ctx as any).agentName ?? 'worker',
          workflow: 'master-worker',
          promptTokens: Math.round(outputLen / 4),  // rough estimate
          completionTokens: Math.round(outputLen / 4),
          model: 'unknown',
        });
      } catch { /* non-critical */ }

      // ── Journal ──
      const workerText = workerTextAfterPrompt;
      const workerSummary = workerText.length > 1500 ? workerText.slice(0, 1500) + "..." : workerText;
      appendFileSync(journalFile, `\n### Iteration ${iteration} — ${new Date().toISOString()}\n**Worker**: ${workerSummary.slice(0, 500)}\n`, "utf-8");

      // ── Review phase ──
      ctx.log(`[review] Orchestrator evaluating iteration ${iteration}...`);
      const reviewLiveRuntimeSignals = await collectLiveRuntimeSignals(ctx);
      const reviewLiveRuntimeSignalsBlock = formatLiveRuntimeSignals(reviewLiveRuntimeSignals);
      ctx.log(`[review] Live runtime signals: ${reviewLiveRuntimeSignals.available ? "available" : `unavailable (${reviewLiveRuntimeSignals.error ?? "unknown"})`}`);

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

**Output verification**: ${changedFiles.length === 0 ? '⚠️ NO files were created or modified this iteration. Consider requiring write() as the first tool call in next guidance.' : `✅ ${changedFiles.length} file(s) modified: ${changedFiles.map(f => f.split('/').pop()).join(', ')}`}

${reviewLiveRuntimeSignalsBlock}

${(ctx as any)._consecutiveZeroOutput >= MAX_ZERO_OUTPUT ? `**🚨 ESCALATION**: Worker has produced 0 output files for ${(ctx as any)._consecutiveZeroOutput} consecutive iterations. This is likely a "false completion claim" failure mode. Options:\n1. Provide EXACT file content in your guidance so worker just needs to write()\n2. Write the file yourself using your tools\n3. PIVOT to a completely different approach` : ''}

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

      const orchestratorText = safeLastText(orchestrator);


      // Mark new comments as read
      if (newComments) {
        try { appendFileSync(discussionFile, `\n---read @iter${iteration}---\n`, "utf-8"); } catch {}
      }
      decision = coerceUnknownToDoneWhenNoPendingProjectWork(
        guardDoneWithPendingProjectWork(
          extractDecision(orchestratorText),
          projectFile,
          ctx,
          "review",
        ),
        projectFile,
        ctx,
        "review",
      );
      if (decision.status === "unknown") {
        // Track consecutive unclear decisions — if the orchestrator can't decide,
        // the project likely has no more actionable work (zombie loop prevention)
        if (typeof (ctx as any)._consecutiveUnknownDecisions === 'undefined') {
          (ctx as any)._consecutiveUnknownDecisions = 0;
        }
        (ctx as any)._consecutiveUnknownDecisions++;
        const unknownCount = (ctx as any)._consecutiveUnknownDecisions;
        if (unknownCount >= 3) {
          ctx.log(`[review] 🛑 ${unknownCount} consecutive unclear decisions — treating as WAITING (zombie loop prevention)`);
          decision.status = "waiting";
          decision.detail = `Auto-waiting: ${unknownCount} consecutive iterations with no clear orchestrator decision. Project may be complete.`;
        } else {
          ctx.log(`[review] Decision unclear (${unknownCount}/3) — treating as CONTINUE`);
          decision.status = "continue";
        }
      } else {
        // Reset counter on any clear decision
        (ctx as any)._consecutiveUnknownDecisions = 0;
      }
      ctx.log(`[review] Decision: ${decision.status.toUpperCase()}`);

      // Append orchestrator decision to journal
      appendFileSync(journalFile, `**Orchestrator**: ${decision.detail.slice(0, 300)}\n`, "utf-8");

      // Update iteration count in project.md (but don't override externally-set closed/done status)
      const currentContent = readFileSync(projectFile, "utf-8");
      const currentStatus = (currentContent.match(/\*\*Status\*\*:\s*(\w+)/) || [])[1]?.toLowerCase();
      if (currentStatus !== "closed" && currentStatus !== "done" && currentStatus !== "completed") {
        updateProjectStatus(projectFile, "active", undefined, iteration);
      } else {
        ctx.log(`[work] Project status externally set to '${currentStatus}' — stopping loop`);
        break;
      }

      // Mark this iteration's checkpoint as complete
      markCheckpointComplete(projectDir, checkpointSessionId);

      // Emit iteration event for metrics tracking
      try { ctx.emit({ type: "project.iteration", project: projectDir, iteration } as any); } catch {}
    }

    // ── Wrap up ──
    const finalContent = readFileSync(projectFile, "utf-8");
    const projectType = extractField(finalContent, "Type").toLowerCase();
    let finalStatus: string;
    let stopReason: string;

    if (decision.status === "blocked") {
      finalStatus = "blocked";
      stopReason = decision.detail.slice(0, 200);
    } else if (decision.status === "waiting") {
      finalStatus = "waiting";
      stopReason = decision.detail.slice(0, 200);
    } else if (iteration >= maxIterations) {
      finalStatus = "blocked";
      stopReason = `Safety cap: ${maxIterations} iterations reached.`;
    } else {
      finalStatus = decision.status;
      stopReason = decision.detail.slice(0, 200);
    }

    // Workflow can set waiting/blocked, or end this pass as done while keeping
    // the durable project active for future metric/event checks.
    // finalStatus is one of: continue/pivot/waiting/blocked/done/unknown
    const projectStatus = finalStatus === "done" ? "active" : finalStatus;
    updateProjectStatus(projectFile, projectStatus, finalStatus === "done" ? undefined : stopReason, iteration);
    ctx.log(`[done] ${finalStatus} after ${iteration} iteration(s). ${stopReason}`);

    if (finalStatus === "blocked") return ctx.escalate(stopReason);
    return ctx.done(`${finalStatus} after ${iteration} iteration(s). ${stopReason}`);

  } finally {
    try { orchestrator.close(); } catch {}
    try { worker?.close(); } catch {}
  }
}
