/**
 * Activity tracking — append-only JSONL log per agent.
 *
 * Each agent gets `agents/<name>/workspace/activity.jsonl` recording session
 * lifecycle events: start, progress, done, error, blocked.
 *
 * Designed for observability: "what is each agent doing right now?"
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

// ── Constants ───────────────────────────────────────────────────────────

/** Emit a progress event every N turns. */
export const PROGRESS_INTERVAL = 5;

/** Max length for summary fields (Bob's recommendation: prevent log bloat). */
export const SUMMARY_MAX_CHARS = 200;

// ── Types ───────────────────────────────────────────────────────────────

export interface ActivityEventBase {
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

export type ActivityEvent =
  | StartEvent
  | ProgressEvent
  | DoneEvent
  | ErrorEvent
  | BlockedEvent;

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

/** Resolve the activity.jsonl path for a given agent. */
export function activityPath(projectRoot: string, agentName: string): string {
  return join(projectRoot, "agents", agentName, "workspace", "activity.jsonl");
}

/**
 * Append an activity event to the agent's activity.jsonl.
 * Creates the directory if it doesn't exist. Best-effort — never throws.
 */
export function appendActivity(projectRoot: string, event: ActivityEvent): void {
  try {
    const filePath = activityPath(projectRoot, event.agent);
    mkdirSync(dirname(filePath), { recursive: true });
    appendFileSync(filePath, JSON.stringify(event) + "\n", "utf-8");
  } catch {
    /* best-effort — activity tracking should never break session lifecycle */
  }
}
