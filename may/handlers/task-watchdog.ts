/**
 * task-watchdog — Proactive nudging for stale/orphaned requests.
 *
 * Runs every 60 minutes. Detects requests that are stale (>2h) or orphaned
 * (session dead), nudges the target agent, escalates to May at 6h, alerts
 * human at 12h. Tracks actions via JSONL state file.
 *
 * Complementary to audit-requests (which expires at 4h).
 */

import { resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import type { HandlerContext, HandlerModule, TriggerEvent } from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";

const LOG_FILE = "task-watchdog-log.jsonl";
const MAX_NUDGES_PER_RUN = 10;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface LogEntry {
  timestamp: string;
  requestId: string;
  toAgent: string;
  fromEntity: string;
  action: "nudge" | "escalate" | "alert";
  requestAgeH: number;
  task: string;
}

export interface RequestRow {
  id: string;
  status: string;
  method?: string;
  toAgent?: string;
  fromEntity?: string;
  sessionId?: string;
  task?: string;
  createdAt: number;
}

export function loadLog(logPath: string): LogEntry[] {
  if (!existsSync(logPath)) return [];
  try {
    const content = readFileSync(logPath, "utf-8").trim();
    if (!content) return [];
    return content.split("\n").map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

export function appendLog(logPath: string, entry: LogEntry): void {
  const dir = resolve(logPath, "..");
  mkdirSync(dir, { recursive: true });
  const line = JSON.stringify(entry) + "\n";
  // Append
  const existing = existsSync(logPath) ? readFileSync(logPath, "utf-8") : "";
  writeFileSync(logPath, existing + line);
}

export function pruneLog(logPath: string, now: number): void {
  if (!existsSync(logPath)) return;
  const entries = loadLog(logPath);
  const cutoff = now - SEVEN_DAYS_MS;
  const kept = entries.filter((e) => new Date(e.timestamp).getTime() > cutoff);
  writeFileSync(logPath, kept.map((e) => JSON.stringify(e)).join("\n") + (kept.length ? "\n" : ""));
}

export function getActiveSessionIds(stateDir: string): Set<string> {
  const activeDir = resolve(stateDir, "sessions/active");
  if (!existsSync(activeDir)) return new Set();
  try {
    return new Set(readdirSync(activeDir).map((f) => f.replace(/\.json$/, "")));
  } catch {
    return new Set();
  }
}

export function determineAction(
  request: RequestRow,
  priorActions: LogEntry[],
  activeSessionIds: Set<string>,
  now: number
): "nudge" | "escalate" | "alert" | "skip" {
  const ageMs = now - request.createdAt;

  // If IN_PROGRESS with an active session, skip
  if (request.status === "IN_PROGRESS" && request.sessionId && activeSessionIds.has(request.sessionId)) {
    return "skip";
  }

  const hasNudge = priorActions.some((a) => a.action === "nudge");
  const hasEscalate = priorActions.some((a) => a.action === "escalate");
  const hasAlert = priorActions.some((a) => a.action === "alert");

  if (hasAlert) return "skip";
  if (hasEscalate && ageMs >= TWELVE_HOURS_MS) return "alert";
  if (hasNudge && ageMs >= SIX_HOURS_MS) return "escalate";

  // Orphan detection: IN_PROGRESS with a sessionId that's not active
  const isOrphan = request.status === "IN_PROGRESS" && request.sessionId && !activeSessionIds.has(request.sessionId);

  if (!hasNudge && (ageMs >= TWO_HOURS_MS || isOrphan)) return "nudge";

  return "skip";
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async (_event?: TriggerEvent) => {
    const now = Date.now();
    const logPath = resolve(ctx.persistDir || ".state", LOG_FILE);

    let db: any;
    try {
      db = ctx.getDb();
    } catch (e) {
      ctx.log(`[task-watchdog] Failed to get DB: ${e}`);
      return;
    }

    // Query stale requests (>2h old)
    let staleRequests: RequestRow[] = [];
    let allOpenRequests: RequestRow[] = [];
    try {
      const twoHoursAgo = now - TWO_HOURS_MS;
      staleRequests = db.prepare(
        `SELECT id, status, method, toAgent, fromEntity, sessionId, task, createdAt FROM requests WHERE status IN ('CREATED', 'IN_PROGRESS') AND createdAt < ?`
      ).all(twoHoursAgo) as RequestRow[];

      allOpenRequests = db.prepare(
        `SELECT id, status, method, toAgent, fromEntity, sessionId, task, createdAt FROM requests WHERE status IN ('CREATED', 'IN_PROGRESS')`
      ).all() as RequestRow[];
    } catch (e) {
      ctx.log(`[task-watchdog] DB query error: ${e}`);
      return;
    }

    // Get active sessions
    const stateDir = resolve(ctx.projectRoot || ".", ".state");
    const activeSessionIds = getActiveSessionIds(stateDir);

    // Merge: stale + orphans from allOpen that aren't already in stale set
    const staleIds = new Set(staleRequests.map((r) => r.id));
    const orphans = allOpenRequests.filter((r) =>
      !staleIds.has(r.id) &&
      r.status === "IN_PROGRESS" &&
      r.sessionId &&
      !activeSessionIds.has(r.sessionId)
    );
    const candidates = [...staleRequests, ...orphans];

    // Load log
    const logEntries = loadLog(logPath);

    let nudgeCount = 0;

    for (const req of candidates) {
      const priorActions = logEntries.filter((e) => e.requestId === req.id);
      const action = determineAction(req, priorActions, activeSessionIds, now);

      if (action === "skip") continue;

      const ageH = Math.round(((now - req.createdAt) / 3600000) * 10) / 10;
      const toAgent = req.toAgent || "unknown";
      const fromEntity = req.fromEntity || "unknown";
      const task = req.task || "";
      const method = req.method || "unknown";
      const isOrphan = req.status === "IN_PROGRESS" && req.sessionId && !activeSessionIds.has(req.sessionId);

      if (action === "nudge") {
        if (nudgeCount >= MAX_NUDGES_PER_RUN) continue;

        // Self-nudge protection: skip nudging may
        if (toAgent === "may") {
          // Still log it but don't send
        } else {
          const orphanLabel = isOrphan ? " (orphaned)" : "";
          const msg = `[task-watchdog] You have a stale${orphanLabel} ${method} request (${ageH}h old, assigned by ${fromEntity}) that hasn't been picked up:\n${task.slice(0, 200)}\nRequest ID: ${req.id}\nPlease address this in your next session.`;
          try {
            (ctx.manager as any).send(toAgent, msg);
          } catch (e) {
            ctx.log(`[task-watchdog] Failed to send nudge to ${toAgent}: ${e}`);
          }
        }
        nudgeCount++;
      } else if (action === "escalate") {
        ctx.log(`[task-watchdog] ⚠️ ESCALATION: Request ${req.id} to ${toAgent} (from ${fromEntity}) is ${ageH}h old. Previously nudged, still not picked up. Task: ${task.slice(0, 150)}`);
      } else if (action === "alert") {
        try {
          ctx.notify(`🚨 Stale task alert: ${toAgent} has not picked up request from ${fromEntity} after ${ageH}h.\nTask: ${task.slice(0, 200)}\nRequest: ${req.id}`);
        } catch (e) {
          ctx.log(`[task-watchdog] Failed to notify: ${e}`);
        }
      }

      // Append to log
      const entry: LogEntry = {
        timestamp: new Date(now).toISOString(),
        requestId: req.id,
        toAgent,
        fromEntity,
        action,
        requestAgeH: ageH,
        task: task.slice(0, 150),
      };
      appendLog(logPath, entry);
      logEntries.push(entry); // keep in-memory version updated
    }

    // Prune old entries
    pruneLog(logPath, now);

    ctx.log(`[task-watchdog] Run complete. Processed ${candidates.length} candidates, sent ${nudgeCount} nudges.`);
  };
};
