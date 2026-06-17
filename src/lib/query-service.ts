import type { SqliteDb } from "./db.js";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export interface QueryResult<Row extends Record<string, unknown> = Record<string, unknown>> {
  rows: Row[];
  rowCount: number;
  limit: number;
  truncated: boolean;
}

export interface QueryOptions {
  limit?: number;
}

export interface TimeFilter extends QueryOptions {
  since?: number;
  until?: number;
}

export interface SessionQuery extends TimeFilter {
  agent?: string;
  status?: string;
  kind?: string;
  source?: string;
  projectId?: string;
  parentSessionId?: string;
  workflowRunId?: string;
}

export interface EventQuery extends TimeFilter {
  type?: string;
  owner?: string;
  source?: string;
}

export interface MetricQuery extends QueryOptions {
  id?: string;
  owner?: string;
  status?: string;
  project?: string;
  priority?: string;
}

export interface AlertQuery extends TimeFilter {
  metricId?: string;
  resolved?: boolean;
}

export interface ProjectQuery extends QueryOptions {
  id?: string;
  owner?: string;
  status?: string;
  workflow?: string;
}

export interface WorkflowRunQuery extends TimeFilter {
  workflow?: string;
  status?: string;
  projectId?: string;
  parentSessionId?: string;
  parentWorkflowRunId?: string;
}

export interface MetricAlertContextQuery {
  metricId: string;
  alertId?: number | null;
  relatedEventTypes?: string[];
  since?: number;
  snapshotLimit?: number;
  eventLimit?: number;
}

export interface MetricAlertContext {
  alert: Record<string, unknown> | null;
  metric: Record<string, unknown> | null;
  snapshots: Record<string, unknown>[];
  relatedEvents: Record<string, unknown>[];
  metricId: string;
  alertId: number | null;
}

export interface MetricAlertReactorStateQuery {
  metricId: string;
  owner?: string;
  since?: number;
  alertId?: number | null;
}

export interface MetricAlertReactorState {
  metric: Record<string, unknown> | null;
  alert: Record<string, unknown> | null;
  latestJudgment: Record<string, unknown> | null;
  latestSnapshot: Record<string, unknown> | null;
  recentFeedbackRouted: Record<string, unknown> | null;
  recentTriageRun: Record<string, unknown> | null;
  recentTriageJudgment: Record<string, unknown> | null;
  recentOwnerSession: Record<string, unknown> | null;
  recentOwnerSessionJudgment: Record<string, unknown> | null;
  metricId: string;
  alertId: number | null;
}

export interface ClosedLoopStewardContextQuery {
  lookbackMs?: number;
  alertLimit?: number;
  deliveryFailureLimit?: number;
  now?: number;
}

export interface ClosedLoopStewardAlertContext {
  alert: Record<string, unknown>;
  latestJudgment: Record<string, unknown> | null;
  latestSnapshot: Record<string, unknown> | null;
  activeTriageRun: Record<string, unknown> | null;
}

export interface ClosedLoopStewardContext {
  now: number;
  schemaBrief: string[];
  runningStewardRun: Record<string, unknown> | null;
  alerts: ClosedLoopStewardAlertContext[];
  deliveryFailures: Record<string, unknown>[];
  recentStewardRuns: Record<string, unknown>[];
}

export interface HeartbeatContextQuery {
  agent: string;
  now?: number;
  inboxLookbackMs?: number;
  metricLimit?: number;
  metricSnapshotLimit?: number;
  alertLimit?: number;
  inboxLimit?: number;
}

export interface HeartbeatContext {
  now: number;
  metrics: Record<string, unknown>[];
  alerts: Record<string, unknown>[];
  inbox: Record<string, unknown>[];
}

export interface EvaluatorDeepEvalScanQuery {
  now?: number;
  backfillHours?: number;
  fallbackDelayMs?: number;
  activeWindowMs?: number;
}

export interface EvaluatorDeepEvalScanContext {
  now: number;
  activeDeepEval: boolean;
  candidate: Record<string, unknown> | null;
}

export interface EvaluatorAftermathContextQuery {
  sessionId: string;
}

export interface EvaluatorAftermathContext {
  sessionId: string;
  session: Record<string, unknown> | null;
  evaluation: Record<string, unknown> | null;
}

export interface QueryAPI {
  sessions(filter?: SessionQuery): QueryResult;
  events(filter?: EventQuery): QueryResult;
  metrics(filter?: MetricQuery): QueryResult;
  alerts(filter?: AlertQuery): QueryResult;
  projects(filter?: ProjectQuery): QueryResult;
  workflowRuns(filter?: WorkflowRunQuery): QueryResult;
  metricAlertContext(filter: MetricAlertContextQuery): MetricAlertContext;
  metricAlertReactorState(filter: MetricAlertReactorStateQuery): MetricAlertReactorState;
  closedLoopStewardContext(filter?: ClosedLoopStewardContextQuery): ClosedLoopStewardContext;
  heartbeatContext(filter: HeartbeatContextQuery): HeartbeatContext;
  evaluatorDeepEvalScan(filter?: EvaluatorDeepEvalScanQuery): EvaluatorDeepEvalScanContext;
  evaluatorAftermathContext(filter: EvaluatorAftermathContextQuery): EvaluatorAftermathContext;
  sql(sql: string, params?: unknown[], opts?: QueryOptions): QueryResult;

  /**
   * Mark inbox message events as handled after a heartbeat/session consumes them.
   * Transitions events from status='pending' to status='handled'.
   * Returns the number of rows updated.
   */
  markInboxHandled(eventIds: number[], handledBy?: string): number;

  /**
   * Expire stale pending message events older than the given age.
   * Transitions from status='pending' to status='expired'.
   * Returns the number of rows expired.
   */
  expireStaleMessages(olderThanMs: number): number;

  /**
   * Expire stale pending signal events (session.resume_failed, metric.breach,
   * metric.recovered) older than the given age.
   * These are non-actionable historical noise once their window passes.
   * Returns the number of rows expired.
   */
  expireStaleSignalEvents(olderThanMs: number): number;
}

export interface QueryServiceOptions {
  getDb: () => SqliteDb;
  defaultLimit?: number;
  maxLimit?: number;
}

function clampLimit(value: unknown, defaultLimit: number, maxLimit: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return defaultLimit;
  return Math.max(1, Math.min(maxLimit, Math.floor(value)));
}

function normalizeSql(input: string): string {
  let sql = input.trim();
  if (!sql) throw new Error("sql is required");
  if (sql.endsWith(";")) sql = sql.slice(0, -1).trim();
  if (sql.includes(";")) throw new Error("query.sql accepts one statement at a time");
  return sql;
}

function assertReadOnlySql(sql: string): void {
  const lower = sql.toLowerCase();
  const firstWord = lower.match(/^\s*([a-z]+)/)?.[1];

  if (firstWord === "pragma") {
    const pragma = lower.match(/^\s*pragma\s+([a-z_]+)/)?.[1] ?? "";
    const allowed = new Set([
      "database_list",
      "foreign_key_list",
      "index_info",
      "index_list",
      "integrity_check",
      "quick_check",
      "schema_version",
      "table_info",
      "table_list",
      "table_xinfo",
      "user_version",
    ]);
    if (!allowed.has(pragma) || lower.includes("=")) {
      throw new Error(`PRAGMA ${pragma || "<unknown>"} is not allowed by query.sql`);
    }
    return;
  }

  if (firstWord !== "select" && firstWord !== "with") {
    throw new Error("query.sql only allows SELECT, WITH, and read-only PRAGMA statements");
  }

  const writePattern =
    /\b(attach|alter|analyze|begin|commit|create|delete|detach|drop|insert|reindex|replace|rollback|update|vacuum)\b/i;
  if (writePattern.test(sql)) {
    throw new Error("query.sql is read-only; write or schema-changing statements are not allowed");
  }
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return `<blob:${value.byteLength}>`;
  return value;
}

function normalizeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) normalized[key] = normalizeValue(value);
    return normalized;
  });
}

function result(rows: Record<string, unknown>[], limit: number): QueryResult {
  const normalized = normalizeRows(rows);
  const truncated = normalized.length > limit;
  const visibleRows = truncated ? normalized.slice(0, limit) : normalized;
  return { rows: visibleRows, rowCount: visibleRows.length, limit, truncated };
}

function addEquals(where: string[], params: unknown[], column: string, value: unknown): void {
  if (value === undefined) return;
  where.push(`${column} = ?`);
  params.push(value);
}

function ownerForAgent(agent: string): string {
  const value = agent.trim();
  return value.startsWith("agent:") || value.startsWith("human:") ? value : `agent:${value}`;
}

function addSinceUntil(where: string[], params: unknown[], column: string, filter: TimeFilter): void {
  if (filter.since !== undefined) {
    where.push(`${column} >= ?`);
    params.push(filter.since);
  }
  if (filter.until !== undefined) {
    where.push(`${column} <= ?`);
    params.push(filter.until);
  }
}

function select(
  db: SqliteDb,
  table: string,
  where: string[],
  params: unknown[],
  orderBy: string,
  limit: number,
): QueryResult {
  const whereSql = where.length > 0 ? ` WHERE ${where.join(" AND ")}` : "";
  const rows = db.prepare(`SELECT * FROM ${table}${whereSql} ORDER BY ${orderBy} LIMIT ?`).all(...params, limit + 1);
  return result(rows, limit);
}

const CLOSED_LOOP_SCHEMA_TABLES = ["sessions", "events", "metrics", "metric_alerts"] as const;
const CLOSED_LOOP_DEFAULT_LOOKBACK_MS = 6 * 60 * 60_000;
const CLOSED_LOOP_DEFAULT_ALERT_LIMIT = 12;
const CLOSED_LOOP_DEFAULT_DELIVERY_FAILURE_LIMIT = 12;
const HEARTBEAT_DEFAULT_INBOX_LOOKBACK_MS = 2 * 60 * 60_000;
const HEARTBEAT_DEFAULT_METRIC_LIMIT = 200;
const HEARTBEAT_DEFAULT_METRIC_SNAPSHOT_LIMIT = 10;
const HEARTBEAT_DEFAULT_ALERT_LIMIT = 100;
const HEARTBEAT_DEFAULT_INBOX_LIMIT = 12;
const EVALUATOR_DEEP_EVAL_WORKFLOW = "evaluator-deep-eval";
const EVALUATOR_DEEP_EVAL_DEFAULT_BACKFILL_HOURS = 24;
const EVALUATOR_DEEP_EVAL_DEFAULT_FALLBACK_DELAY_MS = 15 * 60_000;
const EVALUATOR_DEEP_EVAL_DEFAULT_ACTIVE_WINDOW_MS = 30 * 60_000;

function formatSchemaRows(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "(schema unavailable)";
  return rows
    .map((row) => `${String(row.name ?? "")}${row.type ? ` ${String(row.type)}` : ""}`)
    .filter((part) => part.trim() !== "")
    .join(", ");
}

export function createQueryService(opts: QueryServiceOptions): QueryAPI {
  const defaultLimit = opts.defaultLimit ?? DEFAULT_LIMIT;
  const maxLimit = opts.maxLimit ?? MAX_LIMIT;

  return {
    sessions(filter = {}) {
      const where: string[] = [];
      const params: unknown[] = [];
      addEquals(where, params, "agent", filter.agent);
      addEquals(where, params, "status", filter.status);
      addEquals(where, params, "kind", filter.kind);
      addEquals(where, params, "source", filter.source);
      addEquals(where, params, "projectId", filter.projectId);
      addEquals(where, params, "parentSessionId", filter.parentSessionId);
      addEquals(where, params, "workflowRunId", filter.workflowRunId);
      addSinceUntil(where, params, "startedAt", filter);
      return select(opts.getDb(), "sessions", where, params, "startedAt DESC", clampLimit(filter.limit, defaultLimit, maxLimit));
    },

    events(filter = {}) {
      const where: string[] = [];
      const params: unknown[] = [];
      addEquals(where, params, "event_type", filter.type);
      addEquals(where, params, "owner", filter.owner);
      addEquals(where, params, "source", filter.source);
      addSinceUntil(where, params, "timestamp", filter);
      return select(opts.getDb(), "events", where, params, "timestamp DESC, id DESC", clampLimit(filter.limit, defaultLimit, maxLimit));
    },

    metrics(filter = {}) {
      const where: string[] = [];
      const params: unknown[] = [];
      addEquals(where, params, "id", filter.id);
      addEquals(where, params, "owner", filter.owner);
      addEquals(where, params, "status", filter.status);
      addEquals(where, params, "project", filter.project);
      addEquals(where, params, "priority", filter.priority);
      return select(opts.getDb(), "metrics", where, params, "updated_at DESC, id ASC", clampLimit(filter.limit, defaultLimit, maxLimit));
    },

    alerts(filter = {}) {
      const where: string[] = [];
      const params: unknown[] = [];
      addEquals(where, params, "metric_id", filter.metricId);
      if (filter.resolved === true) where.push("resolved_at IS NOT NULL");
      if (filter.resolved === false) where.push("resolved_at IS NULL");
      addSinceUntil(where, params, "created_at", filter);
      return select(opts.getDb(), "metric_alerts", where, params, "created_at DESC, id DESC", clampLimit(filter.limit, defaultLimit, maxLimit));
    },

    projects(filter = {}) {
      const where: string[] = [];
      const params: unknown[] = [];
      addEquals(where, params, "id", filter.id);
      addEquals(where, params, "owner", filter.owner);
      addEquals(where, params, "status", filter.status);
      addEquals(where, params, "workflow", filter.workflow);
      return select(opts.getDb(), "projects", where, params, "updated_at DESC, id ASC", clampLimit(filter.limit, defaultLimit, maxLimit));
    },

    workflowRuns(filter = {}) {
      const where: string[] = [];
      const params: unknown[] = [];
      addEquals(where, params, "workflow", filter.workflow);
      addEquals(where, params, "status", filter.status);
      addEquals(where, params, "projectId", filter.projectId);
      addEquals(where, params, "parentSessionId", filter.parentSessionId);
      addEquals(where, params, "parentWorkflowRunId", filter.parentWorkflowRunId);
      addSinceUntil(where, params, "startedAt", filter);
      return select(opts.getDb(), "workflow_runs", where, params, "startedAt DESC", clampLimit(filter.limit, defaultLimit, maxLimit));
    },

    heartbeatContext(filter) {
      if (!filter.agent) throw new Error("heartbeatContext requires agent");
      const db = opts.getDb();
      const now = typeof filter.now === "number" ? filter.now : Date.now();
      const metricLimit = clampLimit(filter.metricLimit, HEARTBEAT_DEFAULT_METRIC_LIMIT, maxLimit);
      const snapshotLimit = clampLimit(filter.metricSnapshotLimit, HEARTBEAT_DEFAULT_METRIC_SNAPSHOT_LIMIT, maxLimit);
      const alertLimit = clampLimit(filter.alertLimit, HEARTBEAT_DEFAULT_ALERT_LIMIT, maxLimit);
      const inboxLimit = clampLimit(filter.inboxLimit, HEARTBEAT_DEFAULT_INBOX_LIMIT, maxLimit);
      const inboxLookbackMs = typeof filter.inboxLookbackMs === "number"
        ? Math.max(1, filter.inboxLookbackMs)
        : HEARTBEAT_DEFAULT_INBOX_LOOKBACK_MS;

      const metricRows = normalizeRows(db.prepare(
        `SELECT m.id, m.name, m.owner as explicitOwner, p.owner as projectOwner,
                m.current, m.target, m.threshold, COALESCE(m.priority, 'P2') as priority,
                m.project, m.status, m.updated_at as updatedAt,
                m.alert_op as alertOp,
                m.source_query as sourceQuery,
                m.source_command as sourceCommand
         FROM metrics m
         LEFT JOIN projects p ON m.project IS NOT NULL AND trim(m.project) != ''
           AND (p.id = m.project OR p.path = m.project OR p.name = m.project)
         WHERE m.status = 'active'
         ORDER BY m.id ASC
         LIMIT ?`,
      ).all(metricLimit + 1) as Record<string, unknown>[]).slice(0, metricLimit);

      const metrics = metricRows.map((metric) => {
        const metricId = String(metric.id ?? "");
        const snapshots = normalizeRows(db.prepare(
          `SELECT value, sample_size as sampleSize, measured_at as measuredAt,
                  measured_by as measuredBy, note
           FROM metric_snapshots
           WHERE metric_id = ?
           ORDER BY measured_at DESC
           LIMIT ?`,
        ).all(metricId, snapshotLimit + 1) as Record<string, unknown>[]).slice(0, snapshotLimit);
        return { ...metric, snapshots };
      });

      const alerts = normalizeRows(db.prepare(
        `SELECT a.id, a.metric_id as metricId, a.message, a.created_at as createdAt,
                m.owner as explicitOwner, p.owner as projectOwner
         FROM metric_alerts a
         JOIN metrics m ON m.id = a.metric_id
         LEFT JOIN projects p ON m.project IS NOT NULL AND trim(m.project) != ''
           AND (p.id = m.project OR p.path = m.project OR p.name = m.project)
         WHERE a.resolved_at IS NULL
         ORDER BY a.created_at DESC, a.id DESC
         LIMIT ?`,
      ).all(alertLimit + 1) as Record<string, unknown>[]).slice(0, alertLimit);

      const inboxOwner = ownerForAgent(filter.agent);
      const inbox = normalizeRows(db.prepare(
        `SELECT id, event_type as eventType, data, urgency, timestamp
         FROM events
         WHERE owner = ?
           AND status = 'pending'
           AND timestamp > ?
           AND (ttl_ms IS NULL OR timestamp + ttl_ms > ?)
         ORDER BY CASE WHEN urgency = 'immediate' THEN 0 ELSE 1 END,
           timestamp DESC, id DESC
         LIMIT ?`,
      ).all(inboxOwner, now - inboxLookbackMs, now, inboxLimit + 1) as Record<string, unknown>[]).slice(0, inboxLimit);

      return { now, metrics, alerts, inbox };
    },

    evaluatorDeepEvalScan(filter = {}) {
      const db = opts.getDb();
      const now = typeof filter.now === "number" ? filter.now : Date.now();
      const backfillHours = typeof filter.backfillHours === "number"
        ? Math.max(0, filter.backfillHours)
        : EVALUATOR_DEEP_EVAL_DEFAULT_BACKFILL_HOURS;
      const fallbackDelayMs = typeof filter.fallbackDelayMs === "number"
        ? Math.max(0, filter.fallbackDelayMs)
        : EVALUATOR_DEEP_EVAL_DEFAULT_FALLBACK_DELAY_MS;
      const activeWindowMs = typeof filter.activeWindowMs === "number"
        ? Math.max(0, filter.activeWindowMs)
        : EVALUATOR_DEEP_EVAL_DEFAULT_ACTIVE_WINDOW_MS;

      const activeWorkflow = db.prepare(
        `SELECT 1
         FROM workflow_runs
         WHERE workflow = ?
           AND status = 'running'
           AND startedAt > ?
         LIMIT 1`,
      ).get(EVALUATOR_DEEP_EVAL_WORKFLOW, now - activeWindowMs);

      const activeSession = activeWorkflow ? null : db.prepare(
        `SELECT 1
         FROM sessions
         WHERE agent = 'evaluator'
           AND source IN ('eval-llm-scan', 'workflow:evaluator-deep-eval')
           AND status IN ('running', 'idle')
           AND startedAt > ?
         LIMIT 1`,
      ).get(now - activeWindowMs);

      const cutoff = now - backfillHours * 60 * 60_000;
      const fallbackCutoff = now - fallbackDelayMs;
      const candidate = db.prepare(
        `SELECT s.sessionId, s.agent, s.status, s.task, s.source, s.startedAt, s.endedAt, s.opCount,
                e.verdict as heuristicVerdict, e.issues as heuristicIssues
         FROM sessions s
         LEFT JOIN evaluations e ON e.sessionId = s.sessionId
         WHERE s.status IN ('done', 'error', 'interrupted')
           AND s.agent NOT IN ('evaluator', 'judge')
           AND COALESCE(s.source, '') NOT IN ('standalone-eval', 'eval-llm-scan', 'workflow:evaluator-deep-eval')
           AND COALESCE(s.endedAt, s.startedAt) >= ?
           AND COALESCE(s.endedAt, s.startedAt) <= ?
           AND NOT EXISTS (
             SELECT 1 FROM evaluations deep
             WHERE deep.sessionId = s.sessionId
               AND deep.evaluatedByHeuristic = 0
           )
         ORDER BY
           CASE WHEN e.verdict = 'good' THEN 0 WHEN e.verdict = 'needs_improvement' THEN 1 ELSE 2 END,
           COALESCE(s.opCount, 0) DESC,
           COALESCE(s.endedAt, s.startedAt) DESC
         LIMIT 1`,
      ).get(cutoff, fallbackCutoff) as Record<string, unknown> | null;

      return {
        now,
        activeDeepEval: !!(activeWorkflow || activeSession),
        candidate: candidate ? normalizeRows([candidate])[0] : null,
      };
    },

    evaluatorAftermathContext(filter) {
      if (!filter.sessionId) throw new Error("evaluatorAftermathContext requires sessionId");
      const db = opts.getDb();
      const session = db.prepare("SELECT * FROM sessions WHERE sessionId = ?").get(filter.sessionId) as Record<string, unknown> | null;
      const evaluation = db.prepare(
        "SELECT sessionId, verdict, overall, createdAt FROM evaluations WHERE sessionId = ?",
      ).get(filter.sessionId) as Record<string, unknown> | null;

      return {
        sessionId: filter.sessionId,
        session: session ? normalizeRows([session])[0] : null,
        evaluation: evaluation ? normalizeRows([evaluation])[0] : null,
      };
    },

    metricAlertContext(filter) {
      if (!filter.metricId) throw new Error("metricAlertContext requires metricId");
      const db = opts.getDb();
      const metricId = filter.metricId;
      const snapshotLimit = clampLimit(filter.snapshotLimit, 10, maxLimit);
      const eventLimit = clampLimit(filter.eventLimit, 20, maxLimit);
      const metric = db.prepare(
        `SELECT m.id, m.name, m.owner as explicitOwner, p.owner as projectOwner,
                m.current, m.threshold, m.target, COALESCE(m.priority, 'P2') as priority,
                m.project, m.status, m.updated_at, m.alert_op as alertOp
         FROM metrics m
         LEFT JOIN projects p ON m.project IS NOT NULL AND trim(m.project) != ''
           AND (p.id = m.project OR p.path = m.project OR p.name = m.project)
         WHERE m.id = ?`,
      ).get(metricId) as Record<string, unknown> | null;

      const alert = filter.alertId != null
        ? db.prepare("SELECT * FROM metric_alerts WHERE id = ?").get(filter.alertId)
        : db.prepare(
          `SELECT * FROM metric_alerts
           WHERE metric_id = ? AND resolved_at IS NULL
           ORDER BY created_at DESC, id DESC
           LIMIT 1`,
        ).get(metricId);
      const normalizedAlert = alert ? normalizeRows([alert as Record<string, unknown>])[0] : null;
      const createdAt = typeof normalizedAlert?.created_at === "number" ? normalizedAlert.created_at : null;
      const since = filter.since ?? createdAt ?? Date.now() - 24 * 60 * 60_000;

      const snapshots = normalizeRows(db.prepare(
        `SELECT value, sample_size, measured_at, measured_by, note
         FROM metric_snapshots
         WHERE metric_id = ?
         ORDER BY measured_at DESC
         LIMIT ?`,
      ).all(metricId, snapshotLimit + 1) as Record<string, unknown>[]).slice(0, snapshotLimit);

      const eventTypes = (filter.relatedEventTypes ?? []).filter((type) => type.trim() !== "");
      const relatedEvents = eventTypes.length > 0
        ? normalizeRows(db.prepare(
          `SELECT id, event_type, source, owner, timestamp, data
           FROM events
           WHERE timestamp >= ?
             AND event_type IN (${eventTypes.map(() => "?").join(", ")})
           ORDER BY timestamp DESC, id DESC
           LIMIT ?`,
        ).all(since, ...eventTypes, eventLimit + 1) as Record<string, unknown>[]).slice(0, eventLimit)
        : [];

      return {
        alert: normalizedAlert,
        metric: metric ? normalizeRows([metric as Record<string, unknown>])[0] : null,
        snapshots,
        relatedEvents,
        metricId,
        alertId: filter.alertId ?? (typeof normalizedAlert?.id === "number" ? normalizedAlert.id : null),
      };
    },

    metricAlertReactorState(filter) {
      if (!filter.metricId) throw new Error("metricAlertReactorState requires metricId");
      const db = opts.getDb();
      const metricId = filter.metricId;

      const metric = db.prepare(
        `SELECT m.id, m.name, m.owner as explicitOwner, p.owner as projectOwner,
                m.current, m.threshold, m.target, COALESCE(m.priority, 'P2') as priority,
                m.project, m.status, m.updated_at, m.alert_op as alertOp
         FROM metrics m
         LEFT JOIN projects p ON m.project IS NOT NULL AND trim(m.project) != ''
           AND (p.id = m.project OR p.path = m.project OR p.name = m.project)
         WHERE m.id = ?`,
      ).get(metricId) as Record<string, unknown> | null;

      const alert = filter.alertId != null
        ? db.prepare("SELECT * FROM metric_alerts WHERE id = ?").get(filter.alertId)
        : db.prepare(
          `SELECT * FROM metric_alerts
           WHERE metric_id = ? AND resolved_at IS NULL
           ORDER BY created_at DESC, id DESC
           LIMIT 1`,
        ).get(metricId);
      const normalizedAlert = alert ? normalizeRows([alert as Record<string, unknown>])[0] : null;
      const alertId = filter.alertId ?? (typeof normalizedAlert?.id === "number" ? normalizedAlert.id : null);
      const since = typeof filter.since === "number" ? filter.since : 0;

      const latestJudgment = db.prepare(
        `SELECT id, data, timestamp
         FROM events
         WHERE event_type = 'metric.alert_judged'
           AND (
             json_extract(data, '$.alertId') = ?
             OR json_extract(data, '$.metricId') = ?
           )
         ORDER BY timestamp DESC, id DESC
         LIMIT 1`,
      ).get(alertId, metricId) as Record<string, unknown> | null;

      const latestSnapshot = db.prepare(
        `SELECT value, sample_size, measured_at, measured_by, note
         FROM metric_snapshots
         WHERE metric_id = ?
         ORDER BY measured_at DESC
         LIMIT 1`,
      ).get(metricId) as Record<string, unknown> | null;

      const recentFeedbackRouted = db.prepare(
        `SELECT id, source, owner, data, timestamp
         FROM events
         WHERE event_type = 'metric.feedback.routed'
           AND timestamp >= ?
           AND (
             json_extract(data, '$.alertId') = ?
             OR json_extract(data, '$.metricId') = ?
           )
         ORDER BY timestamp DESC, id DESC
         LIMIT 1`,
      ).get(since, alertId, metricId) as Record<string, unknown> | null;

      const recentTriageRun = db.prepare(
        `SELECT runId, status, startedAt
         FROM workflow_runs
         WHERE workflow = 'metric-alert-triage'
           AND startedAt > ?
           AND task LIKE ?
         ORDER BY startedAt DESC
         LIMIT 1`,
      ).get(since, `%${metricId}%`) as Record<string, unknown> | null;

      const recentTriageJudgment = recentTriageRun
        ? db.prepare(
          `SELECT id
           FROM events
           WHERE event_type = 'metric.alert_judged'
             AND json_extract(data, '$.metricId') = ?
             AND timestamp >= ?
           ORDER BY timestamp DESC, id DESC
           LIMIT 1`,
        ).get(metricId, recentTriageRun.startedAt) as Record<string, unknown> | null
        : null;

      const recentOwnerSession = filter.owner
        ? db.prepare(
          `SELECT sessionId, status, startedAt
           FROM sessions
           WHERE agent = ?
             AND source = ?
             AND startedAt > ?
           ORDER BY startedAt DESC
           LIMIT 1`,
        ).get(filter.owner, `metric-alert-reactor:${metricId}`, since) as Record<string, unknown> | null
        : null;

      const recentOwnerSessionJudgment = recentOwnerSession
        ? db.prepare(
          `SELECT id
           FROM events
           WHERE event_type = 'metric.alert_judged'
             AND json_extract(data, '$.metricId') = ?
             AND timestamp >= ?
           ORDER BY timestamp DESC, id DESC
           LIMIT 1`,
        ).get(metricId, recentOwnerSession.startedAt) as Record<string, unknown> | null
        : null;

      return {
        metric: metric ? normalizeRows([metric])[0] : null,
        alert: normalizedAlert,
        latestJudgment: latestJudgment ? normalizeRows([latestJudgment])[0] : null,
        latestSnapshot: latestSnapshot ? normalizeRows([latestSnapshot])[0] : null,
        recentFeedbackRouted: recentFeedbackRouted ? normalizeRows([recentFeedbackRouted])[0] : null,
        recentTriageRun: recentTriageRun ? normalizeRows([recentTriageRun])[0] : null,
        recentTriageJudgment: recentTriageJudgment ? normalizeRows([recentTriageJudgment])[0] : null,
        recentOwnerSession: recentOwnerSession ? normalizeRows([recentOwnerSession])[0] : null,
        recentOwnerSessionJudgment: recentOwnerSessionJudgment ? normalizeRows([recentOwnerSessionJudgment])[0] : null,
        metricId,
        alertId,
      };
    },

    closedLoopStewardContext(filter = {}) {
      const db = opts.getDb();
      const now = typeof filter.now === "number" ? filter.now : Date.now();
      const lookbackMs = typeof filter.lookbackMs === "number" ? filter.lookbackMs : CLOSED_LOOP_DEFAULT_LOOKBACK_MS;
      const alertLimit = clampLimit(filter.alertLimit, CLOSED_LOOP_DEFAULT_ALERT_LIMIT, maxLimit);
      const deliveryFailureLimit = clampLimit(
        filter.deliveryFailureLimit,
        CLOSED_LOOP_DEFAULT_DELIVERY_FAILURE_LIMIT,
        maxLimit,
      );

      const schemaBrief = CLOSED_LOOP_SCHEMA_TABLES.map((table) => {
        const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Record<string, unknown>[];
        return `- ${table}: ${formatSchemaRows(rows)}`;
      });

      const runningStewardRun = db.prepare(
        `SELECT runId, status, startedAt, endedAt
         FROM workflow_runs
         WHERE workflow = 'closed-loop-steward' AND status = 'running'
         LIMIT 1`,
      ).get() as Record<string, unknown> | null;

      const alertRows = db.prepare(
        `SELECT ma.id, ma.metric_id, ma.message, ma.created_at,
                m.name as metricName, m.owner as explicitOwner, p.owner as projectOwner,
                m.current, m.threshold, m.target, COALESCE(m.priority, 'P2') as priority,
                m.alert_op as alertOp
         FROM metric_alerts ma
         LEFT JOIN metrics m ON m.id = ma.metric_id
         LEFT JOIN projects p ON m.project IS NOT NULL AND trim(m.project) != ''
           AND (p.id = m.project OR p.path = m.project OR p.name = m.project)
         WHERE ma.resolved_at IS NULL
         ORDER BY COALESCE(m.priority, 'P2') ASC, ma.created_at ASC
         LIMIT ?`,
      ).all(alertLimit) as Record<string, unknown>[];

      const alerts = alertRows.map((alert) => {
        const alertId = typeof alert.id === "number" ? alert.id : null;
        const metricId = String(alert.metric_id ?? "");
        const latestJudgment = db.prepare(
          `SELECT id, data, timestamp
           FROM events
           WHERE event_type = 'metric.alert_judged'
             AND (
               json_extract(data, '$.alertId') = ?
               OR json_extract(data, '$.metricId') = ?
             )
           ORDER BY timestamp DESC, id DESC
           LIMIT 1`,
        ).get(alertId, metricId) as Record<string, unknown> | null;
        const latestSnapshot = db.prepare(
          `SELECT value, measured_at
           FROM metric_snapshots
           WHERE metric_id = ?
           ORDER BY measured_at DESC
           LIMIT 1`,
        ).get(metricId) as Record<string, unknown> | null;
        const activeTriageRun = db.prepare(
          `SELECT runId, status, startedAt
           FROM workflow_runs
           WHERE workflow = 'metric-alert-triage'
             AND status = 'running'
             AND task LIKE ?
           LIMIT 1`,
        ).get(`%${metricId}%`) as Record<string, unknown> | null;

        return {
          alert: normalizeRows([alert])[0],
          latestJudgment: latestJudgment ? normalizeRows([latestJudgment])[0] : null,
          latestSnapshot: latestSnapshot ? normalizeRows([latestSnapshot])[0] : null,
          activeTriageRun: activeTriageRun ? normalizeRows([activeTriageRun])[0] : null,
        };
      });

      const deliveryFailures = db.prepare(
        `SELECT id, source, owner, data, timestamp
         FROM events
         WHERE event_type = 'message.delivery_failed' AND timestamp >= ?
         ORDER BY timestamp DESC, id DESC
         LIMIT ?`,
      ).all(now - lookbackMs, deliveryFailureLimit) as Record<string, unknown>[];

      const recentStewardRuns = db.prepare(
        `SELECT runId, status, startedAt, endedAt
         FROM workflow_runs
         WHERE workflow = 'closed-loop-steward'
         ORDER BY startedAt DESC
         LIMIT 3`,
      ).all() as Record<string, unknown>[];

      return {
        now,
        schemaBrief,
        runningStewardRun: runningStewardRun ? normalizeRows([runningStewardRun])[0] : null,
        alerts,
        deliveryFailures: normalizeRows(deliveryFailures),
        recentStewardRuns: normalizeRows(recentStewardRuns),
      };
    },

    sql(input, params = [], queryOpts = {}) {
      const sql = normalizeSql(input);
      assertReadOnlySql(sql);
      const limit = clampLimit(queryOpts.limit, defaultLimit, maxLimit);
      const db = opts.getDb();
      const isPragma = /^\s*pragma\b/i.test(sql);
      const statement = db.prepare(isPragma ? sql : `SELECT * FROM (${sql}) LIMIT ?`);
      const rows = statement.all(...(isPragma ? params : [...params, limit + 1]));
      return result(rows, limit);
    },

    markInboxHandled(eventIds, handledBy) {
      if (!eventIds.length) return 0;
      const db = opts.getDb();
      const now = Date.now();
      const agent = handledBy ?? "system";
      let updated = 0;
      // Use individual updates to avoid SQL injection from dynamic IN clauses
      const stmt = db.prepare(
        `UPDATE events SET status = 'handled', handled_by = ?, result = 'consumed'
         WHERE id = ? AND status = 'pending'`,
      );
      for (const id of eventIds) {
        const info = stmt.run(agent, id) as { changes?: number };
        updated += info.changes ?? 0;
      }
      return updated;
    },

    expireStaleMessages(olderThanMs) {
      const db = opts.getDb();
      const cutoff = Date.now() - olderThanMs;
      const info = db.prepare(
        `UPDATE events SET status = 'expired', reason = 'stale'
         WHERE status = 'pending'
           AND event_type = 'message.created'
           AND timestamp < ?`,
      ).run(cutoff) as { changes?: number };
      return info.changes ?? 0;
    },

    expireStaleSignalEvents(olderThanMs) {
      const db = opts.getDb();
      const cutoff = Date.now() - olderThanMs;
      const signalTypes = [
        'session.resume_failed',
        'metric.breach',
        'metric.recovered',
        'metric.stalled',
        'handler.failed',
        'agent.config_invalid',
      ];
      const placeholders = signalTypes.map(() => '?').join(', ');
      const info = db.prepare(
        `UPDATE events SET status = 'expired', reason = 'stale_signal'
         WHERE status = 'pending'
           AND event_type IN (${placeholders})
           AND timestamp < ?`,
      ).run(...signalTypes, cutoff) as { changes?: number };
      return info.changes ?? 0;
    },
  };
}

export function createUnavailableQueryService(reason: string): QueryAPI {
  const fail = (): QueryResult => {
    throw new Error(reason);
  };
  const failContext = (): MetricAlertContext => {
    throw new Error(reason);
  };
  const failReactorState = (): MetricAlertReactorState => {
    throw new Error(reason);
  };
  const failClosedLoopStewardContext = (): ClosedLoopStewardContext => {
    throw new Error(reason);
  };
  const failHeartbeatContext = (): HeartbeatContext => {
    throw new Error(reason);
  };
  const failEvaluatorDeepEvalScan = (): EvaluatorDeepEvalScanContext => {
    throw new Error(reason);
  };
  const failEvaluatorAftermathContext = (): EvaluatorAftermathContext => {
    throw new Error(reason);
  };
  return {
    sessions: fail,
    events: fail,
    metrics: fail,
    alerts: fail,
    projects: fail,
    workflowRuns: fail,
    metricAlertContext: failContext,
    metricAlertReactorState: failReactorState,
    closedLoopStewardContext: failClosedLoopStewardContext,
    heartbeatContext: failHeartbeatContext,
    evaluatorDeepEvalScan: failEvaluatorDeepEvalScan,
    evaluatorAftermathContext: failEvaluatorAftermathContext,
    sql: fail,
    markInboxHandled: () => { throw new Error(reason); },
    expireStaleMessages: () => { throw new Error(reason); },
    expireStaleSignalEvents: () => { throw new Error(reason); },
  };
}
