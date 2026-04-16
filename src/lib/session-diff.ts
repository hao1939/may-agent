/**
 * session-diff.ts — "Diff since last session" tool.
 *
 * Given a timestamp, returns what changed since then:
 *   - Files modified on disk (via git)
 *   - Requests completed
 *   - New requests created
 *   - Sessions that ran
 *
 * Part of: cold-start-fix milestone 2 ("Diff since last session" tool).
 */

import { execSync } from "node:child_process";
import { openDatabase } from "./db.js";
import type { SqliteDb } from "./db.js";
import { resolve } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────

export interface FileChange {
  path: string;
  status: "A" | "M" | "D" | "R" | string; // Added, Modified, Deleted, Renamed, etc.
}

export interface CompletedRequest {
  requestId: string;
  toAgent: string;
  task: string;
  status: string;
  summary: string | null;
  completedAt: number;
}

export interface NewRequest {
  requestId: string;
  fromEntity: string;
  toAgent: string;
  task: string;
  status: string;
  createdAt: number;
}

export interface RecentSession {
  sessionId: string;
  agent: string;
  task: string;
  status: string;
  startedAt: number;
  endedAt: number | null;
}

export interface SessionDiff {
  /** ISO timestamp of the "since" cutoff */
  since: string;
  /** Epoch ms of the "since" cutoff */
  sinceMs: number;
  /** Files changed in git since the cutoff */
  filesChanged: FileChange[];
  /** Requests that were completed (or failed) since the cutoff */
  completedRequests: CompletedRequest[];
  /** Requests that were created since the cutoff */
  newRequests: NewRequest[];
  /** Sessions that started since the cutoff */
  recentSessions: RecentSession[];
}

// ── Helpers ────────────────────────────────────────────────────────────

let _dbCache: Map<string, SqliteDb> = new Map();

function getDb(persistDir: string): SqliteDb {
  let db = _dbCache.get(persistDir);
  if (!db) {
    const dbPath = resolve(persistDir, "may.db");
    db = openDatabase(dbPath);
    _dbCache.set(persistDir, db);
  }
  return db;
}

/**
 * Get files changed since a given timestamp using git.
 * Falls back to empty array if git is unavailable or the repo has no commits.
 */
function getFilesChangedSince(projectRoot: string, sinceMs: number): FileChange[] {
  try {
    const sinceDate = new Date(sinceMs).toISOString();
    // Use git log to find files changed since the timestamp
    const output = execSync(
      `git log --since="${sinceDate}" --name-status --pretty=format: --diff-filter=AMDRT`,
      { cwd: projectRoot, encoding: "utf-8", timeout: 10000 }
    ).trim();

    if (!output) return [];

    const seen = new Map<string, string>(); // path -> latest status
    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split("\t");
      if (parts.length >= 2) {
        const status = parts[0].charAt(0); // first char (R100 -> R)
        const filePath = parts[parts.length - 1]; // last part (for renames, it's the new name)
        seen.set(filePath, status);
      }
    }

    return Array.from(seen.entries()).map(([path, status]) => ({ path, status }));
  } catch {
    return [];
  }
}

// ── Main function ──────────────────────────────────────────────────────

/**
 * Compute a diff of what changed since `sinceMs` (epoch milliseconds).
 *
 * @param persistDir - The persist directory containing may.db
 * @param sinceMs - Epoch milliseconds cutoff
 * @param opts.projectRoot - Project root for git operations (defaults to persistDir/..)
 * @param opts.agent - If set, filter requests/sessions to this agent
 * @param opts.limit - Max rows per category (default 50)
 */
export function getSessionDiff(
  persistDir: string,
  sinceMs: number,
  opts: { projectRoot?: string; agent?: string; limit?: number } = {},
): SessionDiff {
  const projectRoot = opts.projectRoot ?? resolve(persistDir, "..");
  const limit = opts.limit ?? 50;
  const db = getDb(persistDir);

  // 1. Files changed via git
  const filesChanged = getFilesChangedSince(projectRoot, sinceMs);

  // 2. Completed requests since cutoff
  let completedSql = `
    SELECT requestId, toAgent, task, status, summary, completedAt
    FROM requests
    WHERE completedAt >= ? AND status IN ('COMPLETED', 'FAILED')
    ORDER BY completedAt DESC
    LIMIT ?
  `;
  const completedParams: unknown[] = [sinceMs, limit];

  if (opts.agent) {
    completedSql = `
      SELECT requestId, toAgent, task, status, summary, completedAt
      FROM requests
      WHERE completedAt >= ? AND status IN ('COMPLETED', 'FAILED') AND toAgent = ?
      ORDER BY completedAt DESC
      LIMIT ?
    `;
    completedParams.splice(1, 0, opts.agent);
  }

  const completedRequests = db
    .prepare(completedSql)
    .all(...completedParams) as unknown as CompletedRequest[];

  // 3. New requests since cutoff
  let newSql = `
    SELECT requestId, fromEntity, toAgent, task, status, createdAt
    FROM requests
    WHERE createdAt >= ?
    ORDER BY createdAt DESC
    LIMIT ?
  `;
  const newParams: unknown[] = [sinceMs, limit];

  if (opts.agent) {
    newSql = `
      SELECT requestId, fromEntity, toAgent, task, status, createdAt
      FROM requests
      WHERE createdAt >= ? AND toAgent = ?
      ORDER BY createdAt DESC
      LIMIT ?
    `;
    newParams.splice(1, 0, opts.agent);
  }

  const newRequests = db.prepare(newSql).all(...newParams) as unknown as NewRequest[];

  // 4. Recent sessions since cutoff
  let sessionSql = `
    SELECT sessionId, agent, task, status, startedAt, endedAt
    FROM sessions
    WHERE startedAt >= ?
    ORDER BY startedAt DESC
    LIMIT ?
  `;
  const sessionParams: unknown[] = [sinceMs, limit];

  if (opts.agent) {
    sessionSql = `
      SELECT sessionId, agent, task, status, startedAt, endedAt
      FROM sessions
      WHERE startedAt >= ? AND agent = ?
      ORDER BY startedAt DESC
      LIMIT ?
    `;
    sessionParams.splice(1, 0, opts.agent);
  }

  const recentSessions = db.prepare(sessionSql).all(...sessionParams) as unknown as RecentSession[];

  return {
    since: new Date(sinceMs).toISOString(),
    sinceMs,
    filesChanged,
    completedRequests,
    newRequests,
    recentSessions,
  };
}

/**
 * Format a SessionDiff as a human-readable markdown summary.
 * Suitable for injecting into agent context at session start.
 */
export function formatSessionDiff(diff: SessionDiff): string {
  const lines: string[] = [];
  lines.push(`## What Changed Since ${diff.since}`);
  lines.push(``);

  // Files
  if (diff.filesChanged.length > 0) {
    lines.push(`### Files Changed (${diff.filesChanged.length})`);
    for (const f of diff.filesChanged.slice(0, 20)) {
      const label = f.status === "A" ? "+" : f.status === "D" ? "-" : "~";
      lines.push(`- \`${label}\` ${f.path}`);
    }
    if (diff.filesChanged.length > 20) {
      lines.push(`- … and ${diff.filesChanged.length - 20} more`);
    }
    lines.push(``);
  }

  // Completed requests
  if (diff.completedRequests.length > 0) {
    lines.push(`### Completed Requests (${diff.completedRequests.length})`);
    for (const r of diff.completedRequests.slice(0, 10)) {
      const icon = r.status === "COMPLETED" ? "✅" : "❌";
      const summary = r.summary ? ` — ${r.summary.slice(0, 80)}` : "";
      lines.push(`- ${icon} **${r.toAgent}**: ${r.task.slice(0, 60)}${summary}`);
    }
    if (diff.completedRequests.length > 10) {
      lines.push(`- … and ${diff.completedRequests.length - 10} more`);
    }
    lines.push(``);
  }

  // New requests
  if (diff.newRequests.length > 0) {
    lines.push(`### New Requests (${diff.newRequests.length})`);
    for (const r of diff.newRequests.slice(0, 10)) {
      lines.push(`- **${r.toAgent}** ← ${r.fromEntity}: ${r.task.slice(0, 80)} [${r.status}]`);
    }
    if (diff.newRequests.length > 10) {
      lines.push(`- … and ${diff.newRequests.length - 10} more`);
    }
    lines.push(``);
  }

  // Sessions
  if (diff.recentSessions.length > 0) {
    lines.push(`### Sessions (${diff.recentSessions.length})`);
    for (const s of diff.recentSessions.slice(0, 10)) {
      const dur = s.endedAt ? `${Math.round((s.endedAt - s.startedAt) / 1000)}s` : "running";
      lines.push(`- **${s.agent}** [${s.status}] (${dur}): ${s.task.slice(0, 60)}`);
    }
    if (diff.recentSessions.length > 10) {
      lines.push(`- … and ${diff.recentSessions.length - 10} more`);
    }
    lines.push(``);
  }

  if (
    diff.filesChanged.length === 0 &&
    diff.completedRequests.length === 0 &&
    diff.newRequests.length === 0 &&
    diff.recentSessions.length === 0
  ) {
    lines.push(`_Nothing changed since ${diff.since}._`);
    lines.push(``);
  }

  return lines.join("\n");
}
