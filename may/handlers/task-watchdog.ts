/**
 * Task Watchdog — proactive nudging for stale/orphaned requests.
 *
 * Runs every 60 minutes. Watches ALL open requests (any method: send, call,
 * fork, run, chat) and applies an escalation ladder:
 *   - ≥ 2h, no active session → nudge the target agent
 *   - ≥ 6h, previously nudged  → escalate to May log
 *   - ≥ 12h, previously escalated → alert human via ctx.notify()
 *
 * Also detects **orphaned requests**: requests whose linked session has ended
 * (not in active sessions) but status is still CREATED/IN_PROGRESS. These are
 * dropped tasks that need immediate attention — they enter the escalation
 * ladder at the nudge step regardless of age.
 *
 * Complementary to audit-requests (which auto-expires sends at 4h):
 *   task-watchdog: "hey, you have work to do" (2h mark / orphan detection)
 *   audit-requests: "too late, auto-expiring" (4h mark)
 *
 * State tracked in .state/task-watchdog-log.jsonl (JSONL, pruned at 7d).
 *
 * Exports create() conforming to HandlerModule.
 */

import { existsSync, readFileSync, appendFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { HandlerContext, HandlerModule } from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";

// ── Constants ─────────────────────────────────────────────────────────

/** Requests older than this are eligible for nudging. */
const NUDGE_AGE_MS = 2 * 60 * 60 * 1000; // 2h

/** Previously nudged requests older than this get escalated to May. */
const ESCALATE_AGE_MS = 6 * 60 * 60 * 1000; // 6h

/** Previously escalated requests older than this alert the human. */
const ALERT_AGE_MS = 12 * 60 * 60 * 1000; // 12h

/** Max nudges per run to avoid flooding agents. */
const MAX_NUDGES_PER_RUN = 10;

/** JSONL entries older than this are pruned. */
const LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Path to JSONL state file (relative to project root). */
const LOG_FILENAME = "task-watchdog-log.jsonl";

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

export interface TaskWatchdogResult {
  staleCount: number;
  orphanCount: number;
  nudged: Array<{ requestId: string; toAgent: string }>;
  escalated: Array<{ requestId: string; toAgent: string }>;
  alerted: Array<{ requestId: string; toAgent: string }>;
  skipped: number;
  pruned: number;
}

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const result = runTaskWatchdog(ctx);

    if (result.nudged.length > 0) {
      ctx.log(
        `[task-watchdog] 📬 Nudged ${result.nudged.length} agent(s): ${result.nudged.map((n) => `${n.toAgent}/${n.requestId}`).join(", ")}`,
      );
    }
    if (result.orphanCount > 0) {
      ctx.log(
        `[task-watchdog] 👻 Detected ${result.orphanCount} orphaned request(s) (session ended, request still open)`,
      );
    }
    if (result.escalated.length > 0) {
      ctx.log(
        `[task-watchdog] ⚠️ Escalated ${result.escalated.length} request(s): ${result.escalated.map((e) => `${e.toAgent}/${e.requestId}`).join(", ")}`,
      );
    }
    if (result.alerted.length > 0) {
      ctx.log(
        `[task-watchdog] 🚨 Alerted human for ${result.alerted.length} request(s): ${result.alerted.map((a) => `${a.toAgent}/${a.requestId}`).join(", ")}`,
      );
    }
  };
};

// ── Core logic (exported for testing) ─────────────────────────────────

export function runTaskWatchdog(
  ctx: HandlerContext,
  opts?: { now?: number },
): TaskWatchdogResult {
  const now = opts?.now ?? Date.now();
  const logPath = join(ctx.projectRoot, ".state", LOG_FILENAME);

  const result: TaskWatchdogResult = {
    staleCount: 0,
    orphanCount: 0,
    nudged: [],
    escalated: [],
    alerted: [],
    skipped: 0,
    pruned: 0,
  };

  // 1. Query DB for ALL open requests (any method) older than 2h
  let staleRequests: RequestRow[];
  // Also get ALL open requests (any age) to detect orphans
  let allOpenRequests: RequestRow[];
  try {
    const db = ctx.getDb();
    staleRequests = db
      .prepare(
        `SELECT requestId, status, method, toAgent, COALESCE(fromEntity, 'unknown') as fromEntity, sessionId, createdAt, COALESCE(task, '') as task
         FROM requests
         WHERE status IN ('CREATED', 'IN_PROGRESS')
           AND createdAt < ?`,
      )
      .all(now - NUDGE_AGE_MS) as RequestRow[];
    // Fetch all open requests for orphan detection (includes recent ones)
    allOpenRequests = db
      .prepare(
        `SELECT requestId, status, method, toAgent, COALESCE(fromEntity, 'unknown') as fromEntity, sessionId, createdAt, COALESCE(task, '') as task
         FROM requests
         WHERE status IN ('CREATED', 'IN_PROGRESS')`,
      )
      .all() as RequestRow[];
  } catch {
    ctx.log("[task-watchdog] DB not available, skipping.");
    return result;
  }

  result.staleCount = staleRequests.length;

  // 2. Get active session IDs
  const activeSessions = getActiveSessionIds(ctx.persistDir);

  // 2b. Detect orphaned requests: any open request whose sessionId points to
  //     a session that's no longer active. These are dropped tasks — the session
  //     ended without completing the request. They enter the escalation ladder
  //     immediately regardless of age.
  const staleIds = new Set(staleRequests.map(r => r.requestId));
  const orphans = allOpenRequests.filter(r => {
    // Already in the stale set by age
    if (staleIds.has(r.requestId)) return false;
    // Has a sessionId that's no longer active → orphaned
    if (r.sessionId && !activeSessions.has(r.sessionId)) return true;
    return false;
  });

  // Merge orphans into the processing set
  const allCandidates = [...staleRequests, ...orphans];
  result.staleCount = allCandidates.length;
  result.orphanCount = orphans.length;

  if (allCandidates.length === 0) {
    // Still prune old log entries
    result.pruned = pruneLogEntries(logPath, now);
    return result;
  }

  // 3. Load prior actions from JSONL log
  const priorActions = loadPriorActions(logPath);

  // 4. Process each stale/orphaned request
  let nudgeCount = 0;

  for (const req of allCandidates) {
    // Skip IN_PROGRESS requests that have an active session
    if (req.status === "IN_PROGRESS" && req.sessionId && activeSessions.has(req.sessionId)) {
      result.skipped++;
      continue;
    }

    const ageMs = now - req.createdAt;
    const ageH = Math.round((ageMs / 3600000) * 10) / 10; // 1 decimal
    const prior = priorActions.get(req.requestId) ?? new Set<string>();

    // Determine next action based on escalation ladder
    // Orphaned requests enter at nudge step regardless of age
    const isOrphan = orphans.some(o => o.requestId === req.requestId);
    let action: "nudge" | "escalate" | "alert" | null = null;

    if (prior.has("alert")) {
      // Already alerted — don't spam
      result.skipped++;
      continue;
    } else if (prior.has("escalate") && ageMs >= ALERT_AGE_MS) {
      action = "alert";
    } else if (prior.has("nudge") && ageMs >= ESCALATE_AGE_MS) {
      action = "escalate";
    } else if (!prior.has("nudge") && (ageMs >= NUDGE_AGE_MS || isOrphan)) {
      action = "nudge";
    } else {
      // Not yet time for next escalation step
      result.skipped++;
      continue;
    }

    // Execute action
    if (action === "nudge") {
      // Self-nudge protection: skip nudge if toAgent is may
      if (req.toAgent === "may") {
        result.skipped++;
        continue;
      }

      // Max nudges per run cap
      if (nudgeCount >= MAX_NUDGES_PER_RUN) {
        result.skipped++;
        continue;
      }

      try {
        const statusLabel = isOrphan ? `orphaned (session ended, ${req.method})` : `stale ${req.method} request (${ageH}h old)`;
        ctx.emit({
          type: "message_created",
          fromEntity: "may:task-watchdog",
          toAgent: req.toAgent,
          method: "send",
          task: `[task-watchdog] You have a ${statusLabel}, assigned by ${req.fromEntity}, that hasn't been completed:\n${req.task.slice(0, 200)}\nRequest ID: ${req.requestId}\nPlease address this in your next session.`,
          source: "cron:task-watchdog",
          priority: "P1",
        });
        result.nudged.push({ requestId: req.requestId, toAgent: req.toAgent });
        nudgeCount++;
      } catch (err: any) {
        ctx.log(`[task-watchdog] Failed to nudge ${req.toAgent} for ${req.requestId}: ${err?.message?.slice(0, 100)}`);
        continue;
      }
    } else if (action === "escalate") {
      ctx.log(
        `[task-watchdog] ⚠️ ESCALATION: Request ${req.requestId} (${req.method}) to ${req.toAgent} (from ${req.fromEntity}) is ${ageH}h old. Previously nudged, still not picked up. Task: ${req.task.slice(0, 150)}`,
      );
      result.escalated.push({ requestId: req.requestId, toAgent: req.toAgent });
    } else if (action === "alert") {
      ctx.notify(
        `🚨 Stale task alert: ${req.toAgent} has not picked up ${req.method} request from ${req.fromEntity} after ${ageH}h.\nTask: ${req.task.slice(0, 200)}\nRequest: ${req.requestId}`,
      );
      result.alerted.push({ requestId: req.requestId, toAgent: req.toAgent });
    }

    // Append to JSONL log
    appendLogEntry(logPath, {
      timestamp: new Date(now).toISOString(),
      requestId: req.requestId,
      toAgent: req.toAgent,
      fromEntity: req.fromEntity,
      action,
      requestAgeH: ageH,
      task: req.task.slice(0, 150),
    });
  }

  // 5. Prune old log entries
  result.pruned = pruneLogEntries(logPath, now);

  return result;
}

// ── Helpers (exported for testing) ────────────────────────────────────

/**
 * Get set of currently active session IDs by scanning .state/sessions/active/.
 */
export function getActiveSessionIds(persistDir: string): Set<string> {
  const activeDir = join(persistDir, "sessions", "active");
  if (!existsSync(activeDir)) return new Set();
  try {
    return new Set(readdirSync(activeDir).filter((n) => n.startsWith("s_")));
  } catch {
    return new Set();
  }
}

/**
 * Load prior actions per requestId from the JSONL log.
 * Returns a Map of requestId → Set of action types taken.
 */
export function loadPriorActions(logPath: string): Map<string, Set<string>> {
  const actions = new Map<string, Set<string>>();
  if (!existsSync(logPath)) return actions;

  try {
    const raw = readFileSync(logPath, "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const entry = JSON.parse(trimmed) as WatchdogLogEntry;
        if (!actions.has(entry.requestId)) {
          actions.set(entry.requestId, new Set());
        }
        actions.get(entry.requestId)!.add(entry.action);
      } catch {
        // Skip malformed lines
      }
    }
  } catch {
    // File unreadable — treat as empty
  }

  return actions;
}

/**
 * Append a log entry to the JSONL file.
 */
export function appendLogEntry(logPath: string, entry: WatchdogLogEntry): void {
  const dir = dirname(logPath);
  mkdirSync(dir, { recursive: true });
  appendFileSync(logPath, JSON.stringify(entry) + "\n");
}

/**
 * Prune JSONL log entries older than 7 days. Returns count of lines pruned.
 */
export function pruneLogEntries(logPath: string, now: number): number {
  if (!existsSync(logPath)) return 0;

  try {
    const raw = readFileSync(logPath, "utf-8");
    const lines = raw.split("\n");
    const cutoff = now - LOG_RETENTION_MS;
    const kept: string[] = [];
    let pruned = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const entry = JSON.parse(trimmed) as WatchdogLogEntry;
        if (new Date(entry.timestamp).getTime() >= cutoff) {
          kept.push(trimmed);
        } else {
          pruned++;
        }
      } catch {
        // Keep malformed lines (don't lose data)
        kept.push(trimmed);
      }
    }

    if (pruned > 0) {
      writeFileSync(logPath, kept.length > 0 ? kept.join("\n") + "\n" : "");
    }
    return pruned;
  } catch {
    return 0;
  }
}
