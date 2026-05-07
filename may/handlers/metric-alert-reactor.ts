/**
 * metric-alert-reactor — Handler that reacts to metric.breach events.
 *
 * Listens on: metric.breach
 * Action: Forks the owning agent for P0 breaches. Lower-priority breaches stay
 * visible through metric alert context and the closed-loop steward cron.
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

    // P0 alerts get an explicit owner session so handling is auditable.
    // P1/P2/P3 remain visible in metric context through the unresolved row.
    try {
      const db = ctx.sdk.getDb();
      const metricRow = db.prepare(
        `SELECT COALESCE(m.priority, 'P2') as priority,
                m.owner as explicitOwner, p.owner as projectOwner
         FROM metrics m
         LEFT JOIN projects p ON m.project IS NOT NULL AND trim(m.project) != ''
           AND (p.id = m.project OR p.path = m.project OR p.name = m.project)
         WHERE m.id = ?`
      ).get(metricId) as { priority?: string; explicitOwner?: string | null; projectOwner?: string | null } | null;
      priority = metricRow?.priority ?? priority;
      if (metricRow) owner = resolveMetricOwner(metricId, configuredAgents, metricRow.explicitOwner, metricRow.projectOwner);
      if (priority !== "P0" && priority !== "P1") {
        ctx.sdk.log("info", `[metric-alert-reactor] Deferring ${metricId} (${priority}) to metric context.`);
        return;
      }

      // P1 alerts: only triage if open >1h without a judgment event
      if (priority === "P1") {
        const alertRow = db.prepare(
          `SELECT ma.created_at FROM metric_alerts ma WHERE ma.metric_id = ? AND ma.resolved_at IS NULL`
        ).get(metricId) as { created_at: number } | null;
        const alertAge = alertRow ? Date.now() - alertRow.created_at : 0;
        if (alertAge < 60 * 60 * 1000) {
          ctx.sdk.log("info", `[metric-alert-reactor] P1 ${metricId} alert age ${Math.round(alertAge/60000)}m < 60m, deferring.`);
          return;
        }
        const judgedEvent = db.prepare(
          `SELECT id FROM events WHERE event_type = 'metric.alert_judged' AND data LIKE ? ORDER BY timestamp DESC LIMIT 1`
        ).get(`%${metricId}%`) as { id: number } | null;
        if (judgedEvent) {
          ctx.sdk.log("info", `[metric-alert-reactor] P1 ${metricId} already judged (event ${judgedEvent.id}), skipping.`);
          return;
        }
      }

      // Dedup: check if owner already has a recent session for this metric
      const recentSession = db.prepare(
        `SELECT sessionId FROM sessions
         WHERE agent = ? AND source = ? AND startedAt > ?`
      ).get(owner, `metric-alert-reactor:${metricId}`, Date.now() - DEDUP_WINDOW_MS) as { sessionId: string } | null;

      if (recentSession) {
        ctx.sdk.log("info", `[metric-alert-reactor] Skipping ${metricId} — ${owner} already has recent session ${recentSession.sessionId}`);
        return;
      }
    } catch {
      if (priority !== "P0" && priority !== "P1") {
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
