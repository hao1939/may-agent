/**
 * requests.ts — Database schema & helpers (SQLite)
 *
 * Manages the may.db schema (sessions, events, evaluations, gym, etc.)
 * The original `requests` table has been removed — work tracking uses
 * the sessions table and events table (event-native architecture).
 */

import { getDb } from "./db/connection.js";
export { getDb, closeDb, closeAllDbs } from "./db/connection.js";

// ── Types ──────────────────────────────────────────────────────────────

// ErrorClass and classifyError are now in classify-error.ts (pure, no bun:sqlite deps)
export type { ErrorClass } from "./classify-error.js";

// ── Schema ─────────────────────────────────────────────────────────────
// Schema and migrations live in ./db/schema.ts; requests.ts remains the public DB facade.

// ── Core Operations ────────────────────────────────────────────────────

// ── Error Classification ───────────────────────────────────────────────

// classifyError moved to classify-error.ts — re-export for backward compat
export { classifyError } from "./classify-error.js";

// ── Evaluations ────────────────────────────────────────────────────────

interface EvaluationRecord {
  sessionId: string;
  agent: string;
  quality: number;
  efficiency: number;
  verdict: string;
  issues: string[];
  usage: Record<string, unknown> | null;
  createdAt: number;
}

/**
 * Check if an evaluation already exists for a session.
 */
export function hasEvaluation(persistDir: string, sessionId: string): boolean {
  const db = getDb(persistDir);
  const row = db.prepare("SELECT 1 FROM evaluations WHERE sessionId = ?").get(sessionId);
  return row !== null;
}

/**
 * Get all evaluations within a time window.
 */
export function getEvaluationsSince(persistDir: string, sinceMs: number): EvaluationRecord[] {
  const db = getDb(persistDir);
  return (
    db.prepare("SELECT * FROM evaluations WHERE createdAt >= ? ORDER BY createdAt ASC").all(sinceMs) as Record<
      string,
      unknown
    >[]
  ).map((row) => ({
    sessionId: row.sessionId as string,
    agent: row.agent as string,
    quality: row.quality as number,
    efficiency: row.efficiency as number,
    verdict: row.verdict as string,
    issues: safeParseJson(row.issues as string | null, []) as string[],
    usage: safeParseJson(row.usage as string | null, null),
    createdAt: row.createdAt as number,
  }));
}

function safeParseJson(s: string | null, fallback: any): any {
  if (!s) return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}

// ── Session DB helpers ─────────────────────────────────────────────────
//
// These mirror session meta.json data into the sessions table for
// SQL queryability. Called from RegistryStore — non-blocking, best-effort.

interface SessionDbEntry {
  sessionId: string;
  agent: string;
  task: string;
  status: string;
  kind?: string;
  source?: string;
  parentSessionId?: string;
  requestId?: string;
  workflowRunId?: string;
  projectId?: string;
  stepLabel?: string;
  startedAt: number;
  endedAt?: number;
  error?: string;
  outcome?: string;
  opCount?: number;
}

/** Insert or replace a session row. */
export function upsertSession(persistDir: string, entry: SessionDbEntry): void {
  const db = getDb(persistDir);
  db.run(
    `INSERT OR REPLACE INTO sessions
      (sessionId, agent, task, status, kind, source, parentSessionId, requestId, workflowRunId, projectId, stepLabel, startedAt, endedAt, error, outcome, opCount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.sessionId,
      entry.agent,
      entry.task ?? "",
      entry.status,
      entry.kind ?? "job",
      entry.source ?? null,
      entry.parentSessionId ?? null,
      entry.requestId ?? null,
      entry.workflowRunId ?? null,
      entry.projectId ?? null,
      entry.stepLabel ?? null,
      entry.startedAt,
      entry.endedAt ?? null,
      entry.error ?? null,
      entry.outcome ?? null,
      entry.opCount ?? 0,
    ],
  );
}

/** Update session status fields only (for updateSessionStatus calls). */
export function updateSessionDb(
  persistDir: string,
  sessionId: string,
  fields: {
    status: string;
    endedAt?: number;
    error?: string;
    outcome?: string;
    opCount?: number;
  },
): void {
  const db = getDb(persistDir);
  // Use COALESCE for opCount so a later update without opCount doesn't overwrite
  // a previous write that set it correctly. This prevents the race where manager
  // sets opCount=15 and then DbWriter overwrites it with 0.
  db.run(`UPDATE sessions SET status = ?, endedAt = COALESCE(?, endedAt), error = ?, outcome = COALESCE(?, outcome), opCount = CASE WHEN ? > opCount THEN ? ELSE opCount END WHERE sessionId = ?`, [
    fields.status,
    fields.endedAt ?? null,
    fields.error ?? null,
    fields.outcome ?? null,
    fields.opCount ?? 0,
    fields.opCount ?? 0,
    sessionId,
  ]);
}

// ── Workflow Runs (DB-backed, replaces .state/workflows/*.json) ────────

export interface WorkflowRunRecord {
  runId: string;
  workflow: string;
  task: string;
  parentSessionId: string | null;
  parentWorkflowRunId: string | null;
  projectId?: string | null;
  depth: number;
  status: string;
  startedAt: number;
  endedAt: number | null;
  result_summary: string | null;
  result_reason: string | null;
  resumedFromRunId: string | null;
}

/** Insert a new workflow run. */
export function insertWorkflowRun(persistDir: string, run: WorkflowRunRecord): void {
  const db = getDb(persistDir);
  db.run(
    `INSERT OR REPLACE INTO workflow_runs
      (runId, workflow, task, parentSessionId, parentWorkflowRunId, projectId, depth, status, startedAt, endedAt, result_summary, result_reason, resumedFromRunId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      run.runId, run.workflow, run.task, run.parentSessionId, run.parentWorkflowRunId,
      run.projectId ?? null, run.depth, run.status, run.startedAt, run.endedAt,
      run.result_summary, run.result_reason, run.resumedFromRunId,
    ],
  );
}

/** Update a workflow run's status and result. */
export function updateWorkflowRun(
  persistDir: string,
  runId: string,
  fields: { status: string; endedAt?: number; result_summary?: string; result_reason?: string },
): void {
  const db = getDb(persistDir);
  db.run(
    `UPDATE workflow_runs SET status = ?, endedAt = COALESCE(?, endedAt), result_summary = COALESCE(?, result_summary), result_reason = COALESCE(?, result_reason) WHERE runId = ?`,
    [fields.status, fields.endedAt ?? null, fields.result_summary ?? null, fields.result_reason ?? null, runId],
  );
}

/** Read a workflow run by ID. */
export function getWorkflowRun(persistDir: string, runId: string): WorkflowRunRecord | null {
  const db = getDb(persistDir);
  return db.prepare("SELECT * FROM workflow_runs WHERE runId = ?").get(runId) as WorkflowRunRecord | null;
}

/** List all workflow run IDs, ordered by startedAt. */
export function listWorkflowRunIds(persistDir: string): string[] {
  const db = getDb(persistDir);
  return (db.prepare("SELECT runId FROM workflow_runs ORDER BY startedAt").all() as Array<{ runId: string }>).map(r => r.runId);
}

/** Get step sessions for a workflow run, ordered by startedAt. */
export function getWorkflowStepSessions(persistDir: string, workflowRunId: string): Array<{
  sessionId: string; agent: string; task: string; status: string;
  stepLabel: string | null; startedAt: number; endedAt: number | null; outcome: string | null;
}> {
  const db = getDb(persistDir);
  return db.prepare(
    `SELECT sessionId, agent, task, status, stepLabel, startedAt, endedAt, outcome
     FROM sessions WHERE workflowRunId = ? ORDER BY startedAt`
  ).all(workflowRunId) as any[];
}
