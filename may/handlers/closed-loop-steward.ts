/**
 * closed-loop-steward — recurring may-owned audit of the metric/action loop.
 *
 * The cron schedule is static; the work context is not. Each run builds a
 * fresh brief from DB state so may can judge whether red metrics and delivery
 * failures are moving toward closure.
 */

import type { CronEntry, HandlerContext, HandlerModule } from "../../shared/agent-sdk.ts";
import { listConfiguredAgents, resolveMetricOwner } from "../../shared/lib/metric-ownership.ts";

type Config = {
  lookbackMs?: number;
  alertLimit?: number;
  deliveryFailureLimit?: number;
  triageLimit?: number;
};

type AlertRow = {
  id: number;
  metric_id: string;
  message: string;
  created_at: number | null;
  metricName: string | null;
  explicitOwner: string | null;
  projectOwner: string | null;
  current: number | null;
  threshold: number | null;
  target: number | null;
  priority: string | null;
  alertOp: string | null;
};

type SessionRow = {
  sessionId: string;
  status: string;
  source: string | null;
  startedAt: number;
  endedAt: number | null;
};

type EventRow = {
  id: number;
  source: string | null;
  owner: string | null;
  data: string | null;
  timestamp: number;
};

type JudgmentRow = {
  data: string | null;
  timestamp: number;
};

type SnapshotRow = {
  value: number | null;
  measured_at: number | null;
};

const DEFAULT_LOOKBACK_MS = 6 * 60 * 60_000;
const DEFAULT_ALERT_LIMIT = 12;
const DEFAULT_DELIVERY_FAILURE_LIMIT = 12;
const DEFAULT_TRIAGE_LIMIT = 3;
const RETRIAGE_COOLDOWN_MS = 15 * 60_000;

function age(now: number, timestamp?: number | null): string {
  if (!timestamp) return "unknown";
  const minutes = Math.max(0, Math.round((now - timestamp) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

function parseEventData(row: EventRow): Record<string, unknown> {
  try {
    return row.data ? JSON.parse(row.data) as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function summarizeSessions(sessions: SessionRow[], now: number): string {
  if (sessions.length === 0) return "none since alert";
  return sessions
    .map((s) => `${s.sessionId}:${s.status}:${s.source ?? "manual"}:${age(now, s.startedAt)} ago`)
    .join("; ");
}

function isBreaching(current: number | null, threshold: number | null, alertOp: string | null): boolean {
  if (current == null || threshold == null) return false;
  return alertOp === ">" || alertOp === "above" ? current > threshold : current < threshold;
}

function buildTriageTask(alert: AlertRow, owner: string, reason: string): string {
  return [
    `Run metric alert triage for ${alert.metric_id}.`,
    "",
    `Reason: ${reason}.`,
    "",
    "## Trigger Event",
    "```json",
    JSON.stringify({
      type: "metric.breach",
      source: "closed-loop-steward",
      entry: "closed-loop-steward",
      data: {
        alertId: alert.id,
        owner,
        metricId: alert.metric_id,
        metricName: alert.metricName ?? alert.metric_id,
        current: alert.current,
        threshold: alert.threshold,
        target: alert.target,
        message: alert.message,
        priority: alert.priority ?? "P2",
      },
      timestamp: Date.now(),
    }, null, 2),
    "```",
  ].join("\n");
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const config = (entry.handlerConfig ?? {}) as Config;
  const lookbackMs = config.lookbackMs ?? DEFAULT_LOOKBACK_MS;
  const alertLimit = config.alertLimit ?? DEFAULT_ALERT_LIMIT;
  const deliveryFailureLimit = config.deliveryFailureLimit ?? DEFAULT_DELIVERY_FAILURE_LIMIT;
  const triageLimit = config.triageLimit ?? DEFAULT_TRIAGE_LIMIT;
  const configuredAgents = listConfiguredAgents(ctx.sdk.paths.agents);

  return async () => {
    const db = ctx.sdk.getDb();
    const now = Date.now();

    const running = db.prepare(
      `SELECT sessionId FROM sessions
       WHERE agent = 'may' AND source = 'closed-loop-steward' AND status = 'running'
       LIMIT 1`,
    ).get() as { sessionId: string } | null;
    if (running) {
      ctx.sdk.log("info", `[closed-loop-steward] Skip: prior steward session still running (${running.sessionId}).`);
      return;
    }

    const alerts = db.prepare(
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
    ).all(alertLimit) as AlertRow[];

    const failures = db.prepare(
      `SELECT id, source, owner, data, timestamp
       FROM events
       WHERE event_type = 'message.delivery_failed' AND timestamp >= ?
       ORDER BY timestamp DESC
       LIMIT ?`,
    ).all(now - lookbackMs, deliveryFailureLimit) as EventRow[];

    if (alerts.length === 0 && failures.length === 0) {
      ctx.sdk.log("info", "[closed-loop-steward] Skip: no open metric alerts or recent delivery failures.");
      return;
    }

    const triageCandidates: Array<{ alert: AlertRow; owner: string; reason: string }> = [];

    const alertLines = alerts.map((alert) => {
      const owner = resolveMetricOwner(alert.metric_id, configuredAgents, alert.explicitOwner, alert.projectOwner);
      const ownerSessions = db.prepare(
        `SELECT sessionId, status, source, startedAt, endedAt
         FROM sessions
         WHERE agent = ? AND startedAt >= ?
         ORDER BY startedAt DESC
         LIMIT 3`,
      ).all(owner, alert.created_at ?? 0) as SessionRow[];
      const judgment = db.prepare(
        `SELECT data, timestamp
         FROM events
         WHERE event_type = 'metric.alert_judged'
           AND (
             json_extract(data, '$.alertId') = ?
             OR json_extract(data, '$.metricId') = ?
           )
         ORDER BY timestamp DESC
         LIMIT 1`,
      ).get(alert.id, alert.metric_id) as JudgmentRow | null;
      const judgmentData = judgment ? parseEventData({
        id: 0,
        source: null,
        owner: null,
        data: judgment.data,
        timestamp: judgment.timestamp,
      }) : null;
      const latestSnapshot = db.prepare(
        `SELECT value, measured_at
         FROM metric_snapshots
         WHERE metric_id = ?
         ORDER BY measured_at DESC
         LIMIT 1`,
      ).get(alert.metric_id) as SnapshotRow | null;
      const validatedAfterJudgment = !!judgment && !!latestSnapshot?.measured_at && latestSnapshot.measured_at > judgment.timestamp;
      const stillBreaching = isBreaching(
        latestSnapshot?.value ?? alert.current,
        alert.threshold,
        alert.alertOp,
      );
      const validationLine = judgmentData
        ? validatedAfterJudgment
          ? `  validation: ${stillBreaching ? "still breaching after judgment" : "latest snapshot is in range"} (snapshot age=${age(now, latestSnapshot?.measured_at)})`
          : `  validation: awaiting a newer metrics snapshot after judgment`
        : `  validation: no judgment to validate`;
      const priority = alert.priority ?? "P2";
      const activeTriage = db.prepare(
        `SELECT runId
         FROM workflow_runs
         WHERE workflow = 'metric-alert-triage'
           AND status = 'running'
           AND task LIKE ?
         LIMIT 1`,
      ).get(`%${alert.metric_id}%`) as { runId: string } | null;
      if ((priority === "P0" || priority === "P1") && !activeTriage) {
        if (!judgmentData) {
          triageCandidates.push({ alert, owner, reason: "missing metric.alert_judged event" });
        } else if (
          validatedAfterJudgment &&
          stillBreaching &&
          judgment &&
          now - judgment.timestamp >= RETRIAGE_COOLDOWN_MS
        ) {
          triageCandidates.push({ alert, owner, reason: "still breaching after latest judgment validation" });
        }
      }

      return [
        `- alert#${alert.id} metric=${alert.metric_id} priority=${alert.priority ?? "P2"} owner=${owner} age=${age(now, alert.created_at)}`,
        `  current=${alert.current ?? "unknown"} threshold=${alert.threshold ?? "unknown"} target=${alert.target ?? "unknown"}`,
        `  message=${alert.message}`,
        `  owner activity since alert: ${summarizeSessions(ownerSessions, now)}`,
        judgmentData
          ? `  latest judgment: operation=${String(judgmentData.operation ?? "unknown")} session=${String(judgmentData.ownerSessionId ?? "unknown")} age=${age(now, judgment?.timestamp)} evidence=${String(judgmentData.evidence ?? "").slice(0, 220)}`
          : `  latest judgment: none recorded (no metric.alert_judged event)`,
        validationLine,
      ].join("\n");
    });

    const failureLines = failures.map((row) => {
      const data = parseEventData(row);
      return [
        `- message.delivery_failed event#${row.id} age=${age(now, row.timestamp)} from=${String(data.from ?? row.source ?? "unknown")} to=${String(data.to ?? row.owner ?? "unknown")} priority=${String(data.priority ?? "P2")}`,
        `  reason=${String(data.reason ?? "unknown")}`,
        `  content=${String(data.content ?? "").slice(0, 220)}`,
      ].join("\n");
    });

    const recentStewardRuns = db.prepare(
      `SELECT sessionId, status, source, startedAt, endedAt
       FROM sessions
       WHERE agent = 'may' AND source = 'closed-loop-steward'
       ORDER BY startedAt DESC
       LIMIT 3`,
    ).all() as SessionRow[];

    for (const candidate of triageCandidates.slice(0, triageLimit)) {
      const task = buildTriageTask(candidate.alert, candidate.owner, candidate.reason);
      ctx.sdk.runWorkflow("metric-alert-triage", task, { source: candidate.owner })
        .then((result) => {
          ctx.sdk.log("info", `[closed-loop-steward] Routed ${candidate.alert.metric_id} to metric-alert-triage: ${String((result as any)?.status ?? "done")}`);
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          ctx.sdk.log("info", `[closed-loop-steward] Failed to route ${candidate.alert.metric_id}: ${msg.slice(0, 200)}`);
        });
    }

    const task = [
      "[cron:closed-loop-steward] Audit whether red metrics and failed deliveries are moving toward closure.",
      "",
      "You own the global closed loop, not every metric. The generated context below is workflow-collected live evidence.",
      "Use query_db only when the context is missing or internally inconsistent. If you do query, inspect schema first with PRAGMA table_info; do not guess runtime DB column names.",
      "If the context lacks a fact this audit needs, record that as a handler data-collection gap so the next run can be fixed to inject it.",
      "",
      "Mental model: project carries goal/context; metrics are signals; cron/events trigger reassessment; agents judge and act.",
      "",
      "Rules:",
      "- Prefer native ownership: metrics.owner, then project.owner, then agent-name prefix, then may fallback.",
      "- Treat metric.alert_judged as the durable record that the owner judged an alert.",
      "- A judgment is not closure. The handler has already routed P0/P1 alerts that need triage; do not hand-roll metric.alert_judged events.",
      "- If routing itself is wrong, fix this handler or the workflow instead of asking an agent to improvise DB/event writes.",
      "- Take the smallest operation that advances closure: route/nudge owner, fix broken ownership/routing, document a valid exception, or escalate when blocked.",
      "- Do not create a project for this cron itself. Create/update a project only when you discover systemic implementation work that cannot be completed in this run.",
      "- If this recurring procedure is wrong or stale, improve the handler/cron/config directly and verify it.",
      "- End with: issue, owner, judgment, action taken, next validation signal.",
      "",
      "## Open Metric Alerts",
      alertLines.length ? alertLines.join("\n") : "none",
      "",
      "## Recent Message Delivery Failures",
      failureLines.length ? failureLines.join("\n") : "none",
      "",
      "## Recent Steward Runs",
      recentStewardRuns.length ? summarizeSessions(recentStewardRuns, now) : "none",
    ].join("\n");

    try {
      ctx.sdk.runAgent("may", task, { source: "closed-loop-steward" })
        .then(() => {
          ctx.sdk.log("info", `[closed-loop-steward] May session completed for ${alerts.length} alert(s), ${failures.length} delivery failure(s).`);
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          ctx.sdk.log("info", `[closed-loop-steward] May session failed: ${msg.slice(0, 200)}`);
        });
      ctx.sdk.log("info", `[closed-loop-steward] Dispatched may with ${alerts.length} alert(s), ${failures.length} delivery failure(s).`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.sdk.log("info", `[closed-loop-steward] Failed to dispatch may: ${msg.slice(0, 200)}`);
    }
  };
};
