import type { SqliteDb } from "./db.js";
import { normalizeEventOwner } from "../../packages/control/src/event-envelope.js";

export type MetricType = "gauge" | "counter" | "health" | "derived";
export type MetricPriority = "P0" | "P1" | "P2" | "P3";
export type MetricAlertOp = "<" | ">" | "above" | "below";

export interface MetricDefinition {
  id: string;
  name?: string;
  owner?: string;
  type?: MetricType;
  target?: number;
  threshold?: number;
  unit?: string;
  priority?: MetricPriority;
  status?: "active" | "retired" | string;
  blocker?: string;
  project?: string;
  source?: string;
  sourceQuery?: string;
  sourceCommand?: string;
  sensitivity?: number;
  measureInterval?: number;
  alertOp?: MetricAlertOp;
  speed?: string;
  description?: string;
  direction?: string;
  config?: Record<string, unknown>;
}

export interface MetricRecordOptions {
  sampleSize?: number;
  note?: string;
  measuredBy?: string;
  measuredAt?: number;
}

export interface ManualAlertOptions {
  priority?: MetricPriority;
  alertType?: string;
  evidence?: string;
}

export interface MetricFilter {
  owner?: string;
  project?: string;
  status?: string;
}

export interface Metric {
  id: string;
  name: string | null;
  owner: string | null;
  type: string | null;
  current: number | null;
  target: number | null;
  threshold: number | null;
  unit: string | null;
  priority: string | null;
  status: string | null;
  project: string | null;
  alert_op: string | null;
  config?: string | null;
}

export interface MetricEvaluationResult {
  metricId: string;
  status: "breached" | "recovered" | "ok" | "stalled";
  alertId?: number;
  message?: string;
}

export interface MetricServiceOptions {
  getDb: () => SqliteDb;
  emit?: (
    type: string,
    data?: Record<string, unknown>,
    envelope?: {
      owner?: string;
      source?: string;
      target?: Record<string, unknown>;
      urgency?: "low" | "normal" | "high" | "immediate";
      ttl_ms?: number;
    },
  ) => void;
  measuredBy?: string;
  now?: () => number;
  log?: (message: string) => void;
  resolveOwner?: (metric: {
    id: string;
    explicitOwner?: string | null;
    projectOwner?: string | null;
    project?: string | null;
  }) => string;
}

export interface MetricService {
  define(def: MetricDefinition): void;
  defineMany(defs: MetricDefinition[]): void;
  record(id: string, value: number, opts?: MetricRecordOptions): void;
  evaluate(id?: string): MetricEvaluationResult[];
  alert(id: string, message: string, opts?: ManualAlertOptions): void;
  resolveAlert(alertId: number, reason?: string): void;
  get(id: string): Metric | null;
  list(filter?: MetricFilter): Metric[];
}

const AGENT_OWNER_PREFIX_BLACKLIST = new Set([
  "agent",
  "capability",
  "handler",
  "infra",
  "message",
  "project",
  "session",
  "system",
  "v2",
]);

function hasColumn(db: SqliteDb, table: string, column: string): boolean {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name?: string }>).some((c) => c.name === column);
}

function hasTable(db: SqliteDb, table: string): boolean {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseConfig(raw: unknown): Record<string, any> | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function defaultOwnerForMetric(
  db: SqliteDb,
  metric: { id: string; explicitOwner?: string | null; projectOwner?: string | null; project?: string | null },
): string {
  const explicit = metric.explicitOwner?.trim();
  if (explicit) return explicit;
  if (metric.project?.trim()) return `project:${metric.project.trim()}`;
  const projectOwner = metric.projectOwner?.trim();
  if (projectOwner) return projectOwner;
  if (metric.project && hasTable(db, "projects")) {
    try {
      const row = db
        .prepare(`SELECT owner FROM projects WHERE id = ? OR path = ? OR name = ? LIMIT 1`)
        .get(metric.project, metric.project, metric.project) as { owner?: string | null } | null;
      if (row?.owner?.trim()) return row.owner.trim();
    } catch {
      // Fall through to metric-id convention.
    }
  }
  const prefix = metric.id.split(".")[0]?.trim();
  if (prefix && !AGENT_OWNER_PREFIX_BLACKLIST.has(prefix)) return prefix;
  return "may";
}

function toDbDefinition(def: MetricDefinition, owner: string, now: number): Record<string, unknown> {
  return {
    id: def.id,
    name: def.name ?? def.id,
    type: def.type ?? "gauge",
    owner,
    target: def.target ?? null,
    threshold: def.threshold ?? null,
    unit: def.unit ?? "",
    priority: def.priority ?? "P2",
    status: def.status ?? "active",
    blocker: def.blocker ?? null,
    project: def.project ?? null,
    source: def.source ?? null,
    source_query: def.sourceQuery ?? null,
    source_command: def.sourceCommand ?? null,
    sensitivity: def.sensitivity ?? null,
    measure_interval: def.measureInterval ?? null,
    alert_op: def.alertOp ?? "<",
    speed: def.speed ?? "fast",
    description: def.description ?? null,
    direction: def.direction ?? null,
    config: def.config ? JSON.stringify(def.config) : null,
    created_at: now,
    updated_at: now,
  };
}

function evaluateThreshold(metric: { current: number; threshold: number; alert_op?: string | null }): boolean {
  return metric.alert_op === ">" || metric.alert_op === "above"
    ? metric.current > metric.threshold
    : metric.current < metric.threshold;
}

function latestAlertId(db: SqliteDb, metricId: string): number | undefined {
  const row = db
    .prepare("SELECT id FROM metric_alerts WHERE metric_id = ? AND resolved_at IS NULL LIMIT 1")
    .get(metricId) as { id?: number } | null;
  return typeof row?.id === "number" ? row.id : undefined;
}

function recentTrend(db: SqliteDb, metricId: string): Array<{ value: number; measuredAt: number }> {
  try {
    return (
      db
        .prepare(
          `SELECT value, measured_at
       FROM metric_snapshots
       WHERE metric_id = ?
       ORDER BY measured_at DESC
       LIMIT 5`,
        )
        .all(metricId) as Array<{ value: number; measured_at: number }>
    ).map((row) => ({
      value: row.value,
      measuredAt: row.measured_at,
    }));
  } catch {
    return [];
  }
}

function urgencyForPriority(priority: unknown): "low" | "normal" | "high" | "immediate" {
  if (priority === "P0") return "immediate";
  if (priority === "P1") return "high";
  if (priority === "P3") return "low";
  return "normal";
}

export function createMetricService(options: MetricServiceOptions): MetricService {
  const now = () => options.now?.() ?? Date.now();
  const emit = (
    type: string,
    data?: Record<string, unknown>,
    envelope?: {
      owner?: string;
      source?: string;
      target?: Record<string, unknown>;
      urgency?: "low" | "normal" | "high" | "immediate";
      ttl_ms?: number;
    },
  ) => options.emit?.(type, data, envelope);
  const emitMetricEvent = (type: string, owner: string, data: Record<string, unknown>) => {
    const project = typeof data.project === "string" && data.project.trim() ? data.project.trim() : "";
    emit(type, data, {
      owner: normalizeEventOwner(owner),
      source: options.measuredBy ?? "metrics",
      ...(project ? { target: { project } } : {}),
      urgency: urgencyForPriority(data.priority),
    });
  };

  function resolveOwner(row: {
    id: string;
    explicitOwner?: string | null;
    projectOwner?: string | null;
    project?: string | null;
  }): string {
    if (options.resolveOwner) return options.resolveOwner(row);
    return defaultOwnerForMetric(options.getDb(), row);
  }

  function define(def: MetricDefinition): void {
    if (!def.id?.trim()) throw new Error("metric id is required");
    const db = options.getDb();
    const ts = now();
    const owner = defaultOwnerForMetric(db, {
      id: def.id,
      explicitOwner: def.owner ?? null,
      project: def.project ?? null,
    });
    const values = toDbDefinition(def, owner, ts);
    const metricColumns = new Set(
      (db.prepare("PRAGMA table_info(metrics)").all() as Array<{ name?: string }>).map((c) => c.name),
    );
    const insertColumns = Object.keys(values).filter((key) => metricColumns.has(key));
    const insertValues = insertColumns.map((key) => values[key]);
    db.run(
      `INSERT OR IGNORE INTO metrics (${insertColumns.join(", ")}) VALUES (${insertColumns.map(() => "?").join(", ")})`,
      insertValues,
    );

    const updateColumns = insertColumns.filter((key) => key !== "id" && key !== "created_at");
    const updateValues = updateColumns.map((key) => values[key]);
    updateValues.push(def.id);
    db.run(`UPDATE metrics SET ${updateColumns.map((key) => `${key} = ?`).join(", ")} WHERE id = ?`, updateValues);
  }

  function record(id: string, value: number, opts?: MetricRecordOptions): void {
    if (!Number.isFinite(value)) throw new Error(`metric value must be finite: ${id}`);
    const db = options.getDb();
    const measuredAt = opts?.measuredAt ?? now();
    const measuredBy = opts?.measuredBy ?? options.measuredBy ?? "metric-service";
    db.run("UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?", [value, measuredAt, id]);
    if (opts?.sampleSize != null || opts?.note != null) {
      db.run(
        "INSERT INTO metric_snapshots (metric_id, value, sample_size, measured_at, measured_by, note) VALUES (?, ?, ?, ?, ?, ?)",
        [id, value, opts?.sampleSize ?? null, measuredAt, measuredBy, opts?.note ?? null],
      );
    } else {
      db.run("INSERT INTO metric_snapshots (metric_id, value, measured_at, measured_by) VALUES (?, ?, ?, ?)", [
        id,
        value,
        measuredAt,
        measuredBy,
      ]);
    }
  }

  function evaluate(id?: string): MetricEvaluationResult[] {
    const db = options.getDb();
    const ts = now();
    const configSelect = hasColumn(db, "metrics", "config") ? ", m.config" : "";
    const rows = db
      .prepare(
        `SELECT m.id, m.name,
              m.owner as explicitOwner, p.owner as projectOwner, m.project,
              m.current, m.target, m.threshold, m.alert_op, m.type,
              COALESCE(m.priority, 'P2') as priority${configSelect}
       FROM metrics m
       LEFT JOIN projects p ON m.project IS NOT NULL AND trim(m.project) != ''
         AND (p.id = m.project OR p.path = m.project OR p.name = m.project)
       WHERE m.status = 'active'
         AND m.current IS NOT NULL
         AND m.threshold IS NOT NULL
         ${id ? "AND m.id = ?" : ""}`,
      )
      .all(...(id ? [id] : [])) as Array<Record<string, any>>;

    const results: MetricEvaluationResult[] = [];
    for (const row of rows) {
      const current = numberOrNull(row.current);
      const threshold = numberOrNull(row.threshold);
      if (current == null || threshold == null) continue;

      const owner = resolveOwner({
        id: row.id,
        explicitOwner: row.explicitOwner,
        projectOwner: row.projectOwner,
        project: row.project,
      });
      const metricType = row.type || "gauge";
      const config = parseConfig(row.config);
      const alertConfig = config?.alert;
      let breached = false;
      let thresholdBreached = false;
      let rateBreached = false;
      let ratePer: number | null = null;
      let rateLimit: number | null = null;
      let rateDirection: "below" | "above" | null = null;
      let stallDetected = false;
      let alertKind: "threshold" | "rate" | "stall" | "consecutive_failures" | "sustained" = "threshold";

      if (metricType === "health" && alertConfig?.mode === "consecutive_failures") {
        const requiredCount = alertConfig.count || 3;
        const snapshots = db
          .prepare("SELECT value FROM metric_snapshots WHERE metric_id = ? ORDER BY measured_at DESC LIMIT ?")
          .all(row.id, requiredCount) as Array<{ value: number }>;
        breached =
          snapshots.length >= requiredCount &&
          snapshots.every((s) => evaluateThreshold({ current: s.value, threshold, alert_op: row.alert_op }));
        if (breached) alertKind = "consecutive_failures";
      } else if (metricType === "counter" && alertConfig?.mode === "rate") {
        const lastTwo = db
          .prepare(
            "SELECT value, measured_at FROM metric_snapshots WHERE metric_id = ? ORDER BY measured_at DESC LIMIT 2",
          )
          .all(row.id) as Array<{ value: number; measured_at: number }>;
        if (lastTwo.length === 2) {
          const deltaMs = lastTwo[0].measured_at - lastTwo[1].measured_at;
          const deltaValue = lastTwo[0].value - lastTwo[1].value;
          if (deltaMs > 0) {
            const perHour = (deltaValue / deltaMs) * 3600000;
            ratePer = alertConfig.per === "day" ? perHour * 24 : perHour;
            if (alertConfig.min_rate != null && ratePer < alertConfig.min_rate) {
              rateBreached = true;
              rateLimit = alertConfig.min_rate;
              rateDirection = "below";
            }
            if (alertConfig.max_rate != null && ratePer > alertConfig.max_rate) {
              rateBreached = true;
              rateLimit = alertConfig.max_rate;
              rateDirection = "above";
            }
          }
          if (alertConfig.stall_after_ms) {
            const latest = lastTwo[0];
            const changed = db
              .prepare(
                "SELECT measured_at FROM metric_snapshots WHERE metric_id = ? AND value != ? ORDER BY measured_at DESC LIMIT 1",
              )
              .get(row.id, latest.value) as { measured_at?: number } | null;
            if (ts - (changed?.measured_at ?? 0) > alertConfig.stall_after_ms) {
              stallDetected = true;
            }
          }
        }
        thresholdBreached = evaluateThreshold({ current, threshold, alert_op: row.alert_op });
        breached = thresholdBreached || rateBreached;
        if (breached) {
          if (stallDetected) alertKind = "stall";
          else if (rateBreached && !thresholdBreached) alertKind = "rate";
          // else alertKind remains "threshold"
        }
      } else if (metricType === "gauge" && alertConfig?.mode === "sustained") {
        const requiredCount = alertConfig.consecutive || 3;
        const snapshots = db
          .prepare("SELECT value FROM metric_snapshots WHERE metric_id = ? ORDER BY measured_at DESC LIMIT ?")
          .all(row.id, requiredCount) as Array<{ value: number }>;
        breached =
          snapshots.length >= requiredCount &&
          snapshots.every((s) => evaluateThreshold({ current: s.value, threshold, alert_op: row.alert_op }));
        if (breached) alertKind = "sustained";
      } else {
        breached = evaluateThreshold({ current, threshold, alert_op: row.alert_op });
      }

      const openAlert = db
        .prepare(
          "SELECT id, alert_type, message FROM metric_alerts WHERE metric_id = ? AND resolved_at IS NULL LIMIT 1",
        )
        .get(row.id) as { id: number; alert_type?: string; message?: string } | null;

      if (breached) {
        const thresholdDirection = row.alert_op === ">" || row.alert_op === "above" ? "above" : "below";
        const rateUnit = alertConfig?.per === "day" ? "day" : "hour";
        const alertType = alertKind;
        const message =
          alertType === "rate"
            ? `${row.name ?? row.id} rate is ${rateDirection ?? "outside"} limit: rate=${ratePer?.toFixed(2) ?? "?"}/${rateUnit}, limit=${rateLimit ?? "?"}/${rateUnit}, current=${current}, target=${row.target ?? "?"}`
            : `${row.name ?? row.id} is ${thresholdDirection} threshold: current=${current}, threshold=${threshold}, target=${row.target ?? "?"}`;
        const openAlertChanged =
          Boolean(openAlert) &&
          (openAlert?.alert_type !== alertType || openAlert?.message !== message);
        if (openAlertChanged) {
          db.run("UPDATE metric_alerts SET alert_type = ?, message = ? WHERE id = ?", [
            alertType,
            message,
            openAlert!.id,
          ]);
        }
        if (!openAlert) {
          db.run("INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)", [
            row.id,
            alertType,
            message,
            ts,
          ]);
          const alertId = latestAlertId(db, row.id);
          emitMetricEvent("metric.breach", owner, {
            metricId: row.id,
            metricName: row.name,
            project: row.project ?? undefined,
            alertId,
            alertType,
            current,
            threshold,
            target: row.target,
            alertOp: row.alert_op,
            direction: thresholdDirection,
            measuredAt: ts,
            trend: recentTrend(db, row.id),
            message,
            priority: row.priority ?? "P2",
          });
          results.push({ metricId: row.id, status: "breached", alertId, message });
        } else {
          if (openAlertChanged) {
            emitMetricEvent("metric.breach", owner, {
              metricId: row.id,
              metricName: row.name,
              project: row.project ?? undefined,
              alertId: openAlert.id,
              alertType,
              current,
              threshold,
              target: row.target,
              alertOp: row.alert_op,
              direction: thresholdDirection,
              measuredAt: ts,
              trend: recentTrend(db, row.id),
              message,
              priority: row.priority ?? "P2",
              repeat: true,
              reason: "open-alert-updated",
            });
          }
          results.push({ metricId: row.id, status: "breached", alertId: openAlert.id, message });
        }
      } else if (openAlert) {
        db.run("UPDATE metric_alerts SET resolved_at = ? WHERE id = ?", [ts, openAlert.id]);
        emitMetricEvent("metric.recovered", owner, {
          metricId: row.id,
          metricName: row.name,
          project: row.project ?? undefined,
          alertId: openAlert.id,
          current,
          threshold,
          target: row.target,
          alertOp: row.alert_op,
          measuredAt: ts,
          trend: recentTrend(db, row.id),
          priority: row.priority ?? "P2",
        });
        results.push({ metricId: row.id, status: "recovered", alertId: openAlert.id });
      } else {
        results.push({ metricId: row.id, status: "ok" });
      }

      if (stallDetected) {
        const message = `${row.name ?? row.id} stalled: no change for ${Math.round((alertConfig?.stall_after_ms || 0) / 60000)}min`;
        emitMetricEvent("metric.stalled", owner, {
          metricId: row.id,
          metricName: row.name,
          project: row.project ?? undefined,
          current,
          threshold,
          target: row.target,
          alertOp: row.alert_op,
          measuredAt: ts,
          trend: recentTrend(db, row.id),
          message,
          priority: row.priority ?? "P2",
        });
        results.push({ metricId: row.id, status: "stalled", message });
      }
    }

    return results;
  }

  function alert(id: string, message: string, opts?: ManualAlertOptions): void {
    const db = options.getDb();
    const ts = now();
    const row = db
      .prepare(
        `SELECT m.id, m.name, m.owner as explicitOwner, p.owner as projectOwner, m.project,
              m.current, m.threshold, m.target, m.alert_op,
              COALESCE(m.priority, 'P2') as priority
       FROM metrics m
       LEFT JOIN projects p ON m.project IS NOT NULL AND trim(m.project) != ''
         AND (p.id = m.project OR p.path = m.project OR p.name = m.project)
       WHERE m.id = ?`,
      )
      .get(id) as Record<string, any> | null;
    if (!row) throw new Error(`metric not found: ${id}`);

    const openAlert = db
      .prepare("SELECT id FROM metric_alerts WHERE metric_id = ? AND resolved_at IS NULL LIMIT 1")
      .get(id) as { id: number } | null;
    const alertType = opts?.alertType ?? "manual";
    const finalMessage = opts?.evidence ? `${message}\n\nEvidence: ${opts.evidence}` : message;
    if (openAlert) {
      db.run("UPDATE metric_alerts SET alert_type = ?, message = ? WHERE id = ?", [
        alertType,
        finalMessage,
        openAlert.id,
      ]);
    } else {
      db.run("INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)", [
        id,
        alertType,
        finalMessage,
        ts,
      ]);
    }
    const alertId = latestAlertId(db, id);
    const owner = resolveOwner({
      id,
      explicitOwner: row.explicitOwner,
      projectOwner: row.projectOwner,
      project: row.project,
    });
    emitMetricEvent("metric.breach", owner, {
      metricId: id,
      metricName: row.name,
      project: row.project ?? undefined,
      alertId,
      alertType,
      current: row.current,
      threshold: row.threshold,
      target: row.target,
      alertOp: row.alert_op,
      measuredAt: ts,
      trend: recentTrend(db, id),
      message: finalMessage,
      priority: opts?.priority ?? row.priority ?? "P2",
    });
  }

  function resolveAlert(alertId: number, _reason?: string): void {
    options.getDb().run("UPDATE metric_alerts SET resolved_at = ? WHERE id = ?", [now(), alertId]);
  }

  function get(id: string): Metric | null {
    return options.getDb().prepare("SELECT * FROM metrics WHERE id = ?").get(id) as Metric | null;
  }

  function list(filter?: MetricFilter): Metric[] {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter?.owner) {
      clauses.push("owner = ?");
      params.push(filter.owner);
    }
    if (filter?.project) {
      clauses.push("project = ?");
      params.push(filter.project);
    }
    if (filter?.status) {
      clauses.push("status = ?");
      params.push(filter.status);
    }
    const where = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";
    return options
      .getDb()
      .prepare(`SELECT * FROM metrics${where} ORDER BY owner, id`)
      .all(...params) as unknown as Metric[];
  }

  return {
    define,
    defineMany: (defs) => {
      for (const def of defs) define(def);
    },
    record,
    evaluate,
    alert,
    resolveAlert,
    get,
    list,
  };
}

export function createUnavailableMetricService(reason = "metrics unavailable"): MetricService {
  const fail = () => {
    throw new Error(reason);
  };
  return {
    define: fail,
    defineMany: fail,
    record: fail,
    evaluate: fail,
    alert: fail,
    resolveAlert: fail,
    get: fail,
    list: fail,
  };
}
