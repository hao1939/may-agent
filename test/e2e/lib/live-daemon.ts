/**
 * Live-stack helpers for e2e tests:
 *   - DB read access (read-only, opens its own connection to sandbox DB)
 *   - Deadline polling
 *   - Socket command helpers (wrap packages/control client)
 */

import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { sendSocketCommand } from "../../../packages/control/src/client.js";

export interface EventRow {
  id: number;
  event_type: string;
  source: string | null;
  owner: string | null;
  data: string | null;
  timestamp: number;
}

export interface WorkflowRunRow {
  runId: string;
  workflow: string;
  task: string;
  projectId: string | null;
  status: string;
  startedAt: number;
  endedAt: number | null;
  result_summary: string | null;
  result_reason: string | null;
}

export function openSandboxDb(dbPath: string): Database {
  if (!existsSync(dbPath)) {
    throw new Error(`sandbox db does not exist yet: ${dbPath}`);
  }
  return new Database(dbPath, { readonly: true });
}

/**
 * Poll predicate at intervalMs until it returns truthy or timeoutMs elapses.
 * Returns the truthy value on success, throws on timeout.
 */
export async function pollUntil<T>(
  predicate: () => Promise<T | null | undefined | false> | T | null | undefined | false,
  opts: { timeoutMs: number; intervalMs?: number; description?: string },
): Promise<T> {
  const start = performance.now();
  const interval = opts.intervalMs ?? 200;
  let lastErr: unknown = null;
  while (performance.now() - start < opts.timeoutMs) {
    try {
      const v = await predicate();
      if (v) return v as T;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  const desc = opts.description ?? "condition";
  const errSuffix = lastErr ? ` (last error: ${(lastErr as Error).message ?? lastErr})` : "";
  throw new Error(`pollUntil timeout after ${opts.timeoutMs}ms: ${desc}${errSuffix}`);
}

/**
 * Query events table for events of given types since a timestamp.
 */
export function queryEvents(
  db: Database,
  opts: { types?: string[]; since?: number; owner?: string; limit?: number },
): EventRow[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (opts.types && opts.types.length > 0) {
    clauses.push(`event_type IN (${opts.types.map(() => "?").join(",")})`);
    params.push(...opts.types);
  }
  if (opts.since !== undefined) {
    clauses.push("timestamp >= ?");
    params.push(opts.since);
  }
  if (opts.owner !== undefined) {
    clauses.push("owner = ?");
    params.push(opts.owner);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = opts.limit ?? 100;
  const rows = db
    .prepare(`SELECT id, event_type, source, owner, data, timestamp FROM events ${where} ORDER BY timestamp DESC LIMIT ?`)
    .all(...params, limit) as EventRow[];
  return rows;
}

export function queryWorkflowRuns(
  db: Database,
  opts: { projectId?: string; workflow?: string; status?: string; since?: number },
): WorkflowRunRow[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (opts.projectId !== undefined) {
    clauses.push("projectId = ?");
    params.push(opts.projectId);
  }
  if (opts.workflow !== undefined) {
    clauses.push("workflow = ?");
    params.push(opts.workflow);
  }
  if (opts.status !== undefined) {
    clauses.push("status = ?");
    params.push(opts.status);
  }
  if (opts.since !== undefined) {
    clauses.push("startedAt >= ?");
    params.push(opts.since);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT runId, workflow, task, projectId, status, startedAt, endedAt, result_summary, result_reason FROM workflow_runs ${where} ORDER BY startedAt DESC LIMIT 100`,
    )
    .all(...params) as WorkflowRunRow[];
  return rows;
}

export interface SessionRow {
  sessionId: string;
  agent: string;
  kind: string | null;
  status: string;
  source: string | null;
  parentSessionId: string | null;
  workflowRunId: string | null;
  projectId: string | null;
  task: string;
  startedAt: number;
  endedAt: number | null;
}

export function querySessions(
  db: Database,
  opts: { agent?: string; agents?: string[]; status?: string; since?: number; limit?: number } = {},
): SessionRow[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (opts.agent !== undefined) {
    clauses.push("agent = ?");
    params.push(opts.agent);
  }
  if (opts.agents !== undefined && opts.agents.length > 0) {
    clauses.push(`agent IN (${opts.agents.map(() => "?").join(",")})`);
    params.push(...opts.agents);
  }
  if (opts.status !== undefined) {
    clauses.push("status = ?");
    params.push(opts.status);
  }
  if (opts.since !== undefined) {
    clauses.push("startedAt >= ?");
    params.push(opts.since);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 1000));
  const rows = db
    .prepare(
      `SELECT sessionId, agent, kind, status, source, parentSessionId, workflowRunId, projectId, task, startedAt, endedAt FROM sessions ${where} ORDER BY startedAt DESC LIMIT ${limit}`,
    )
    .all(...params) as SessionRow[];
  return rows;
}

export async function socketStatus(socketPath: string): Promise<unknown> {
  return sendSocketCommand(socketPath, { type: "status" }, { timeoutMs: 5000 });
}

export async function socketEmit(
  socketPath: string,
  eventType: string,
  data: Record<string, unknown> = {},
): Promise<unknown> {
  return sendSocketCommand(socketPath, { type: eventType, ...data }, { timeoutMs: 5000 });
}
