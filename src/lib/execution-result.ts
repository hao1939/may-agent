import type { SqliteDb } from "./db.js";

export type ExecutionKind = "session" | "workflow";
export type ExecutionStatus = "running" | "done" | "error" | "interrupted" | "blocked" | "escalated";

export interface ExecutionResult {
  id: string;
  kind: ExecutionKind;
  status: ExecutionStatus;
  summary: string;
}

interface SessionRow {
  sessionId: string;
  agent: string;
  task: string;
  status: string;
  error?: string | null;
  outcome?: string | null;
}

interface WorkflowRow {
  runId: string;
  workflow: string;
  task: string;
  status: string;
  result_summary?: string | null;
  result_reason?: string | null;
}

function compact(text: unknown, fallback: string): string {
  const value = typeof text === "string" ? text.trim() : "";
  if (!value) return fallback;
  return value.length > 500 ? `${value.slice(0, 497)}...` : value;
}

export function normalizeExecutionStatus(kind: ExecutionKind, status: string): ExecutionStatus {
  if (kind === "workflow" && status === "blocked") return "blocked";
  if (kind === "workflow" && status === "escalated") return "blocked";
  if (status === "done") return "done";
  if (status === "error") return "error";
  if (status === "interrupted") return "interrupted";
  if (status === "escalated") return "escalated";
  return "running";
}

export function sessionRowToExecutionResult(row: SessionRow): ExecutionResult {
  const status = normalizeExecutionStatus("session", row.status);
  return {
    id: row.sessionId,
    kind: "session",
    status,
    summary: compact(row.error ?? row.outcome, `${row.agent} ${status}: ${row.task}`),
  };
}

export function workflowRowToExecutionResult(row: WorkflowRow): ExecutionResult {
  const status = normalizeExecutionStatus("workflow", row.status);
  return {
    id: row.runId,
    kind: "workflow",
    status,
    summary: compact(row.result_summary ?? row.result_reason, `${row.workflow} ${status}: ${row.task}`),
  };
}

export function getExecutionResultFromDb(db: SqliteDb, id: string): ExecutionResult | null {
  const session = db.prepare("SELECT sessionId, agent, task, status, error, outcome FROM sessions WHERE sessionId = ?").get(id) as SessionRow | null;
  if (session) return sessionRowToExecutionResult(session);

  const workflow = db.prepare("SELECT runId, workflow, task, status, result_summary, result_reason FROM workflow_runs WHERE runId = ?").get(id) as WorkflowRow | null;
  if (workflow) return workflowRowToExecutionResult(workflow);

  return null;
}
