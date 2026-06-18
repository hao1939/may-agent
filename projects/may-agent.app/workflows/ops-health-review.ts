import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";

export const name = "ops-health-review";
export const description =
  "Deterministic may-agent.app ops observer. Builds a health packet, records it, and wakes May only for meaningful signals.";

type Row = Record<string, unknown>;

type Signal = {
  kind: string;
  severity: "P0" | "P1" | "P2";
  reason: string;
  evidence?: unknown;
};

function field(task: string, name: string): string | undefined {
  const pattern = new RegExp(`^${name}:\\s*(.+)$`, "m");
  return task.match(pattern)?.[1]?.trim();
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseEventData(row: Row): Row {
  const data = row.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Row;
  }
  if (typeof data !== "string" || !data.trim()) return {};
  try {
    const parsed = JSON.parse(data) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Row)
      : {};
  } catch {
    return {};
  }
}

function compactRows(rows: Row[], limit = 10): Row[] {
  const max = 500;
  return rows.slice(0, limit).map((row) => {
    const compact: Row = {};
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === "string" && value.length > max) {
        compact[key] =
          `${value.slice(0, max)}...[truncated ${value.length} chars]`;
      } else {
        compact[key] = value;
      }
    }
    return compact;
  });
}

function queryRows(ctx: WorkflowContext, query: () => { rows: Row[] }): Row[] {
  try {
    return query().rows;
  } catch (error) {
    return [
      {
        error: error instanceof Error ? error.message : String(error),
      },
    ];
  }
}

function queryCount(
  ctx: WorkflowContext,
  sql: string,
  params: unknown[] = [],
): number {
  const rows = queryRows(ctx, () => ctx.query.sql(sql, params, { limit: 1 }));
  return numberValue(rows[0]?.count ?? rows[0]?.c);
}

function queryDeliveryHealth(ctx: WorkflowContext, now: number): Row {
  try {
    return ctx.query.eventDeliveryHealth({
      now,
      lookbackMs: 60 * 60_000,
      limit: 20,
    }) as Row;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      unhandledEvents: [],
      overduePendingEvents: [],
      orphanPairs: [],
      overdueOpenPairs: [],
      ownerInboxOpenCount: 0,
    };
  }
}

function rowArray(value: unknown): Row[] {
  return Array.isArray(value) ? (value.filter((row) => row && typeof row === "object") as Row[]) : [];
}

function groupEventSymptoms(rows: Row[]): Row[] {
  const byKey = new Map<string, { count: number; latest: Row }>();
  for (const row of rows) {
    const data = parseEventData(row);
    const handler =
      stringValue(data.handler) ||
      stringValue(data.source) ||
      stringValue(row.source) ||
      "unknown";
    const key = `${String(row.event_type ?? row.type ?? "event")}:${handler}`;
    const existing = byKey.get(key);
    byKey.set(key, {
      count: (existing?.count ?? 0) + 1,
      latest: row,
    });
  }
  return [...byKey.entries()]
    .map(([key, value]) => ({
      key,
      count: value.count,
      latest: value.latest,
    }))
    .sort((a, b) => numberValue(b.count) - numberValue(a.count));
}

function writePacket(appDir: string, packet: Row): string {
  const stateDir = join(appDir, ".state");
  mkdirSync(stateDir, { recursive: true });
  const packetPath = join(stateDir, "ops-health-packets.jsonl");
  appendFileSync(packetPath, `${JSON.stringify(packet)}\n`, "utf8");
  return packetPath;
}

function buildPacket(ctx: WorkflowContext): { packet: Row; signals: Signal[] } {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60_000;
  const staleEscalationCutoff = now - 60 * 60_000;
  // Escalations older than 6h are "chronically stale" — they require human
  // action (ARM auth, external files, etc.) that May cannot self-service.
  // They're still recorded in observations and the daily digest, but don't
  // generate wake signals that interrupt the owner every hour.
  // Fresh escalations (1h–6h) get one chance to wake the owner in case they
  // are May-resolvable; after 6h without resolution they need the human.
  const chronicallyStaleFloor = now - 6 * 60 * 60_000;

  const openOwnerAlerts = queryRows(ctx, () =>
    ctx.query.sql(
      `SELECT ma.id as alert_id, ma.metric_id, ma.message, ma.created_at,
              m.name, m.owner, m.priority, m.current, m.threshold, m.alert_op
         FROM metric_alerts ma
         LEFT JOIN metrics m ON m.id = ma.metric_id
        WHERE ma.resolved_at IS NULL
          AND (m.owner = 'may' OR m.owner = 'agent:may')
        ORDER BY ma.created_at ASC`,
      [],
      { limit: 50 },
    ),
  );

  const recentAbnormalEvents = queryRows(ctx, () =>
    ctx.query.sql(
      `SELECT id, event_type, source, owner, timestamp, status, data
         FROM events
        WHERE timestamp >= ?
          AND event_type IN (
            'handler.failed',
            'subscriber.failed',
            'message.delivery_failed',
            'agent.config_invalid',
            'session.resume_failed',
            'escalation.resume_failed'
          )
        ORDER BY timestamp DESC, id DESC`,
      [oneHourAgo],
      { limit: 100 },
    ),
  );

  const unknownProjectEvents = queryRows(ctx, () =>
    ctx.query.sql(
      `SELECT id, event_type, source, owner, timestamp, status, data
         FROM events
        WHERE timestamp >= ?
          AND event_type LIKE 'project.%'
          AND event_type NOT IN (
            'project.comment.created',
            'project.tick',
            'project.action.invoked',
            'project.owner.requested',
            'project.planning.requested',
            'project.tasks.ready',
            'project.reviewed',
            'project.ops_health.tick',
            'project.ops_health.observed'
          )
        ORDER BY timestamp DESC, id DESC`,
      [oneHourAgo],
      { limit: 30 },
    ),
  );

  const pendingMayMessages = queryCount(
    ctx,
    `SELECT COUNT(*) as count
       FROM events
      WHERE event_type = 'message.created'
        AND status = 'pending'
        AND (owner = 'agent:may' OR owner = 'human:operator')`,
  );

  // Only count escalations from platform-internal sources (no sourceAgent,
  // or sourceAgent = 'may'). Project-agent escalations (aks-explorer, scout,
  // evaluator, etc.) are project-level work items — typically needing human
  // action (ARM auth, external files, clean git baselines) — and should be
  // captured in the daily ops digest, not trigger hourly platform health wakes.
  const staleEscalations = queryRows(ctx, () =>
    ctx.query.sql(
      `SELECT created.id, created.timestamp, created.owner, created.source, created.data
         FROM events created
        WHERE created.event_type = 'escalation.created'
          AND created.timestamp < ?
          AND created.timestamp >= ?
          AND (json_extract(created.data, '$.sourceAgent') IS NULL
               OR json_extract(created.data, '$.sourceAgent') = 'may')
          AND NOT EXISTS (
            SELECT 1
              FROM events closed
             WHERE closed.event_type IN ('escalation.resolved', 'escalation.dismissed')
               AND json_extract(closed.data, '$.escalationId') = json_extract(created.data, '$.escalationId')
          )
        ORDER BY created.timestamp ASC`,
      [staleEscalationCutoff, chronicallyStaleFloor],
      { limit: 20 },
    ),
  );

  const deliveryHealth = queryDeliveryHealth(ctx, now);
  const unhandledEvents = rowArray(deliveryHealth.unhandledEvents);
  const overduePendingEvents = rowArray(deliveryHealth.overduePendingEvents);
  const orphanPairs = rowArray(deliveryHealth.orphanPairs);
  const overdueOpenPairs = rowArray(deliveryHealth.overdueOpenPairs);
  const repeatedSymptoms = groupEventSymptoms(recentAbnormalEvents).filter(
    (row) => numberValue(row.count) >= 3,
  );

  const signals: Signal[] = [];
  const p0Alerts = openOwnerAlerts.filter((row) => row.priority === "P0");
  const staleP1Alerts = openOwnerAlerts.filter(
    (row) => row.priority === "P1" && numberValue(row.created_at) < oneHourAgo,
  );
  if (p0Alerts.length > 0) {
    signals.push({
      kind: "metric-p0",
      severity: "P0",
      reason: `${p0Alerts.length} open P0 May-owned metric alert(s).`,
      evidence: compactRows(p0Alerts, 5),
    });
  }
  if (staleP1Alerts.length > 0) {
    signals.push({
      kind: "metric-p1-stale",
      severity: "P1",
      reason: `${staleP1Alerts.length} open P1 May-owned metric alert(s) older than 1h.`,
      evidence: compactRows(staleP1Alerts, 5),
    });
  }
  if (staleEscalations.length > 0) {
    // The SQL already filters to the actionable window (1h–72h old).
    // Chronically stale escalations (>72h) are excluded at query time
    // to avoid waking the owner repeatedly for things requiring human
    // intervention (ARM auth, clean git baselines, external files).
    signals.push({
      kind: "stale-escalation",
      severity: "P1",
      reason: `${staleEscalations.length} platform-sourced escalation(s) (1h–6h old) without resolution/dismissal.`,
      evidence: compactRows(staleEscalations, 5),
    });
  }
  if (repeatedSymptoms.length > 0) {
    signals.push({
      kind: "repeated-runtime-symptom",
      severity: "P1",
      reason: `${repeatedSymptoms.length} repeated runtime symptom group(s) in the last hour.`,
      evidence: compactRows(repeatedSymptoms, 8),
    });
  }
  if (unhandledEvents.length > 0 || overduePendingEvents.length > 0) {
    signals.push({
      kind: "event-delivery-unaccepted",
      severity: "P1",
      reason: `${unhandledEvents.length} unhandled and ${overduePendingEvents.length} overdue pending event(s) in the last hour.`,
      evidence: {
        unhandled: compactRows(unhandledEvents, 5),
        overdue_pending: compactRows(overduePendingEvents, 5),
      },
    });
  }
  if (orphanPairs.length > 0 || overdueOpenPairs.length > 0) {
    signals.push({
      kind: "event-pair-unclosed",
      severity: "P1",
      reason: `${orphanPairs.length} orphan and ${overdueOpenPairs.length} overdue open event pair(s) in the last hour.`,
      evidence: {
        orphan: compactRows(orphanPairs, 5),
        overdue_open: compactRows(overdueOpenPairs, 5),
      },
    });
  }

  const packet = {
    generated_at: new Date(now).toISOString(),
    role: "observer",
    active_alerts: {
      may_owned_open: compactRows(openOwnerAlerts, 12),
      p0_count: p0Alerts.length,
      stale_p1_count: staleP1Alerts.length,
    },
    observations: {
      recent_abnormal_events: compactRows(recentAbnormalEvents, 20),
      repeated_runtime_symptoms: compactRows(repeatedSymptoms, 12),
      unknown_project_events: compactRows(unknownProjectEvents, 10),
      pending_may_messages: pendingMayMessages,
      stale_escalations: compactRows(staleEscalations, 10),
      event_delivery_health: {
        owner_inbox_open_count: numberValue(deliveryHealth.ownerInboxOpenCount),
        unhandled_events: compactRows(unhandledEvents, 10),
        overdue_pending_events: compactRows(overduePendingEvents, 10),
        orphan_pairs: compactRows(orphanPairs, 10),
        overdue_open_pairs: compactRows(overdueOpenPairs, 10),
        error: deliveryHealth.error,
      },
    },
    signals,
  };

  return { packet, signals };
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const appDir = field(ctx.task, "app") ?? "/app/projects/may-agent.app";
  const { packet, signals } = buildPacket(ctx);
  const packetPath = writePacket(appDir, packet);

  ctx.emit({
    type: "project.ops_health.observed",
    project: "may-agent",
    packetPath,
    signalCount: signals.length,
    signals,
  });

  if (signals.length > 0) {
    ctx.emit({
      type: "project.owner.requested",
      project: "may-agent",
      reason: "ops-health-signal",
      params: {
        packetPath,
        signalCount: signals.length,
        signals,
      },
    });
  }

  return ctx.done(
    signals.length > 0
      ? `Ops health observer recorded ${signals.length} signal(s); owner wake emitted.`
      : "Ops health observer recorded packet with no owner wake.",
  );
}
