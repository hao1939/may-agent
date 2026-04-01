/**
 * Activity tracking — append-only JSONL log per agent.
 *
 * Each agent gets `agents/<name>/workspace/activity.jsonl` recording session
 * lifecycle events: start, progress, done, error, blocked.
 *
 * Designed for observability: "what is each agent doing right now?"
 */

import { appendFileSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";

// ── Constants ───────────────────────────────────────────────────────────

/** Emit a progress event every N turns. */
export const PROGRESS_INTERVAL = 5;

/** Max length for summary fields (Bob's recommendation: prevent log bloat). */
export const SUMMARY_MAX_CHARS = 200;

/** Max file size (bytes) before trimming. 500KB keeps ~7 days of history. */
const ACTIVITY_MAX_BYTES = 500 * 1024;

/** Lines to retain after trimming (keep the most recent). */
const ACTIVITY_RETAIN_LINES = 1000;

// ── Types ───────────────────────────────────────────────────────────────

interface ActivityEventBase {
  ts: number;
  sid: string;
  agent: string;
}

export interface StartEvent extends ActivityEventBase {
  event: "start";
  task: string;
}

export interface ProgressEvent extends ActivityEventBase {
  event: "progress";
  turns: number;
  summary: string;
}

export interface DoneEvent extends ActivityEventBase {
  event: "done";
  turns: number;
  duration: string;
  summary: string;
  files: string[];
}

export interface ErrorEvent extends ActivityEventBase {
  event: "error";
  turns: number;
  duration: string;
  summary: string;
  error: string;
}

export interface BlockedEvent extends ActivityEventBase {
  event: "blocked";
  turns: number;
  summary: string;
  blocker: string;
}

type ActivityEvent = StartEvent | ProgressEvent | DoneEvent | ErrorEvent | BlockedEvent;

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Truncate a summary string. Collapses newlines/whitespace.
 * Returns "(no summary)" for null/empty input.
 * Uses Unicode ellipsis (…) for truncation.
 */
export function truncateSummary(text: string | null | undefined, maxLen: number = SUMMARY_MAX_CHARS): string {
  if (!text || text.trim() === "") return "(no summary)";
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen - 1) + "\u2026";
}

/**
 * Resolve the activity.jsonl path for a given agent.
 * If `workspacePath` is provided, writes to `{workspacePath}/activity.jsonl`
 * instead of the default `agents/{name}/workspace/activity.jsonl`.
 * This prevents ghost directory creation when fork agents (e.g. bob-c40)
 * have a workspace that differs from the `agents/{name}/workspace/` convention.
 */
export function activityPath(projectRoot: string, agentName: string, workspacePath?: string): string {
  if (workspacePath) {
    return join(workspacePath, "activity.jsonl");
  }
  return join(projectRoot, "agents", agentName, "workspace", "activity.jsonl");
}

/**
 * Append an activity event to the agent's activity.jsonl.
 * Creates the directory if it doesn't exist. Best-effort — never throws.
 *
 * On "start" events (once per session), checks file size and trims if
 * it exceeds ACTIVITY_MAX_BYTES, keeping only the most recent lines.
 *
 * @param workspacePath - If provided, write to this workspace instead of
 *   deriving it from the agent name. Fixes ghost directory creation for
 *   fork agents whose workspace lives under a different path.
 */
export function appendActivity(projectRoot: string, event: ActivityEvent, workspacePath?: string): void {
  try {
    const filePath = activityPath(projectRoot, event.agent, workspacePath);
    mkdirSync(dirname(filePath), { recursive: true });

    // Trim on session start (once per session, not every append)
    if (event.event === "start") {
      trimActivityFile(filePath);
    }

    appendFileSync(filePath, JSON.stringify(event) + "\n", "utf-8");
  } catch {
    /* best-effort — activity tracking should never break session lifecycle */
  }
}

/**
 * Trim an activity.jsonl file if it exceeds the size threshold.
 * Keeps only the last ACTIVITY_RETAIN_LINES lines. Best-effort.
 */
function trimActivityFile(filePath: string): void {
  try {
    const stat = statSync(filePath);
    if (stat.size <= ACTIVITY_MAX_BYTES) return;

    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length <= ACTIVITY_RETAIN_LINES) return;

    const kept = lines.slice(-ACTIVITY_RETAIN_LINES);
    writeFileSync(filePath, kept.join("\n") + "\n", "utf-8");
  } catch {
    /* best-effort — never break session lifecycle */
  }
}
