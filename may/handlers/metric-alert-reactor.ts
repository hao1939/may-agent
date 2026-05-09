/**
 * metric-alert-reactor — Handler that reacts to metric.breach events.
 *
 * Listens on: metric.breach
 * Action: Forks the owning agent for P0 breaches. P1/P2 breaches get explicit
 * owner triage after they remain open long enough to need a durable judgment.
 * P3 alerts stay visible through metric alert context and the steward cron.
 *
 * This keeps important issues auditable while preserving metric-context-based
 * handling for low-priority metric drift.
 *
 * Dedup: skips if the owner already has a metric-alert session for this
 * metric within the last 24h.
 */

import type { HandlerContext, HandlerModule, TriggerEvent } from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";
import { listConfiguredAgents, resolveMetricOwner } from "../../shared/lib/metric-ownership.ts";

const DEDUP_WINDOW_MS = 4 * 60 * 60 * 1000; // 4h — shorter window so repeated alerts get reacted to faster
const DIRECT_TRIAGE_AFTER_MS = 10 * 60 * 1000;
const P1_RETRIAGE_COOLDOWN_MS = 15 * 60 * 1000;

function parseJsonObject(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function parseValidationTime(value: unknown): number | null {
  const asNumber = numberOrNull(value);
  if (asNumber != null) return asNumber;
  if (typeof value !== "string" || value.trim() === "" || value === "next metrics-snapshot") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isBreaching(current: number | null, threshold: number | null, alertOp: string | null | undefined): boolean {
  if (current == null || threshold == null) return false;
  return alertOp === ">" || alertOp === "above" ? current > threshold : current < threshold;
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const configuredAgents = listConfiguredAgents(ctx.sdk.paths.agents);

  return async (event?: TriggerEvent) => {
    // If no event (timer tick), poll for unresolved alerts and process each
    if (!event?.data) {
      try {
        const db = ctx.sdk.getDb();
        const unresolved = db.prepare(
          `SELECT ma.metric_id, ma.message, m.name as metricName,
                  m.owner as explicitOwner, p.owner as projectOwner,
                  m.threshold, m.target,
                  m.current as current, COALESCE(m.priority, 'P2') as priority
           FROM metric_alerts ma
           JOIN metrics m ON m.id = ma.metric_id
           LEFT JOIN projects p ON m.project IS NOT NULL AND trim(m.project) != ''
             AND (p.id = m.project OR p.path = m.project OR p.name = m.project)
           WHERE ma.resolved_at IS NULL`
        ).all() as Array<{ metric_id: string; message: string; metricName: string; explicitOwner?: string | null; projectOwner?: string | null; threshold: number; target: number; current: number; priority: string }>;

        if (unresolved.length === 0) {
          ctx.sdk.log("info", "[metric-alert-reactor] Timer tick: no unresolved alerts.");
          return;
        }
        ctx.sdk.log("info", `[metric-alert-reactor] Timer tick: found ${unresolved.length} unresolved alert(s), processing...`);
        const promises = unresolved.map((row) => {
          const syntheticEvent: TriggerEvent = {
            type: "metric.breach",
            data: {
              owner: resolveMetricOwner(row.metric_id, configuredAgents, row.explicitOwner, row.projectOwner),
              metricId: row.metric_id,
              metricName: row.metricName,
              current: row.current,
              threshold: row.threshold,
              target: row.target,
              message: row.message,
              priority: row.priority,
            },
          };
          return processBreachEvent(ctx, syntheticEvent, configuredAgents);
        });
        await Promise.allSettled(promises);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.sdk.log("info", `[metric-alert-reactor] Timer tick DB error: ${msg}`);
      }
      return;
    }

    await processBreachEvent(ctx, event, configuredAgents);
  };
};

async function processBreachEvent(ctx: HandlerContext, event: TriggerEvent, configuredAgents: Set<string>) {

    const { owner: eventOwner, metricId, metricName, current, threshold, target, message, priority: eventPriority } = event.data as {
      owner?: string;
      metricId: string;
      metricName: string;
      current: number;
      threshold: number;
      target: number;
      message: string;
      priority?: string;
    };

    if (!metricId) {
      ctx.sdk.log("info", "[metric-alert-reactor] Missing metricId in event data.");
      return;
    }

    let owner = resolveMetricOwner(metricId, configuredAgents, eventOwner);
    let priority = eventPriority ?? "P2";
    let forceRetriageAfterJudgment = false;

    // P0 alerts get an immediate explicit owner session so handling is auditable.
    // P1/P2 alerts get explicit triage after a short grace period. P3 remains
    // visible in metric context only.
    try {
      const db = ctx.sdk.getDb();
      const metricRow = db.prepare(
        `SELECT COALESCE(m.priority, 'P2') as priority,
                m.owner as explicitOwner, p.owner as projectOwner,
                m.current as current, m.threshold as threshold, m.alert_op as alertOp
         FROM metrics m
         LEFT JOIN projects p ON m.project IS NOT NULL AND trim(m.project) != ''
           AND (p.id = m.project OR p.path = m.project OR p.name = m.project)
         WHERE m.id = ?`
      ).get(metricId) as { priority?: string; explicitOwner?: string | null; projectOwner?: string | null; current?: number | null; threshold?: number | null; alertOp?: string | null } | null;
      priority = metricRow?.priority ?? priority;
      if (metricRow) owner = resolveMetricOwner(metricId, configuredAgents, metricRow.explicitOwner, metricRow.projectOwner);
      if (priority !== "P0" && priority !== "P1" && priority !== "P2") {
        ctx.sdk.log("info", `[metric-alert-reactor] Deferring ${metricId} (${priority}) to metric context.`);
        return;
      }

      // P1/P2 alerts: allow a short grace period for heartbeat context, then
      // require an explicit durable judgment so the loop does not stall.
      if (priority === "P1" || priority === "P2") {
        const alertRow = db.prepare(
          `SELECT ma.id, ma.created_at FROM metric_alerts ma WHERE ma.metric_id = ? AND ma.resolved_at IS NULL`
        ).get(metricId) as { id: number; created_at: number } | null;
        const alertAge = alertRow ? Date.now() - alertRow.created_at : 0;
        if (alertAge < DIRECT_TRIAGE_AFTER_MS) {
          ctx.sdk.log("info", `[metric-alert-reactor] ${priority} ${metricId} alert age ${Math.round(alertAge/60000)}m < ${Math.round(DIRECT_TRIAGE_AFTER_MS / 60000)}m, deferring.`);
          return;
        }
        const judgedEvent = db.prepare(
          `SELECT id, data, timestamp
           FROM events
           WHERE event_type = 'metric.alert_judged'
             AND (
               json_extract(data, '$.alertId') = ?
               OR json_extract(data, '$.metricId') = ?
             )
           ORDER BY timestamp DESC
           LIMIT 1`
        ).get(alertRow?.id ?? null, metricId) as { id: number; data: string | null; timestamp: number } | null;
        if (judgedEvent) {
          const judgmentData = parseJsonObject(judgedEvent.data);
          const nextValidationAt = parseValidationTime(judgmentData.nextValidationAt);
          if (nextValidationAt != null && Date.now() < nextValidationAt) {
            ctx.sdk.log("info", `[metric-alert-reactor] P1 ${metricId} judged (event ${judgedEvent.id}); waiting for requested validation.`);
            return;
          }

          const latestSnapshot = db.prepare(
            `SELECT value, measured_at
             FROM metric_snapshots
             WHERE metric_id = ?
             ORDER BY measured_at DESC
             LIMIT 1`
          ).get(metricId) as { value: number | null; measured_at: number } | null;
          if (!latestSnapshot || latestSnapshot.measured_at <= judgedEvent.timestamp) {
            ctx.sdk.log("info", `[metric-alert-reactor] P1 ${metricId} judged (event ${judgedEvent.id}); awaiting next metrics snapshot.`);
            return;
          }
          if (Date.now() - judgedEvent.timestamp < P1_RETRIAGE_COOLDOWN_MS) {
            ctx.sdk.log("info", `[metric-alert-reactor] P1 ${metricId} judged (event ${judgedEvent.id}); validation cooldown active.`);
            return;
          }

          const currentValue = numberOrNull(latestSnapshot.value ?? metricRow?.current ?? current);
          const thresholdValue = numberOrNull(metricRow?.threshold ?? threshold);
          if (!isBreaching(currentValue, thresholdValue, metricRow?.alertOp)) {
            ctx.sdk.log("info", `[metric-alert-reactor] P1 ${metricId} judged and latest snapshot is recovered; waiting for alert lifecycle.`);
            return;
          }
          ctx.sdk.log("info", `[metric-alert-reactor] P1 ${metricId} still breaching after judgment event ${judgedEvent.id}; rerunning triage.`);
          forceRetriageAfterJudgment = true;
        }
      }

      const recentTriageRun = db.prepare(
        `SELECT runId, status, startedAt
         FROM workflow_runs
         WHERE workflow = 'metric-alert-triage'
           AND startedAt > ?
           AND task LIKE ?
         ORDER BY startedAt DESC
         LIMIT 1`
      ).get(Date.now() - DEDUP_WINDOW_MS, `%${metricId}%`) as { runId: string; status: string; startedAt: number } | null;

      if (recentTriageRun) {
        if (recentTriageRun.status === "running") {
          ctx.sdk.log("info", `[metric-alert-reactor] Skipping ${metricId} — metric-alert-triage already running (${recentTriageRun.runId})`);
          return;
        }
        const judgment = db.prepare(
          `SELECT id FROM events
           WHERE event_type = 'metric.alert_judged'
             AND json_extract(data, '$.metricId') = ?
             AND timestamp >= ?
           ORDER BY timestamp DESC
           LIMIT 1`
        ).get(metricId, recentTriageRun.startedAt) as { id: number } | null;
        if (judgment && !forceRetriageAfterJudgment) {
          ctx.sdk.log("info", `[metric-alert-reactor] Skipping ${metricId} — recent triage workflow ${recentTriageRun.runId} emitted judgment ${judgment.id}`);
          return;
        }
      }

      // Dedup: suppress only active metric handling or completed handling that
      // emitted a judgment. A finished session without metric.alert_judged did
      // not close the loop and must not block a still-breaching alert.
      const recentSession = db.prepare(
        `SELECT sessionId, status, startedAt FROM sessions
         WHERE agent = ? AND source = ? AND startedAt > ?`
      ).get(owner, `metric-alert-reactor:${metricId}`, Date.now() - DEDUP_WINDOW_MS) as { sessionId: string; status: string; startedAt: number } | null;

      if (recentSession) {
        if (recentSession.status === "running") {
          ctx.sdk.log("info", `[metric-alert-reactor] Skipping ${metricId} — ${owner} already has running session ${recentSession.sessionId}`);
          return;
        }
        const judgment = db.prepare(
          `SELECT id FROM events
           WHERE event_type = 'metric.alert_judged'
             AND json_extract(data, '$.metricId') = ?
             AND timestamp >= ?
           ORDER BY timestamp DESC
           LIMIT 1`
        ).get(metricId, recentSession.startedAt) as { id: number } | null;
        if (judgment && !forceRetriageAfterJudgment) {
          ctx.sdk.log("info", `[metric-alert-reactor] Skipping ${metricId} — ${owner} already judged it in recent session ${recentSession.sessionId}`);
          return;
        }
        ctx.sdk.log("info", `[metric-alert-reactor] Re-running ${metricId} — recent session ${recentSession.sessionId} ended without judgment`);
      }
    } catch {
      if (priority !== "P0") {
        ctx.sdk.log("info", `[metric-alert-reactor] Deferring ${metricId} (${priority}) to metric context.`);
        return;
      }
      // DB unavailable for dedup — proceed for explicit P0 events.
    }

    const task = [
      `Run metric alert triage for ${metricId}.`,
      "",
      "## Trigger Event",
      "```json",
      JSON.stringify({
        type: "metric.breach",
        source: "event",
        entry: "metric-alert-reactor",
        data: {
          owner,
          metricId,
          metricName,
          current,
          threshold,
          target,
          message,
          priority,
        },
        timestamp: Date.now(),
      }, null, 2),
      "```",
    ].join("\n");

    try {
      const PER_ALERT_TIMEOUT_MS = 240_000; // 4 minutes per alert
      await Promise.race([
        ctx.sdk.runWorkflow("metric-alert-triage", task, { source: owner }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`Per-alert timeout (${PER_ALERT_TIMEOUT_MS / 1000}s) for ${metricId}`)), PER_ALERT_TIMEOUT_MS)),
      ]);
      ctx.sdk.log("info", `[metric-alert-reactor] Ran metric-alert-triage for ${owner} to handle ${metricId}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      ctx.sdk.log("info", `[metric-alert-reactor] Failed to run ${owner}: ${msg}`);
    }
}
