/**
 * Session Cleanup — manages stale session data and workspace artifacts.
 *
 * Used by the maintenance cron to clean up expired sessions, compress
 * old logs, and archive completed workspace artifacts.
 */

import { readdirSync, statSync, existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";

/** A session record with metadata for cleanup decisions. */
export interface SessionRecord {
  id: string;
  agent: string;
  startedAt: number;   // epoch ms
  lastActive: number;  // epoch ms
  status: "active" | "completed" | "errored" | "orphaned";
  turnCount: number;
  costUsd: number;
}

/** Cleanup configuration thresholds. */
export interface CleanupConfig {
  /** Sessions older than this (ms) are eligible for archival. */
  maxAge: number;
  /** Sessions inactive for this long (ms) are considered stale. */
  staleThreshold: number;
  /** Maximum cost (USD) before a session is flagged for review. */
  costCeiling: number;
  /** Archive directory path. */
  archiveDir: string;
}

const DEFAULT_CONFIG: CleanupConfig = {
  maxAge: 7 * 24 * 60 * 60 * 1000,       // 7 days
  staleThreshold: 2 * 60 * 60 * 1000,     // 2 hours
  costCeiling: 5.00,
  archiveDir: ".state/archive",
};

/** Classification result for a session. */
export type SessionAction = "keep" | "archive" | "flag" | "purge";

/**
 * Classify a session for cleanup action.
 *
 * Rules (applied in order):
 * 1. Active sessions → keep
 * 2. Sessions exceeding cost ceiling → flag (regardless of age)
 * 3. Completed sessions older than maxAge → archive
 * 4. Errored sessions older than maxAge → purge
 * 5. Orphaned sessions past stale threshold → purge
 * 6. Everything else → keep
 */
export function classifySession(
  session: SessionRecord,
  now: number,
  config: CleanupConfig = DEFAULT_CONFIG
): SessionAction {
  // Rule 1: Active sessions are always kept
  if (session.status === "active") return "keep";

  // Rule 2: High-cost sessions get flagged for human review
  if (session.costUsd > config.costCeiling) return "flag";

  const age = now - session.startedAt;
  const idleTime = now - session.lastActive;

  // Rule 3: Old completed sessions get archived
  if (session.status === "completed" && age >= config.maxAge) return "archive";

  // Rule 4: Old errored sessions get purged
  if (session.status === "errored" && age >= config.maxAge) return "purge";

  // Rule 5: Orphaned sessions past stale threshold get purged
  if (session.status === "orphaned" && idleTime >= config.staleThreshold) return "purge";

  // Rule 6: Default
  return "keep";
}

/**
 * Batch classify sessions and group by action.
 * Returns a map of action → session IDs.
 */
export function planCleanup(
  sessions: SessionRecord[],
  now: number,
  config: CleanupConfig = DEFAULT_CONFIG
): Record<SessionAction, string[]> {
  const result: Record<SessionAction, string[]> = {
    keep: [],
    archive: [],
    flag: [],
    purge: [],
  };

  for (const session of sessions) {
    const action = classifySession(session, now, config);
    result[action].push(session.id);
  }

  return result;
}

/**
 * Generate a cleanup report in markdown format.
 */
export function generateReport(
  plan: Record<SessionAction, string[]>,
  sessions: SessionRecord[]
): string {
  const sessionMap = new Map(sessions.map(s => [s.id, s]));
  const lines: string[] = [];

  lines.push("# Session Cleanup Report");
  lines.push("");
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Total sessions:** ${sessions.length}`);
  lines.push("");

  // Summary counts
  lines.push("## Summary");
  lines.push("");
  lines.push(`| Action | Count |`);
  lines.push(`|--------|-------|`);
  for (const [action, ids] of Object.entries(plan)) {
    lines.push(`| ${action} | ${ids.length} |`);
  }
  lines.push("");

  // Detail sections
  for (const [action, ids] of Object.entries(plan)) {
    if (ids.length === 0) continue;
    lines.push(`## ${action.charAt(0).toUpperCase() + action.slice(1)}`);
    lines.push("");
    for (const id of ids) {
      const s = sessionMap.get(id);
      if (!s) continue;
      const ageHours = Math.round((Date.now() - s.startedAt) / 3600000);
      lines.push(`- **${id}** (${s.agent}) — ${s.status}, ${s.turnCount} turns, $${s.costUsd.toFixed(2)}, ${ageHours}h old`);
    }
    lines.push("");
  }

  // Cost summary
  const totalCost = sessions.reduce((sum, s) => sum + s.costUsd, 0);
  const flaggedCost = plan.flag
    .map(id => sessionMap.get(id))
    .filter((s): s is SessionRecord => s !== undefined)
    .reduce((sum, s) => sum + s.costUsd, 0);

  lines.push("## Cost Analysis");
  lines.push("");
  lines.push(`- **Total cost:** $${totalCost.toFixed(2)}`);
  lines.push(`- **Flagged for review:** $${flaggedCost.toFixed(2)}`);
  lines.push(`- **Average per session:** $${(totalCost / sessions.length).toFixed(2)}`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Write archived session data to the archive directory.
 * Creates a JSON file per session with full metadata.
 */
export function archiveSession(
  session: SessionRecord,
  archiveDir: string = DEFAULT_CONFIG.archiveDir
): string {
  mkdirSync(archiveDir, { recursive: true });
  const filePath = join(archiveDir, `${session.id}.json`);
  writeFileSync(filePath, JSON.stringify(session, null, 2));
  return filePath;
}

/**
 * Calculate cleanup statistics from a batch of sessions.
 */
export function getCleanupStats(sessions: SessionRecord[]): {
  totalSessions: number;
  byStatus: Record<string, number>;
  byAgent: Record<string, number>;
  totalCost: number;
  avgTurns: number;
  oldestAge: number;
} {
  const byStatus: Record<string, number> = {};
  const byAgent: Record<string, number> = {};
  let totalCost = 0;
  let totalTurns = 0;
  let oldestStart = Infinity;

  for (const s of sessions) {
    byStatus[s.status] = (byStatus[s.status] || 0) + 1;
    byAgent[s.agent] = (byAgent[s.agent] || 0) + 1;
    totalCost += s.costUsd;
    totalTurns += s.turnCount;
    if (s.startedAt < oldestStart) oldestStart = s.startedAt;
  }

  return {
    totalSessions: sessions.length,
    byStatus,
    byAgent,
    totalCost,
    avgTurns: sessions.length > 0 ? totalTurns / sessions.length : 0,
    oldestAge: sessions.length > 0 ? Date.now() - oldestStart : 0,
  };
}

/** Result of applying the retention policy across all sessions. */
export interface RetentionReport {
  /** The cleanup plan: action → session IDs */
  plan: Record<SessionAction, string[]>;
  /** Paths of successfully archived session files */
  archived: string[];
  /** IDs of sessions that were purged */
  purged: string[];
  /** IDs of sessions flagged for human review */
  flagged: string[];
  /** The generated markdown report */
  report: string;
  /** Aggregate statistics */
  stats: ReturnType<typeof getCleanupStats>;
}

/**
 * Apply the retention policy to a set of sessions.
 *
 * Classifies all sessions, archives those marked for archival,
 * and returns a comprehensive report of all actions taken.
 */
export function applyRetentionPolicy(
  sessions: SessionRecord[],
  now: number = Date.now(),
  config: CleanupConfig = DEFAULT_CONFIG
): RetentionReport {
  // 1. Classify all sessions
  const plan = planCleanup(sessions, now, config);

  // 2. Build a lookup map for session data
  const sessionMap = new Map(sessions.map(s => [s.id, s]));

  // 3. Archive sessions marked for archival
  const archived: string[] = [];
  for (const id of plan.archive) {
    const session = sessionMap.get(id);
    if (session) {
      const filePath = archiveSession(session, config.archiveDir);
      archived.push(filePath);
    }
  }

  // 4. Collect purged and flagged IDs
  const purged = [...plan.purge];
  const flagged = [...plan.flag];

  // 5. Generate the markdown report
  const report = generateReport(plan, sessions);

  // 6. Compute aggregate stats
  const stats = getCleanupStats(sessions);

  return {
    plan,
    archived,
    purged,
    flagged,
    report,
    stats,
  };
}
