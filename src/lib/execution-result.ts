import type { SqliteDb } from "./db.js";
import { getDb } from "./requests.js";
import type { TaskResult } from "./types.js";
import type { WorkflowToolResult } from "./workflow.js";

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
  evidence?: Record<string, unknown>;
}

export interface ResumeDiagnostic {
  kind: ExecutionKind;
  id: string;
  status?: ExecutionStatus;
  reason: string;
  category?: string;
  recoverable?: boolean;
  nextAction?: string;
  owner?: string;
  agent?: string;
  workflow?: string;
  projectId?: string;
  parentId?: string;
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
  resumedFromRunId?: string | null;
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

export function taskResultToExecutionResult(result: TaskResult, opts: {
  agent?: string;
  task?: string;
  parentId?: string;
  projectId?: string;
} = {}): ExecutionResult {
  const status = normalizeExecutionStatus("session", result.status);
  return {
    id: result.sessionId,
    kind: "session",
    status,
    summary: compact(result.error ?? result.lastAssistantText, `${opts.agent ?? "session"} ${status}`),
    traceId: result.sessionId,
    owner: opts.agent,
    parentId: opts.parentId,
    projectId: opts.projectId,
    evidence: {
      agent: opts.agent,
      task: opts.task,
      duration: result.duration,
      turnsUsed: result.turnsUsed,
      outputDir: result.outputDir,
    },
  };
}

export function workflowToolResultToExecutionResult(result: WorkflowToolResult): ExecutionResult | null {
  if (result.type === "list") return null;
  if (result.type === "error") {
    return {
      id: result.workflowRunId ?? result.workflow ?? "workflow-error",
      kind: "workflow",
      status: "error",
      summary: compact(result.error, "workflow error"),
      traceId: result.workflowRunId ?? result.workflow ?? "workflow-error",
      evidence: { workflow: result.workflow, reason: result.reason, category: result.category },
    };
  }

  if (result.type === "done") {
    return {
      id: result.workflowRunId,
      kind: "workflow",
      status: "done",
      summary: compact(result.summary, "workflow done"),
      traceId: result.workflowRunId,
      evidence: { workflow: result.workflow, steps: result.steps },
    };
  }

  if (result.type === "escalated") {
    return {
      id: result.workflowRunId,
      kind: "workflow",
      status: "blocked",
      summary: compact(result.reason, "workflow blocked"),
      traceId: result.workflowRunId,
      evidence: { workflow: result.workflow, context: result.context, steps: result.steps },
    };
  }

  if (result.type === "blocked") {
    return {
      id: result.workflowRunId,
      kind: "workflow",
      status: "blocked",
      summary: compact(result.reason, "workflow blocked"),
      traceId: result.workflowRunId,
      evidence: {
        workflow: result.workflow,
        context: result.context,
        steps: result.steps,
        completedSteps: result.completedSteps?.length ?? 0,
      },
    };
  }

  return {
    id: result.workflowRunId,
    kind: "workflow",
    status: "interrupted",
    summary: compact(result.steeringMessage, "workflow interrupted"),
    traceId: result.workflowRunId,
    evidence: { workflow: result.workflow, completedSteps: result.completedSteps.length },
  };
}

export function resumeDiagnosticToExecutionResult(diagnostic: ResumeDiagnostic): ExecutionResult {
  const status = diagnostic.status ?? (diagnostic.recoverable === false ? "error" : "interrupted");
  return {
    id: diagnostic.id,
    kind: diagnostic.kind,
    status,
    summary: compact(diagnostic.reason, `${diagnostic.kind} resume ${status}`),
    traceId: diagnostic.id,
    owner: optionalString(diagnostic.owner ?? diagnostic.agent),
    parentId: diagnostic.parentId,
    projectId: optionalString(diagnostic.projectId),
    evidence: {
      owner: diagnostic.owner,
      agent: diagnostic.agent,
      workflow: diagnostic.workflow,
      category: diagnostic.category,
      recoverable: diagnostic.recoverable,
      nextAction: diagnostic.nextAction,
    },
  };
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
    evidence: {
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
    evidence: {
      workflow: row.workflow,
      task: row.task,
      depth: row.depth,
      parentSessionId: row.parentSessionId,
      parentWorkflowRunId: row.parentWorkflowRunId,
      resumedFromRunId: row.resumedFromRunId,
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

export function getExecutionResult(persistDir: string, id: string): ExecutionResult | null {
  return getExecutionResultFromDb(getDb(persistDir), id);
}
