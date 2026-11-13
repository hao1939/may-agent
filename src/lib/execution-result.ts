import type { SqliteDb } from "./db.js";

export type ExecutionKind = "session" | "workflow";
export type ExecutionStatus = "running" | "done" | "error" | "interrupted" | "blocked" | "escalated";

export interface ExecutionResult {
  id: string;
  kind: ExecutionKind;
  status: ExecutionStatus;
  summary: string;
  traceId: string;
  owner?: string;
  parentId?: string;
  projectId?: string;
  startedAt?: number;
  endedAt?: number;
  facts?: Record<string, unknown>;
}

interface SessionRow {
  sessionId: string;
  agent: string;
  task: string;
  status: string;
  kind?: string | null;
  source?: string | null;
  parentSessionId?: string | null;
  workflowRunId?: string | null;
  projectId?: string | null;
  startedAt?: number | null;
  endedAt?: number | null;
  error?: string | null;
  outcome?: string | null;
  opCount?: number | null;
}

interface WorkflowRow {
  runId: string;
  workflow: string;
  task: string;
  parentSessionId?: string | null;
  parentWorkflowRunId?: string | null;
  projectId?: string | null;
  depth?: number | null;
  status: string;
  startedAt?: number | null;
  endedAt?: number | null;
  result_summary?: string | null;
  result_reason?: string | null;
}

function compact(text: unknown, fallback: string): string {
  const value = typeof text === "string" ? text.trim() : "";
  if (!value) return fallback;
  return value.length > 500 ? `${value.slice(0, 497)}...` : value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
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
    traceId: row.workflowRunId ?? row.sessionId,
    owner: row.agent,
    parentId: optionalString(row.parentSessionId),
    projectId: optionalString(row.projectId),
    startedAt: optionalNumber(row.startedAt),
    endedAt: optionalNumber(row.endedAt),
    facts: {
      agent: row.agent,
      task: row.task,
      kind: row.kind,
      source: row.source,
      workflowRunId: row.workflowRunId,
      opCount: row.opCount,
    },
  };
}

export function workflowRowToExecutionResult(row: WorkflowRow): ExecutionResult {
  const status = normalizeExecutionStatus("workflow", row.status);
  return {
    id: row.runId,
    kind: "workflow",
    status,
    summary: compact(row.result_summary ?? row.result_reason, `${row.workflow} ${status}: ${row.task}`),
    traceId: row.runId,
    parentId: optionalString(row.parentWorkflowRunId ?? row.parentSessionId),
    projectId: optionalString(row.projectId),
    startedAt: optionalNumber(row.startedAt),
    endedAt: optionalNumber(row.endedAt),
    facts: {
      workflow: row.workflow,
      task: row.task,
      depth: row.depth,
      parentSessionId: row.parentSessionId,
      parentWorkflowRunId: row.parentWorkflowRunId,
    },
  };
}

export function getExecutionResultFromDb(db: SqliteDb, id: string): ExecutionResult | null {
  const session = db.prepare("SELECT * FROM sessions WHERE sessionId = ?").get(id) as SessionRow | null;
  if (session) return sessionRowToExecutionResult(session);

  const workflow = db.prepare("SELECT * FROM workflow_runs WHERE runId = ?").get(id) as WorkflowRow | null;
  if (workflow) return workflowRowToExecutionResult(workflow);

  return null;
}
