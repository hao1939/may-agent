/**
 * task-watchdog.ts — Monitors stale/orphaned task requests and nudges/escalates.
 *
 * Progression: nudge (2h) → escalate (6h) → alert human (12h)
 * Tracks actions in JSONL log, prunes entries older than 7 days.
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { HandlerContext } from "../../../src/lib/handler-context.js";

// ── Constants ─────────────────────────────────────────────────────────

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const STALE_THRESHOLD = 2 * HOUR;
const ESCALATE_THRESHOLD = 6 * HOUR;
const ALERT_THRESHOLD = 12 * HOUR;
const MAX_NUDGES_PER_RUN = 10;
const PRUNE_AGE = 7 * DAY;

// ── Types ─────────────────────────────────────────────────────────────

export interface WatchdogLogEntry {
  timestamp: string;
  requestId: string;
  toAgent: string;
  fromEntity: string;
  action: "nudge" | "escalate" | "alert";
  requestAgeH: number;
  task: string;
}

export interface TaskWatchdogResult {
  staleCount: number;
  orphanCount: number;
  nudged: Array<{ requestId: string; toAgent: string }>;
  escalated: Array<{ requestId: string; toAgent: string }>;
  alerted: Array<{ requestId: string; toAgent: string }>;
  skipped: number;
  pruned: number;
}

interface RequestRow {
  requestId: string;
  status: string;
  method: string;
  toAgent: string;
  fromEntity: string;
  sessionId: string | null;
  createdAt: number;
  task: string;
}

// ── Log helpers ───────────────────────────────────────────────────────

function getLogPath(persistDir: string): string {
  return join(persistDir, ".state", "task-watchdog-log.jsonl");
}

export function loadPriorActions(logPath: string): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  if (!existsSync(logPath)) return result;

  try {
    const content = readFileSync(logPath, "utf-8");
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.requestId && entry.action) {
          if (!result.has(entry.requestId)) result.set(entry.requestId, new Set());
          result.get(entry.requestId)!.add(entry.action);
        }
      } catch {
        // skip malformed
      }
    }
  } catch {
    // file read error
  }

  return result;
}

export function appendLogEntry(logPath: string, entry: WatchdogLogEntry): void {
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, JSON.stringify(entry) + "\n");
}

export function pruneLogEntries(logPath: string, now: number): number {
  if (!existsSync(logPath)) return 0;

  try {
    const content = readFileSync(logPath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    const cutoff = now - PRUNE_AGE;
    let pruned = 0;

    const kept: string[] = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.timestamp) {
          const ts = new Date(entry.timestamp).getTime();
          if (!isNaN(ts) && ts < cutoff) {
            pruned++;
            continue;
          }
        }
        kept.push(line);
      } catch {
        kept.push(line); // keep malformed lines
      }
    }

    writeFileSync(logPath, kept.join("\n") + "\n");
    return pruned;
  } catch {
    return 0;
  }
}

// ── Active session detection ──────────────────────────────────────────

function getActiveSessionIds(persistDir: string): Set<string> {
  const ids = new Set<string>();
  const activeDir = join(persistDir, "sessions", "active");
  try {
    if (existsSync(activeDir)) {
      for (const sid of readdirSync(activeDir)) {
        ids.add(sid);
      }
    }
  } catch {
    // ignore
  }
  return ids;
}

// ── Main ──────────────────────────────────────────────────────────────

export function runTaskWatchdog(
  ctx: HandlerContext,
  opts: { now?: number } = {},
): TaskWatchdogResult {
  const now = opts.now ?? Date.now();
  const logPath = getLogPath(ctx.persistDir);

  const result: TaskWatchdogResult = {
    staleCount: 0,
    orphanCount: 0,
    nudged: [],
    escalated: [],
    alerted: [],
    skipped: 0,
    pruned: 0,
  };

  // Prune old log entries
  result.pruned = pruneLogEntries(logPath, now);

  // Load prior actions
  const priorActions = loadPriorActions(logPath);

  // Query DB for stale requests
  let staleRequests: RequestRow[] = [];
  let allOpenRequests: RequestRow[] = [];
  try {
    const db = ctx.getDb();
    const stmt = db.prepare(
      `SELECT requestId, status, method, toAgent, fromEntity, sessionId, createdAt, task
       FROM requests
       WHERE status IN ('CREATED', 'IN_PROGRESS')
       ORDER BY createdAt ASC`,
    );
    // Age-filtered query: only requests older than threshold
    staleRequests = stmt.all(now - STALE_THRESHOLD) as RequestRow[];
    // All open requests (for orphan detection)
    allOpenRequests = stmt.all() as RequestRow[];
  } catch {
    // DB unavailable — return empty result
    return result;
  }

  result.staleCount = staleRequests.length;

  // Get active sessions for orphan detection
  const activeSessions = getActiveSessionIds(ctx.persistDir);

  // Build set of stale request IDs
  const staleIds = new Set(staleRequests.map((r) => r.requestId));

  // Detect orphaned requests (IN_PROGRESS but session is gone, even if not yet stale)
  const orphanRequests: RequestRow[] = [];
  for (const req of allOpenRequests) {
    if (staleIds.has(req.requestId)) continue; // already in stale set
    if (req.status === "IN_PROGRESS" && req.sessionId && !activeSessions.has(req.sessionId)) {
      orphanRequests.push(req);
      result.orphanCount++;
    }
  }

  // Process all requests (stale + orphan)
  const allToProcess = [...staleRequests, ...orphanRequests];
  let nudgeCount = 0;

  for (const req of allToProcess) {
    const ageMs = now - req.createdAt;
    const ageH = ageMs / HOUR;
    const prior = priorActions.get(req.requestId) ?? new Set();
    const isOrphan = orphanRequests.includes(req);

    // Skip IN_PROGRESS with active session (being worked on)
    if (req.status === "IN_PROGRESS" && req.sessionId && activeSessions.has(req.sessionId)) {
      result.skipped++;
      continue;
    }

    // Already alerted → skip
    if (prior.has("alert")) {
      result.skipped++;
      continue;
    }

    // Determine action based on age and prior actions
    if (prior.has("escalate") && ageMs >= ALERT_THRESHOLD) {
      // Alert human
      try {
        const msg = `🚨 Task stuck for ${Math.round(ageH)}h: ${req.toAgent} has unresolved request ${req.requestId} from ${req.fromEntity}: "${req.task.slice(0, 80)}"`;
        ctx.notify(msg);
        result.alerted.push({ requestId: req.requestId, toAgent: req.toAgent });
        appendLogEntry(logPath, {
          timestamp: new Date(now).toISOString(),
          requestId: req.requestId,
          toAgent: req.toAgent,
          fromEntity: req.fromEntity,
          action: "alert",
          requestAgeH: Math.round(ageH * 10) / 10,
          task: req.task,
        });
      } catch {
        // notify failure
      }
    } else if (prior.has("nudge") && ageMs >= ESCALATE_THRESHOLD) {
      // Escalate to May log
      ctx.log(`[task-watchdog] ESCALATION: ${req.requestId} to ${req.toAgent} from ${req.fromEntity} (${Math.round(ageH)}h old): "${req.task.slice(0, 80)}"`);
      result.escalated.push({ requestId: req.requestId, toAgent: req.toAgent });
      appendLogEntry(logPath, {
        timestamp: new Date(now).toISOString(),
        requestId: req.requestId,
        toAgent: req.toAgent,
        fromEntity: req.fromEntity,
        action: "escalate",
        requestAgeH: Math.round(ageH * 10) / 10,
        task: req.task,
      });
    } else if (!prior.has("nudge")) {
      // Nudge (if not already nudged, and if not at escalation/alert threshold)
      // For stale requests that have been sitting since before nudge threshold
      // but haven't been nudged yet, we nudge them now.

      // Self-nudge protection: skip nudge for toAgent=may
      if (req.toAgent === "may") {
        result.skipped++;
        continue;
      }

      // Cap nudges per run
      if (nudgeCount >= MAX_NUDGES_PER_RUN) {
        result.skipped++;
        continue;
      }

      // Send nudge via emit
      const methodLabel = isOrphan ? `orphaned ${req.method}` : `stale ${req.method}`;
      const taskMsg = `[task-watchdog] Reminder: You have a ${methodLabel} request (${req.requestId}) from ${req.fromEntity} (${Math.round(ageH)}h ago): "${req.task.slice(0, 120)}"`;

      try {
        ctx.emit({
          type: "message_created",
          toAgent: req.toAgent,
          method: "send",
          task: taskMsg,
          fromEntity: "task-watchdog",
        });

        result.nudged.push({ requestId: req.requestId, toAgent: req.toAgent });
        nudgeCount++;

        appendLogEntry(logPath, {
          timestamp: new Date(now).toISOString(),
          requestId: req.requestId,
          toAgent: req.toAgent,
          fromEntity: req.fromEntity,
          action: "nudge",
          requestAgeH: Math.round(ageH * 10) / 10,
          task: req.task,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.log(`[task-watchdog] Failed to nudge ${req.toAgent} for ${req.requestId}: ${msg}`);
      }
    } else {
      // Already nudged but not yet at escalation threshold
      result.skipped++;
    }
  }

  return result;
}
