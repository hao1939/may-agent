/**
 * Last-session file — structured handoff between consecutive sessions of the same agent.
 *
 * At session end, writes `agents/<name>/last-session.md` with:
 *   - What was accomplished (from finish() params)
 *   - Files modified
 *   - What's still pending (next_steps, blockers)
 *   - Key decisions made
 *
 * Agents can read this report on demand. Normal prompt preparation does not
 * inject it, and reported items do not create or complete Tasks/Requests.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { log } from "./log.js";

/** The filename used for per-agent last-session handoff. */
export const LAST_SESSION_FILENAME = "last-session.md";

export interface LastSessionData {
  sessionId: string;
  agent: string;
  status: string;
  summary: string;
  duration?: string;
  filesModified?: string[];
  nextSteps?: string;
  blockers?: Array<{ reason: string; context?: string }>;
  completedItems?: string[];
  newItems?: string[];
  timestamp: number;
}

/**
 * Build the markdown content for last-session.md from finish() params and session metadata.
 */
export function formatLastSession(data: LastSessionData): string {
  const lines: string[] = [];
  const date = new Date(data.timestamp).toISOString();

  lines.push(`# Last Session`);
  lines.push(`<!-- Auto-generated at session end. Do not edit manually. -->`);
  lines.push(``);
  lines.push(`- **Session:** ${data.sessionId}`);
  lines.push(`- **Status:** ${data.status}`);
  lines.push(`- **When:** ${date}`);
  if (data.duration) {
    lines.push(`- **Duration:** ${data.duration}`);
  }
  lines.push(``);
  lines.push(`## What Happened`);
  lines.push(data.summary);

  if (data.filesModified && data.filesModified.length > 0) {
    lines.push(``);
    lines.push(`## Files Modified`);
    for (const f of data.filesModified) {
      lines.push(`- ${f}`);
    }
  }

  if (data.completedItems && data.completedItems.length > 0) {
    lines.push(``);
    lines.push(`## Reported Completed Work`);
    for (const item of data.completedItems) {
      lines.push(`- ${item}`);
    }
  }

  if (data.nextSteps) {
    lines.push(``);
    lines.push(`## Still Open / Next Steps`);
    lines.push(data.nextSteps);
  }

  if (data.blockers && data.blockers.length > 0) {
    lines.push(``);
    lines.push(`## Blockers`);
    for (const b of data.blockers) {
      lines.push(`- ${b.reason}${b.context ? ` — ${b.context}` : ""}`);
    }
  }

  if (data.newItems && data.newItems.length > 0) {
    lines.push(``);
    lines.push(`## Suggested Follow-up Work`);
    for (const item of data.newItems) {
      lines.push(`- ${item}`);
    }
  }

  lines.push(``);
  return lines.join("\n");
}

/**
 * Write `agents/<name>/last-session.md` for an agent.
 *
 * @param agentDir - The agent's directory (e.g., `/app/agents/coder`)
 * @param data - Structured session data to persist
 */
export function writeLastSession(agentDir: string, data: LastSessionData): void {
  const filePath = join(agentDir, LAST_SESSION_FILENAME);
  const content = formatLastSession(data);
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  } catch (err) {
    log("warn", `[last-session] failed to write ${filePath}: ${err}`);
  }
}

/**
 * Read `agents/<name>/last-session.md` if it exists.
 *
 * @param agentDir - The agent's directory
 * @returns The file contents, or null if not found
 */
export function readLastSession(agentDir: string): string | null {
  const filePath = join(agentDir, LAST_SESSION_FILENAME);
  try {
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath, "utf-8").trim();
    return content || null;
  } catch {
    return null;
  }
}
