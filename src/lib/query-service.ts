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

export interface QueryAPI {
  sessions(filter?: SessionQuery): QueryResult;
  events(filter?: EventQuery): QueryResult;
  metrics(filter?: MetricQuery): QueryResult;
  alerts(filter?: AlertQuery): QueryResult;
  projects(filter?: ProjectQuery): QueryResult;
  metricAlertContext(filter: MetricAlertContextQuery): MetricAlertContext;
  sql(sql: string, params?: unknown[], opts?: QueryOptions): QueryResult;
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
  };
}

export function createUnavailableQueryService(reason: string): QueryAPI {
  const fail = (): QueryResult => {
    throw new Error(reason);
  };
  const failContext = (): MetricAlertContext => {
    throw new Error(reason);
  };
  return {
    sessions: fail,
    events: fail,
    metrics: fail,
    alerts: fail,
    projects: fail,
    metricAlertContext: failContext,
    sql: fail,
  };
}
