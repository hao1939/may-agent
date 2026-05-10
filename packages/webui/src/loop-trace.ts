import type { SqliteDb } from "./state-db.js";

export type LoopTraceTarget =
  | { eventId: number }
  | { alertId: number }
  | { metricId: string }
  | { workflowRunId: string }
  | { sessionId: string };

type Row = Record<string, unknown>;
const FAILOVER_EVENT_TYPES = new Set([
  "workflow.resume_failed",
  "workflow.resume_skipped",
  "session.resume_failed",
  "message.delivery_failed",
]);

export interface LoopTrace {
  target: { kind: "event" | "alert" | "metric" | "workflow" | "session"; id: string | number };
  origin: Row | null;
  owner: string | null;
  projectId: string | null;
  metricId: string | null;
  alertId: number | null;
  handler: { name: string | null; status: string | null; reason: string | null };
  workflows: Row[];
  sessions: Row[];
  guardSignals: Row[];
  metricEvents: Row[];
  failoverEvents: Row[];
  metricSnapshots: Row[];
  executions: LoopTraceExecution[];
  evidence: {
    workflowCount: number;
    sessionCount: number;
    guardSignalCount: number;
    metricEventCount: number;
    failoverCount: number;
  };
}

export interface LoopTraceExecution {
  id: string;
  kind: "session" | "workflow";
  status: string;
  summary: string;
  traceId: string;
  owner: string | null;
  projectId: string | null;
  evidence: Record<string, unknown>;
}

function parseData(row: Row | null | undefined): Record<string, unknown> {
  const raw = row?.data;
  if (typeof raw !== "string" || raw.trim() === "") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  return null;
}

function uniqBy<T extends Row>(rows: T[], key: string): T[] {
  const seen = new Set<unknown>();
  const out: T[] = [];
  for (const row of rows) {
    const id = row[key];
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

function safeAll(db: SqliteDb, sql: string, ...params: unknown[]): Row[] {
  try {
    return db.prepare(sql).all(...params);
  } catch {
    return [];
  }
}

function safeGet(db: SqliteDb, sql: string, ...params: unknown[]): Row | null {
  try {
    return db.prepare(sql).get(...params);
  } catch {
    return null;
  }
}

function placeholders(values: unknown[]): string {
  return values.map(() => "?").join(",");
}

function targetKind(target: LoopTraceTarget): LoopTrace["target"] {
  if ("eventId" in target) return { kind: "event", id: target.eventId };
  if ("alertId" in target) return { kind: "alert", id: target.alertId };
  if ("metricId" in target) return { kind: "metric", id: target.metricId };
  if ("workflowRunId" in target) return { kind: "workflow", id: target.workflowRunId };
  return { kind: "session", id: target.sessionId };
}

function compact(text: unknown, fallback: string): string {
  const value = typeof text === "string" ? text.trim() : "";
  if (!value) return fallback;
  return value.length > 180 ? `${value.slice(0, 177)}...` : value;
}

function sessionExecution(row: Row): LoopTraceExecution | null {
  const id = stringValue(row.sessionId);
  if (!id) return null;
  const status = stringValue(row.status) ?? "running";
  const agent = stringValue(row.agent);
  return {
    id,
    kind: "session",
    status,
    summary: compact(row.error ?? row.outcome ?? row.task, `${agent ?? "session"} ${status}`),
    traceId: stringValue(row.workflowRunId) ?? id,
    owner: agent,
    projectId: stringValue(row.projectId),
    evidence: {
      agent,
      source: row.source,
      kind: row.kind,
      workflowRunId: row.workflowRunId,
      opCount: row.opCount,
    },
  };
}

function workflowExecution(row: Row): LoopTraceExecution | null {
  const id = stringValue(row.runId);
  if (!id) return null;
  const status = stringValue(row.status) ?? "running";
  const workflow = stringValue(row.workflow);
  return {
    id,
    kind: "workflow",
    status,
    summary: compact(row.result_summary ?? row.result_reason ?? row.task, `${workflow ?? "workflow"} ${status}`),
    traceId: id,
    owner: null,
    projectId: stringValue(row.projectId),
    evidence: {
      workflow,
      depth: row.depth,
      parentSessionId: row.parentSessionId,
      parentWorkflowRunId: row.parentWorkflowRunId,
      resumedFromRunId: row.resumedFromRunId,
    },
  };
}

function failoverExecution(row: Row): LoopTraceExecution | null {
  const data = parseData(row);
  const eventType = stringValue(row.event_type);
  if (!eventType) return null;
  const sessionId = stringValue(data.sessionId);
  const workflowRunId = stringValue(data.workflowRunId);
  const kind = sessionId ? "session" : workflowRunId ? "workflow" : null;
  const id = sessionId ?? workflowRunId;
  if (!kind || !id) return null;
  const owner = stringValue(row.owner ?? data.owner ?? data.agent);
  const status = data.recoverable === false ? "error" : "interrupted";
  return {
    id,
    kind,
    status,
    summary: compact(data.reason ?? data.message ?? data.category ?? eventType, `${kind} resume failed`),
    traceId: id,
    owner,
    projectId: stringValue(data.projectId),
    evidence: {
      eventType,
      category: data.category,
      recoverable: data.recoverable,
      agent: data.agent,
      workflow: data.workflow,
    },
  };
}

function buildExecutions(workflows: Row[], sessions: Row[], failovers: Row[]): LoopTraceExecution[] {
  const executions: LoopTraceExecution[] = [];
  for (const row of failovers) {
    const execution = failoverExecution(row);
    if (execution) executions.push(execution);
  }
  for (const row of workflows) {
    const execution = workflowExecution(row);
    if (execution) executions.push(execution);
  }
  for (const row of sessions) {
    const execution = sessionExecution(row);
    if (execution) executions.push(execution);
  }
  return uniqBy(executions as unknown as Row[], "id") as unknown as LoopTraceExecution[];
}

function resolveSeeds(db: SqliteDb, target: LoopTraceTarget): {
  origin: Row | null;
  metricId: string | null;
  alertId: number | null;
  workflowRunId: string | null;
  sessionId: string | null;
  owner: string | null;
  projectId: string | null;
  handlerName: string | null;
  handlerStatus: string | null;
  handlerReason: string | null;
} {
  let origin: Row | null = null;
  let metricId: string | null = null;
  let alertId: number | null = null;
  let workflowRunId: string | null = null;
  let sessionId: string | null = null;
  let owner: string | null = null;
  let projectId: string | null = null;
  let handlerName: string | null = null;
  let handlerStatus: string | null = null;
  let handlerReason: string | null = null;

  if ("eventId" in target) {
    origin = safeGet(db, "SELECT * FROM events WHERE id = ?", target.eventId);
    const data = parseData(origin);
    metricId = stringValue(data.metricId ?? data.metric_id ?? data.metric);
    alertId = numberValue(data.alertId ?? data.alert_id);
    workflowRunId = stringValue(data.workflowRunId ?? data.runId);
    sessionId = stringValue(data.sessionId);
    owner = stringValue(origin?.owner ?? data.owner);
    projectId = stringValue(data.projectId);
    handlerName = stringValue(data.entry ?? data.handler ?? origin?.source);
    handlerStatus = stringValue(data.status);
    handlerReason = stringValue(data.reason ?? data.message);
  } else if ("alertId" in target) {
    alertId = target.alertId;
  } else if ("metricId" in target) {
    metricId = target.metricId;
  } else if ("workflowRunId" in target) {
    workflowRunId = target.workflowRunId;
  } else {
    sessionId = target.sessionId;
  }

  if (alertId != null) {
    const alert = safeGet(
      db,
      `SELECT ma.id, ma.metric_id, ma.message, ma.created_at, ma.resolved_at,
              m.owner, m.project, m.priority
       FROM metric_alerts ma
       LEFT JOIN metrics m ON m.id = ma.metric_id
       WHERE ma.id = ?`,
      alertId,
    );
    if (alert) {
      origin ??= { ...alert, event_type: "metric_alert" };
      metricId ??= stringValue(alert.metric_id);
      owner ??= stringValue(alert.owner);
      projectId ??= stringValue(alert.project);
      handlerReason ??= stringValue(alert.message);
    }
  }

  if (metricId) {
    const metric = safeGet(db, "SELECT id, owner, project FROM metrics WHERE id = ?", metricId);
    if (metric) {
      owner ??= stringValue(metric.owner);
      projectId ??= stringValue(metric.project);
    }
  }

  if (workflowRunId) {
    const run = safeGet(db, "SELECT runId, workflow, status, projectId, parentSessionId, parentWorkflowRunId FROM workflow_runs WHERE runId = ?", workflowRunId);
    if (run) {
      projectId ??= stringValue(run.projectId);
      handlerName ??= stringValue(run.workflow);
      handlerStatus ??= stringValue(run.status);
    }
  }

  if (sessionId) {
    const session = safeGet(db, "SELECT sessionId, agent, status, source, workflowRunId, projectId FROM sessions WHERE sessionId = ?", sessionId);
    if (session) {
      owner ??= stringValue(session.agent);
      projectId ??= stringValue(session.projectId);
      workflowRunId ??= stringValue(session.workflowRunId);
      handlerName ??= stringValue(session.source);
      handlerStatus ??= stringValue(session.status);
    }
  }

  return { origin, metricId, alertId, workflowRunId, sessionId, owner, projectId, handlerName, handlerStatus, handlerReason };
}

export function buildLoopTrace(db: SqliteDb, target: LoopTraceTarget): LoopTrace {
  const seed = resolveSeeds(db, target);
  const metricId = seed.metricId;
  const alertId = seed.alertId;

  const workflows: Row[] = [];
  if (seed.workflowRunId) {
    workflows.push(...safeAll(db, "SELECT * FROM workflow_runs WHERE runId = ?", seed.workflowRunId));
  }
  if (metricId) {
    workflows.push(...safeAll(db, "SELECT * FROM workflow_runs WHERE task LIKE ? ORDER BY startedAt DESC LIMIT 20", `%${metricId}%`));
  }
  if (seed.projectId) {
    workflows.push(...safeAll(db, "SELECT * FROM workflow_runs WHERE projectId = ? ORDER BY startedAt DESC LIMIT 20", seed.projectId));
  }
  const uniqueWorkflows = uniqBy(workflows, "runId");
  const workflowIds = uniqueWorkflows.map((row) => row.runId).filter((id): id is string => typeof id === "string");

  const sessions: Row[] = [];
  if (seed.sessionId) {
    sessions.push(...safeAll(db, "SELECT * FROM sessions WHERE sessionId = ?", seed.sessionId));
    sessions.push(...safeAll(db, "SELECT * FROM sessions WHERE parentSessionId = ? ORDER BY startedAt ASC LIMIT 50", seed.sessionId));
  }
  if (workflowIds.length > 0) {
    sessions.push(...safeAll(db, `SELECT * FROM sessions WHERE workflowRunId IN (${placeholders(workflowIds)}) ORDER BY startedAt ASC LIMIT 100`, ...workflowIds));
  }
  if (metricId) {
    sessions.push(...safeAll(db, "SELECT * FROM sessions WHERE task LIKE ? OR source LIKE ? ORDER BY startedAt DESC LIMIT 50", `%${metricId}%`, `%${metricId}%`));
  }
  if (seed.projectId) {
    sessions.push(...safeAll(db, "SELECT * FROM sessions WHERE projectId = ? ORDER BY startedAt DESC LIMIT 50", seed.projectId));
  }
  const uniqueSessions = uniqBy(sessions, "sessionId");
  const sessionIds = uniqueSessions.map((row) => row.sessionId).filter((id): id is string => typeof id === "string");

  const guardSignals: Row[] = [];
  if (workflowIds.length > 0) {
    guardSignals.push(...safeAll(db, `SELECT * FROM events WHERE event_type = 'guard.triggered' AND json_extract(data, '$.workflowRunId') IN (${placeholders(workflowIds)}) ORDER BY timestamp DESC LIMIT 50`, ...workflowIds));
  }
  if (sessionIds.length > 0) {
    guardSignals.push(...safeAll(db, `SELECT * FROM events WHERE event_type = 'guard.triggered' AND json_extract(data, '$.sessionId') IN (${placeholders(sessionIds)}) ORDER BY timestamp DESC LIMIT 50`, ...sessionIds));
  }

  const metricEvents = metricId
    ? safeAll(
        db,
        `SELECT * FROM events
         WHERE json_extract(data, '$.metricId') = ?
            OR json_extract(data, '$.metric') = ?
            OR json_extract(data, '$.metric_id') = ?
         ORDER BY timestamp DESC LIMIT 80`,
        metricId,
        metricId,
        metricId,
      )
    : [];

  const failoverEvents: Row[] = [];
  if (typeof seed.origin?.event_type === "string" && FAILOVER_EVENT_TYPES.has(seed.origin.event_type)) {
    failoverEvents.push(seed.origin);
  }
  failoverEvents.push(...safeAll(
    db,
    `SELECT * FROM events
     WHERE event_type IN ('workflow.resume_failed', 'workflow.resume_skipped', 'session.resume_failed', 'message.delivery_failed')
       AND (
         (? IS NOT NULL AND json_extract(data, '$.workflowRunId') = ?)
         OR (? IS NOT NULL AND json_extract(data, '$.sessionId') = ?)
         OR (? IS NOT NULL AND json_extract(data, '$.metricId') = ?)
       )
     ORDER BY timestamp DESC LIMIT 50`,
    seed.workflowRunId,
    seed.workflowRunId,
    seed.sessionId,
    seed.sessionId,
    metricId,
    metricId,
  ));
  const uniqueFailoverEvents = uniqBy(failoverEvents, "id");

  const metricSnapshots = metricId
    ? safeAll(db, "SELECT * FROM metric_snapshots WHERE metric_id = ? ORDER BY measured_at DESC LIMIT 20", metricId)
    : [];
  const executions = buildExecutions(uniqueWorkflows, uniqueSessions, uniqueFailoverEvents);

  return {
    target: targetKind(target),
    origin: seed.origin,
    owner: seed.owner,
    projectId: seed.projectId,
    metricId,
    alertId,
    handler: { name: seed.handlerName, status: seed.handlerStatus, reason: seed.handlerReason },
    workflows: uniqueWorkflows,
    sessions: uniqueSessions,
    guardSignals,
    metricEvents,
    failoverEvents: uniqueFailoverEvents,
    metricSnapshots,
    executions,
    evidence: {
      workflowCount: uniqueWorkflows.length,
      sessionCount: uniqueSessions.length,
      guardSignalCount: guardSignals.length,
      metricEventCount: metricEvents.length,
      failoverCount: uniqueFailoverEvents.length,
    },
  };
}
