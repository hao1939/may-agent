/**
 * Dispatch Dedup Guard (EXP-860 Layer 3)
 * 
 * Prevents zombie task accumulation by tracking dispatch history and applying
 * exponential backoff when tasks repeatedly fail or get interrupted.
 * 
 * Usage in heartbeat workflows:
 *   import { shouldDispatch, recordDispatch, recordOutcome } from "./dispatch-dedup-guard.js";
 *   
 *   if (shouldDispatch(ctx, agent, taskDescription)) {
 *     const result = await ctx.runAgent(agent, taskDescription);
 *     recordOutcome(ctx, agent, taskDescription, result.status);
 *   }
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface DispatchRecord {
  agent: string;
  taskPrefix: string;
  attempts: number;
  failures: number;
  lastAttempt: string;
  lastStatus: string;
  blocked: boolean;
  blockReason?: string;
}

interface DispatchDb {
  records: Record<string, DispatchRecord>;
  version: number;
}

const DEDUP_FILE = "dispatch-dedup.json";
const MAX_FAILURES_BEFORE_BLOCK = 3;
const WINDOW_DAYS = 7;
const PREFIX_LENGTH = 80;
export const DEFAULT_RUNNING_LEASE_MS = 10 * 60 * 1000;

function getDbPath(): string {
  const cwd = process.cwd();
  const stateDir = process.env.STATE_DIR
    ?? (existsSync("/app/.state") ? "/app/.state" : undefined)
    ?? (existsSync(join(cwd, "app", ".state")) ? join(cwd, "app", ".state") : join(cwd, ".state"));
  return join(stateDir, DEDUP_FILE);
}

function loadDb(): DispatchDb {
  const path = getDbPath();
  if (!existsSync(path)) {
    return { records: {}, version: 1 };
  }
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return { records: {}, version: 1 };
  }
}

function saveDb(db: DispatchDb): void {
  const path = getDbPath();
  mkdirSync(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  writeFileSync(path, JSON.stringify(db, null, 2));
}

function makeKey(agent: string, task: string): string {
  const prefix = task.substring(0, PREFIX_LENGTH).replace(/[^a-zA-Z0-9 ]/g, "").trim();
  return `${agent}::${prefix}`;
}

function isWithinWindow(dateStr: string): boolean {
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  return (now - then) < WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Check whether a task should be dispatched.
 * Returns true if safe to dispatch, false if blocked by dedup guard.
 */
export function shouldDispatch(
  agent: string,
  taskDescription: string,
  opts?: { force?: boolean; runningLeaseMs?: number }
): { allowed: boolean; reason?: string; attempts?: number } {
  if (opts?.force) {
    return { allowed: true, reason: "force override" };
  }

  const db = loadDb();
  const key = makeKey(agent, taskDescription);
  const record = db.records[key];

  if (!record) {
    return { allowed: true, attempts: 0 };
  }

  // If last attempt is outside window, reset
  if (!isWithinWindow(record.lastAttempt)) {
    return { allowed: true, attempts: 0 };
  }

  // If explicitly blocked
  if (record.blocked) {
    return { 
      allowed: false, 
      reason: record.blockReason || `Blocked after ${record.failures} failures in ${WINDOW_DAYS}d`,
      attempts: record.attempts
    };
  }

  // Apply failure threshold
  if (record.failures >= MAX_FAILURES_BEFORE_BLOCK) {
    return {
      allowed: false,
      reason: `${record.failures} failures in last ${WINDOW_DAYS} days (threshold: ${MAX_FAILURES_BEFORE_BLOCK})`,
      attempts: record.attempts
    };
  }

  // If currently "running" (last status), check for staleness
  if (record.lastStatus === "running") {
    const runningLeaseMs = opts?.runningLeaseMs ?? DEFAULT_RUNNING_LEASE_MS;
    const msSince = Date.now() - new Date(record.lastAttempt).getTime();
    if (msSince < runningLeaseMs) {
      return {
        allowed: false,
        reason: `Task appears to still be running (started <${Math.ceil(runningLeaseMs / 60000)}m ago)`,
        attempts: record.attempts,
      };
    }
    // Lease expired. The caller may dispatch again; the next recordDispatch()
    // replaces the stale running marker. Running is a short lease, not durable
    // liveness truth, because process death can strand this JSON state.
  }

  return { allowed: true, attempts: record.attempts };
}

/**
 * Record that a dispatch is being attempted.
 */
export function recordDispatch(agent: string, taskDescription: string): void {
  const db = loadDb();
  const key = makeKey(agent, taskDescription);
  
  if (!db.records[key]) {
    db.records[key] = {
      agent,
      taskPrefix: taskDescription.substring(0, PREFIX_LENGTH),
      attempts: 0,
      failures: 0,
      lastAttempt: new Date().toISOString(),
      lastStatus: "running",
      blocked: false,
    };
  }

  const record = db.records[key];
  
  // Reset if outside window
  if (!isWithinWindow(record.lastAttempt)) {
    record.attempts = 0;
    record.failures = 0;
    record.blocked = false;
  }

  record.attempts++;
  record.lastAttempt = new Date().toISOString();
  record.lastStatus = "running";
  
  saveDb(db);
}

/**
 * Record the outcome of a dispatched task.
 */
export function recordOutcome(
  agent: string,
  taskDescription: string,
  status: "success" | "failure" | "interrupted" | "error" | "partial"
): void {
  const db = loadDb();
  const key = makeKey(agent, taskDescription);
  
  if (!db.records[key]) {
    // Shouldn't happen, but handle gracefully
    recordDispatch(agent, taskDescription);
  }

  const record = db.records[key];
  record.lastStatus = status;

  const failureStatuses = ["failure", "interrupted", "error"];
  if (failureStatuses.includes(status)) {
    record.failures++;
    if (record.failures >= MAX_FAILURES_BEFORE_BLOCK) {
      record.blocked = true;
      record.blockReason = `Auto-blocked: ${record.failures} ${status} outcomes in ${WINDOW_DAYS}d window`;
    }
  } else if (status === "success") {
    // Success resets the failure counter
    record.failures = 0;
    record.blocked = false;
    record.blockReason = undefined;
  }
  // "partial" doesn't increment failure counter but doesn't reset either

  saveDb(db);
}

/**
 * Manually unblock a task (escape hatch).
 */
export function unblock(agent: string, taskDescription: string): void {
  const db = loadDb();
  const key = makeKey(agent, taskDescription);
  if (db.records[key]) {
    db.records[key].blocked = false;
    db.records[key].failures = 0;
    db.records[key].blockReason = undefined;
    saveDb(db);
  }
}

/**
 * Get a summary of all blocked tasks (for diagnostics).
 */
export function getBlockedTasks(): DispatchRecord[] {
  const db = loadDb();
  return Object.values(db.records).filter(r => r.blocked && isWithinWindow(r.lastAttempt));
}

/**
 * Wrap any async function with dedup guard protection.
 * Use this for project iteration dispatch or any repeated async work.
 * 
 * Usage:
 *   const result = await withDedupGuard("bob", "project:my-project", async () => {
 *     return runMasterWorker(config);
 *   });
 */
export async function withDedupGuard<T extends { stopped?: boolean; stopReason?: string }>(
  agent: string,
  taskLabel: string,
  runFn: () => Promise<T>,
  opts?: { force?: boolean }
): Promise<T | { stopped: true; stopReason: string; dedupBlocked: true }> {
  const check = shouldDispatch(agent, taskLabel, opts);
  if (!check.allowed) {
    return { stopped: true, stopReason: `dedup-blocked: ${check.reason}`, dedupBlocked: true };
  }
  recordDispatch(agent, taskLabel);
  try {
    const result = await runFn();
    const status = result.stopReason?.includes("error") ? "error" as const : "success" as const;
    recordOutcome(agent, taskLabel, status);
    return result;
  } catch (err) {
    recordOutcome(agent, taskLabel, "error");
    throw err;
  }
}

/**
 * Clean up stale entries older than the window.
 */
export function cleanup(): number {
  const db = loadDb();
  const before = Object.keys(db.records).length;
  for (const [key, record] of Object.entries(db.records)) {
    if (!isWithinWindow(record.lastAttempt)) {
      delete db.records[key];
    }
  }
  const removed = before - Object.keys(db.records).length;
  if (removed > 0) saveDb(db);
  return removed;
}
