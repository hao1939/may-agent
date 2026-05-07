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

const DEFAULT_LOOKBACK_MS = 6 * 60 * 60_000;
const DEFAULT_ALERT_LIMIT = 12;
const DEFAULT_DELIVERY_FAILURE_LIMIT = 12;

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

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const config = (entry.handlerConfig ?? {}) as Config;
  const lookbackMs = config.lookbackMs ?? DEFAULT_LOOKBACK_MS;
  const alertLimit = config.alertLimit ?? DEFAULT_ALERT_LIMIT;
  const deliveryFailureLimit = config.deliveryFailureLimit ?? DEFAULT_DELIVERY_FAILURE_LIMIT;
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
              m.current, m.threshold, m.target, COALESCE(m.priority, 'P2') as priority
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

      return [
        `- alert#${alert.id} metric=${alert.metric_id} priority=${alert.priority ?? "P2"} owner=${owner} age=${age(now, alert.created_at)}`,
        `  current=${alert.current ?? "unknown"} threshold=${alert.threshold ?? "unknown"} target=${alert.target ?? "unknown"}`,
        `  message=${alert.message}`,
        `  owner activity since alert: ${summarizeSessions(ownerSessions, now)}`,
        judgmentData
          ? `  latest judgment: operation=${String(judgmentData.operation ?? "unknown")} session=${String(judgmentData.ownerSessionId ?? "unknown")} age=${age(now, judgment?.timestamp)} evidence=${String(judgmentData.evidence ?? "").slice(0, 220)}`
          : `  latest judgment: none recorded (no metric.alert_judged event)`,
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

    const task = [
      "[cron:closed-loop-steward] Audit whether red metrics and failed deliveries are moving toward closure.",
      "",
      "You own the global closed loop, not every metric. Use the generated context below as the starting point, then verify with query_db before taking action.",
      "",
      "Mental model: project carries goal/context; metrics are signals; cron/events trigger reassessment; agents judge and act.",
      "",
      "Rules:",
      "- Prefer native ownership: metrics.owner, then project.owner, then agent-name prefix, then may fallback.",
      "- Treat metric.alert_judged as the durable record that the owner judged an alert.",
      "- If an alert has owner activity but no metric.alert_judged event, route it through the metric-alert-triage workflow or nudge the owner to produce a structured operation.",
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
      await ctx.sdk.runAgent("may", task, { source: "closed-loop-steward" });
      ctx.sdk.log("info", `[closed-loop-steward] Dispatched may with ${alerts.length} alert(s), ${failures.length} delivery failure(s).`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.sdk.log("info", `[closed-loop-steward] Failed: ${msg.slice(0, 200)}`);
    }
  };
};
