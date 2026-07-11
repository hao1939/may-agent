import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";

export const name = "ops-health-review";
export const description =
  "Deterministic may-agent.app ops observer. Builds a health packet, records it, and wakes the project owner only for meaningful signals.";

const ownerAgent = "tech-lead";
const ownerEventOwner = `agent:${ownerAgent}`;

type Row = Record<string, unknown>;

type Signal = {
  kind: string;
  severity: "P0" | "P1" | "P2";
  reason: string;
  evidence?: unknown;
};

type DeliveryHealth = {
  error?: unknown;
  ownerInboxOpenCount?: unknown;
  unhandledEvents?: unknown;
  overduePendingEvents?: unknown;
  orphanPairs?: unknown;
  overdueOpenPairs?: unknown;
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

function queryDeliveryHealth(
  ctx: WorkflowContext,
  now: number,
): DeliveryHealth {
  try {
    return ctx.query.eventDeliveryHealth({
      now,
      lookbackMs: 60 * 60_000,
      limit: 20,
    });
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
  return Array.isArray(value)
    ? (value.filter((row) => row && typeof row === "object") as Row[])
    : [];
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

function objectValue(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
}

function addString(values: Set<string>, value: unknown): void {
  if (typeof value === "string" && value.trim()) values.add(value.trim());
}

function escalationReplyKeys(row: Row): Set<string> {
  const keys = new Set<string>();
  const data = parseEventData(row);
  const conversation = objectValue(data.conversation);
  const context = objectValue(data.context);
  const telegramReply = objectValue(context.telegramReply);
  const originalIssue =
    objectValue(data.originalIssue).eventType !== undefined
      ? objectValue(data.originalIssue)
      : objectValue(telegramReply.originalIssue);

  addString(keys, data.conversationId);
  addString(keys, conversation.id);
  addString(keys, context.conversationId);
  addString(keys, telegramReply.conversationId);
  addString(keys, data.escalationId);
  addString(keys, data.escalation_id);
  addString(keys, originalIssue.escalationId);
  addString(keys, originalIssue.escalation_id);

  for (const key of [...keys]) {
    if (!key.startsWith("escalation:")) keys.add(`escalation:${key}`);
  }
  return keys;
}

function staleEscalationKeys(row: Row): Set<string> {
  const keys = new Set<string>();
  const data = parseEventData(row);
  addString(keys, data.escalationId);
  addString(keys, data.escalation_id);
  addString(keys, data.id);
  addString(keys, data.conversationId);
  for (const key of [...keys]) {
    if (!key.startsWith("escalation:")) keys.add(`escalation:${key}`);
  }
  return keys;
}

function compactReply(row: Row): Row {
  const data = parseEventData(row);
  const context = objectValue(data.context);
  const telegramReply = objectValue(context.telegramReply);
  const originalIssue =
    objectValue(data.originalIssue).eventType !== undefined
      ? objectValue(data.originalIssue)
      : objectValue(telegramReply.originalIssue);
  return {
    id: row.id,
    event_type: row.event_type,
    timestamp: row.timestamp,
    source: row.source,
    owner: row.owner,
    conversationId:
      data.conversationId ??
      objectValue(data.conversation).id ??
      context.conversationId ??
      telegramReply.conversationId,
    originalIssue: {
      eventType: originalIssue.eventType,
      escalationId: originalIssue.escalationId ?? originalIssue.escalation_id,
    },
    text:
      typeof data.text === "string"
        ? data.text.slice(0, 240)
        : typeof objectValue(telegramReply.notification).text === "string"
          ? String(objectValue(telegramReply.notification).text).slice(0, 240)
          : undefined,
  };
}

function attachReplyContext(escalations: Row[], replies: Row[]): Row[] {
  return escalations.map((escalation) => {
    const keys = staleEscalationKeys(escalation);
    const matches = replies.filter((reply) => {
      for (const key of escalationReplyKeys(reply)) {
        if (keys.has(key)) return true;
      }
      return false;
    });
    if (matches.length === 0) return escalation;
    return {
      ...escalation,
      reply_context: {
        state: "reply-received-no-closure",
        count: matches.length,
        latest: compactReply(matches[0] ?? {}),
      },
    };
  });
}

function writePacket(appDir: string, packet: Row): string {
  const stateDir = join(appDir, ".state");
  mkdirSync(stateDir, { recursive: true });
  const packetPath = join(stateDir, "ops-health-packets.jsonl");
  appendFileSync(packetPath, `${JSON.stringify(packet)}\n`, "utf8");
  return packetPath;
}

// Metrics that are intentionally deferred to scheduled project.tick reviews.
// These should NOT generate ops-health wake signals because:
// 1. Health-observation metrics oscillate and create breach→review→recover loops
// 2. Delegated metrics have known root causes being fixed elsewhere
// 3. Human-backlog metrics require external action the owner cannot self-service
// Must stay in sync with DEFERRED_METRICS in app.ts.
const DEFERRED_METRIC_IDS = new Set([
  "project.health.finding-count",
  "project.owner-incomplete-count",
  "project.owner-judgment-needed-count",
  "guard.triggered-count-24h",
  "guard.warned-count-24h",
  "runtime.project-app-schedule-orphan-count-1h",
  "escalation.pending-count",
  "metric.stale-active-count",
  "session.first-turn-error-count-1h",
  "handler.heartbeat-coverage",
  "infra.persist.db-size-mb",
  "agent.config-invalid-count-1h",
  "session.provider-error-count-1h",
  "event.pair-orphan-count",
  "capability.zombie-session-count",
  "runtime.stale-running-session-count",
]);

function buildPacket(ctx: WorkflowContext): { packet: Row; signals: Signal[] } {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60_000;
  const staleEscalationCutoff = now - 60 * 60_000;
  // Escalations older than 6h are "chronically stale" — they require human
  // action (ARM auth, external files, etc.) that the owner cannot self-service.
  // They're still recorded in observations and the daily digest, but don't
  // generate wake signals that interrupt the owner every hour.
  // Fresh escalations (1h-6h) get one chance to wake the owner in case they
  // are owner-resolvable; after 6h without resolution they need the human.
  const chronicallyStaleFloor = now - 6 * 60 * 60_000;

  const openOwnerAlerts = queryRows(ctx, () =>
    ctx.query.sql(
      `SELECT ma.id as alert_id, ma.metric_id, ma.message, ma.created_at,
              m.name, m.owner, m.priority, m.current, m.threshold, m.alert_op
         FROM metric_alerts ma
         LEFT JOIN metrics m ON m.id = ma.metric_id
        WHERE ma.resolved_at IS NULL
          AND (m.owner = 'tech-lead' OR m.owner = 'agent:tech-lead'
               OR m.owner = 'may' OR m.owner = 'agent:may')
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

  const pendingOwnerMessages = queryCount(
    ctx,
    `SELECT COUNT(*) as count
       FROM events
      WHERE event_type = 'message.created'
        AND status = 'pending'
        AND owner = ?`,
    [ownerEventOwner],
  );

  // Only count escalations from platform-internal sources (no sourceAgent,
  // or sourceAgent = owner). Project-agent escalations (aks-explorer, scout,
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
               OR json_extract(created.data, '$.sourceAgent') = ?)
          AND NOT EXISTS (
            SELECT 1
              FROM events closed
             WHERE closed.event_type IN ('escalation.resolved', 'escalation.dismissed')
               AND json_extract(closed.data, '$.escalationId') = json_extract(created.data, '$.escalationId')
          )
        ORDER BY created.timestamp ASC`,
      [staleEscalationCutoff, chronicallyStaleFloor, ownerAgent],
      { limit: 20 },
    ),
  );
  const recentEscalationReplies = queryRows(ctx, () =>
    ctx.query.sql(
      `SELECT id, event_type, source, owner, timestamp, data
         FROM events
        WHERE timestamp >= ?
          AND event_type IN ('telegram.reply', 'human.input.received')
        ORDER BY timestamp DESC, id DESC`,
      [chronicallyStaleFloor],
      { limit: 100 },
    ),
  );
  const staleEscalationsWithReplyContext = attachReplyContext(
    staleEscalations,
    recentEscalationReplies,
  );

  // Only count blocked workflows owned by this platform project.
  // evaluation.app blocked runs (evaluator-aftermath, evaluator-heartbeat)
  // and other project-owned workflows are not platform-actionable —
  // they should be surfaced by their own project's ops-health observer.
  //
  // For workflows with projectId IS NULL (legacy global handlers like
  // metric-alert-triage), also exclude runs whose result_reason identifies
  // them as belonging to other projects (e.g., "aks-rp-e2e.*" metrics).
  // Without this filter, global handler failures for other projects' metrics
  // trigger continuous hourly owner wakes with no platform-actionable fix.
  //
  // Additionally exclude:
  // - "missing original task" session-recovery blocks: the task text is
  //   permanently lost and no owner action can fix them.
  // - "Secret leak detected" guard blocks: these require human investigation
  //   of the secret source (e.g. Telegram bot token in metric context).
  //   The platform owner cannot resolve them in an automated review session.
  //   They are surfaced in the daily ops digest for human attention.
  const staleBlockedWorkflowRuns = queryRows(ctx, () =>
    ctx.query.sql(
      `SELECT workflow,
              status,
              COALESCE(result_reason, result_summary, '') AS reason,
              COUNT(*) AS count,
              MIN(COALESCE(endedAt, startedAt)) AS oldestAt,
              MAX(COALESCE(endedAt, startedAt)) AS newestAt
         FROM workflow_runs
        WHERE status IN ('blocked', 'escalated')
          AND COALESCE(endedAt, startedAt) < ?
          AND COALESCE(endedAt, startedAt) >= ?
          AND COALESCE(result_reason, result_summary, '') NOT LIKE '%missing original task%'
          AND COALESCE(result_reason, result_summary, '') NOT LIKE '%Secret leak detected%'
          AND (projectId = 'may-agent'
               OR (projectId IS NULL
                   AND COALESCE(result_reason, result_summary, '') NOT LIKE '%aks-rp-e2e%'
                   AND COALESCE(result_reason, result_summary, '') NOT LIKE '%scout-knowledge%'
                   AND COALESCE(result_reason, result_summary, '') NOT LIKE '%evaluation.%'))
        GROUP BY workflow, status, COALESCE(result_reason, result_summary, '')
        ORDER BY count DESC, newestAt DESC`,
      [staleEscalationCutoff, chronicallyStaleFloor],
      { limit: 20 },
    ),
  );

  const chronicBlockedWorkflowRuns = queryRows(ctx, () =>
    ctx.query.sql(
      `SELECT workflow,
              status,
              COALESCE(result_reason, result_summary, '') AS reason,
              COUNT(*) AS count,
              MIN(COALESCE(endedAt, startedAt)) AS oldestAt,
              MAX(COALESCE(endedAt, startedAt)) AS newestAt
         FROM workflow_runs
        WHERE status IN ('blocked', 'escalated')
          AND COALESCE(endedAt, startedAt) < ?
          AND COALESCE(result_reason, result_summary, '') NOT LIKE '%missing original task%'
          AND COALESCE(result_reason, result_summary, '') NOT LIKE '%Secret leak detected%'
          AND (projectId = 'may-agent'
               OR (projectId IS NULL
                   AND COALESCE(result_reason, result_summary, '') NOT LIKE '%aks-rp-e2e%'
                   AND COALESCE(result_reason, result_summary, '') NOT LIKE '%scout-knowledge%'
                   AND COALESCE(result_reason, result_summary, '') NOT LIKE '%evaluation.%'))
        GROUP BY workflow, status, COALESCE(result_reason, result_summary, '')
        ORDER BY count DESC, newestAt DESC`,
      [chronicallyStaleFloor],
      { limit: 20 },
    ),
  );

  const deliveryHealth = queryDeliveryHealth(ctx, now);
  const unhandledEvents = rowArray(deliveryHealth.unhandledEvents);
  const overduePendingEvents = rowArray(deliveryHealth.overduePendingEvents);
  const orphanPairs = rowArray(deliveryHealth.orphanPairs);
  const overdueOpenPairs = rowArray(deliveryHealth.overdueOpenPairs);
  // All repeated symptoms for the observations packet (context/awareness).
  const repeatedSymptoms = groupEventSymptoms(recentAbnormalEvents).filter(
    (row) => numberValue(row.count) >= 3,
  );
  // Only platform-owned repeated symptoms generate wake signals.
  // Cross-project handler.failed events (e.g. evaluator-owned evaluation-aftermath-scan)
  // are not platform-actionable and should not trigger hourly owner wakes.
  // The same ownership filter pattern used for metric alerts and escalations.
  const platformOwnerSet = new Set([
    ownerEventOwner,
    "agent:may",
    "may",
    "tech-lead",
  ]);
  const platformOwnedAbnormalEvents = recentAbnormalEvents.filter((row) => {
    const eventOwner = stringValue(row.owner);
    // Events with no owner or platform-owned events are platform-actionable.
    return !eventOwner || platformOwnerSet.has(eventOwner);
  });
  const platformRepeatedSymptoms = groupEventSymptoms(
    platformOwnedAbnormalEvents,
  ).filter((row) => numberValue(row.count) >= 3);

  const signals: Signal[] = [];
  // Exclude deferred metrics from generating wake signals.
  // They are still visible in the packet observations for context,
  // but do not trigger project.owner.requested events.
  const nonDeferredAlerts = openOwnerAlerts.filter(
    (row) => !DEFERRED_METRIC_IDS.has(stringValue(row.metric_id)),
  );
  const p0Alerts = nonDeferredAlerts.filter((row) => row.priority === "P0");
  const staleP1Alerts = nonDeferredAlerts.filter(
    (row) => row.priority === "P1" && numberValue(row.created_at) < oneHourAgo,
  );
  if (p0Alerts.length > 0) {
    signals.push({
      kind: "metric-p0",
      severity: "P0",
      reason: `${p0Alerts.length} open P0 platform-owned metric alert(s).`,
      evidence: compactRows(p0Alerts, 5),
    });
  }
  if (staleP1Alerts.length > 0) {
    signals.push({
      kind: "metric-p1-stale",
      severity: "P1",
      reason: `${staleP1Alerts.length} open P1 platform-owned metric alert(s) older than 1h.`,
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
      evidence: compactRows(staleEscalationsWithReplyContext, 5),
    });
  }
  if (staleBlockedWorkflowRuns.length > 0) {
    signals.push({
      kind: "workflow-local-blocked",
      severity: "P1",
      reason: `${staleBlockedWorkflowRuns.length} blocked workflow group(s) (including legacy workflow status 'escalated') need owner judgment.`,
      evidence: compactRows(staleBlockedWorkflowRuns, 8),
    });
  }
  if (platformRepeatedSymptoms.length > 0) {
    signals.push({
      kind: "repeated-runtime-symptom",
      severity: "P1",
      reason: `${platformRepeatedSymptoms.length} repeated platform-owned runtime symptom group(s) in the last hour.`,
      evidence: compactRows(platformRepeatedSymptoms, 8),
    });
  }
  // Filter out known-benign unhandled event types before generating wake signals.
  // session.end is a lifecycle bookkeeping event that is NOT expected to have a
  // consumer — session.completed is the event that triggers downstream handlers
  // (e.g. evaluation-aftermath). session.end events with delivery_status='unhandled'
  // are normal (deliveryNote: "no responsible consumer accepted event before timeout").
  // Without this filter, 10-15 evaluator session.end events per hour generate a
  // false P1 signal every hour, producing 24 owner wakes/day against a 6/day budget.
  const BENIGN_UNHANDLED_EVENT_TYPES = new Set(["session.end"]);
  const actionableUnhandled = unhandledEvents.filter(
    (row) => !BENIGN_UNHANDLED_EVENT_TYPES.has(stringValue(row.eventType)),
  );
  const actionableOverdue = overduePendingEvents.filter(
    (row) => !BENIGN_UNHANDLED_EVENT_TYPES.has(stringValue(row.eventType)),
  );
  if (actionableUnhandled.length > 0 || actionableOverdue.length > 0) {
    signals.push({
      kind: "event-delivery-unaccepted",
      severity: "P1",
      reason: `${actionableUnhandled.length} unhandled and ${actionableOverdue.length} overdue pending event(s) in the last hour.`,
      evidence: {
        unhandled: compactRows(actionableUnhandled, 5),
        overdue_pending: compactRows(actionableOverdue, 5),
      },
    });
  }
  // Only generate wake signals for platform-owned orphan pairs.
  // Cross-project pairs (owner = 'agent:aks-explorer', etc.) are owned
  // by their respective project apps and should not wake the platform owner.
  const platformOrphanPairs = orphanPairs.filter(
    (row) =>
      !stringValue(row.owner) ||
      stringValue(row.owner) === ownerEventOwner ||
      stringValue(row.owner) === "agent:may" ||
      stringValue(row.owner) === "may",
  );
  const platformOverduePairs = overdueOpenPairs.filter(
    (row) =>
      !stringValue(row.owner) ||
      stringValue(row.owner) === ownerEventOwner ||
      stringValue(row.owner) === "agent:may" ||
      stringValue(row.owner) === "may",
  );
  if (platformOrphanPairs.length > 0 || platformOverduePairs.length > 0) {
    signals.push({
      kind: "event-pair-unclosed",
      severity: "P1",
      reason: `${platformOrphanPairs.length} orphan and ${platformOverduePairs.length} overdue open platform-owned event pair(s) in the last hour.`,
      evidence: {
        orphan: compactRows(platformOrphanPairs, 5),
        overdue_open: compactRows(platformOverduePairs, 5),
      },
    });
  }

  const packet = {
    generated_at: new Date(now).toISOString(),
    role: "observer",
    active_alerts: {
      platform_owned_open: compactRows(openOwnerAlerts, 12),
      p0_count: p0Alerts.length,
      stale_p1_count: staleP1Alerts.length,
    },
    observations: {
      recent_abnormal_events: compactRows(recentAbnormalEvents, 20),
      repeated_runtime_symptoms: compactRows(repeatedSymptoms, 12),
      unknown_project_events: compactRows(unknownProjectEvents, 10),
      pending_owner_messages: pendingOwnerMessages,
      stale_escalations: compactRows(staleEscalationsWithReplyContext, 10),
      recent_escalation_replies: compactRows(recentEscalationReplies, 10),
      stale_blocked_workflow_runs: compactRows(staleBlockedWorkflowRuns, 10),
      chronic_blocked_workflow_runs: compactRows(
        chronicBlockedWorkflowRuns,
        10,
      ),
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
