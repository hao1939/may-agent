/**
 * metric-alert-reactor — Handler that reacts to metric.breach events.
 *
 * Listens on: metric.breach
 * Action: Forks the owning agent for P0/P1 breaches. Lower-priority breaches
 * stay visible through metric alert context and are handled on heartbeat.
 *
 * This keeps important issues auditable while preserving heartbeat-based
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
  const configuredAgents = listConfiguredAgents(ctx.agentsRoot);

  return async (event?: TriggerEvent) => {
    // If no event (timer tick), poll for unresolved alerts and process each
    if (!event?.data) {
      try {
        const db = ctx.getDb();
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
          ctx.log("[metric-alert-reactor] Timer tick: no unresolved alerts.");
          return;
        }
        ctx.log(`[metric-alert-reactor] Timer tick: found ${unresolved.length} unresolved alert(s), processing...`);
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
        ctx.log(`[metric-alert-reactor] Timer tick DB error: ${msg}`);
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
      ctx.log("[metric-alert-reactor] Missing metricId in event data.");
      return;
    }

    let owner = resolveMetricOwner(metricId, configuredAgents, eventOwner);
    let priority = eventPriority ?? "P2";

    // P0/P1 alerts get an explicit owner session so handling is auditable.
    // P2/P3 remain visible in heartbeat context through the unresolved row.
    try {
      const db = ctx.getDb();
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
        ctx.log(`[metric-alert-reactor] Deferring ${metricId} (${priority}) to heartbeat context.`);
        return;
      }

      // Dedup: check if owner already has a recent session for this metric
      const recentSession = db.prepare(
        `SELECT sessionId FROM sessions
         WHERE agent = ? AND source = ? AND startedAt > ?`
      ).get(owner, `metric-alert-reactor:${metricId}`, Date.now() - DEDUP_WINDOW_MS) as { sessionId: string } | null;

      if (recentSession) {
        ctx.log(`[metric-alert-reactor] Skipping ${metricId} — ${owner} already has recent session ${recentSession.sessionId}`);
        return;
      }
    } catch {
      if (priority !== "P0" && priority !== "P1") {
        ctx.log(`[metric-alert-reactor] Deferring ${metricId} (${priority}) to heartbeat context.`);
        return;
      }
      // DB unavailable for dedup — proceed for explicit P0/P1 events.
    }

    const task = [
      `[metric-alert][${metricId}][${priority}] ${message}`,
      ``,
      `Your metric "${metricName}" is breaching its threshold.`,
      `  Current: ${current}`,
      `  Threshold: ${threshold}`,
      `  Target: ${target}`,
      ``,
      `Follow agents/shared/may-agent-docs/manual/metric-alerts.md.`,
      ``,
      `You MUST judge the alert and take exactly ONE operation:`,
      `1. **Investigate, then choose final operation** — if cause is unknown`,
      `2. **Fix root cause** — change behavior/code so the metric improves`,
      `3. **Calibrate metric** — if threshold, target, priority, or measurement is wrong`,
      `   bun -e "import {Database} from 'bun:sqlite'; const db = new Database('.state/may.db'); db.prepare(\\"UPDATE metrics SET threshold = <new_value> WHERE id = '${metricId}'\\").run();"`,
      `4. **Downgrade priority** — only with solid evidence that current priority is too high`,
      `5. **Upgrade/escalate emergency** — if severity is higher than labeled or unsafe to fix`,
      `6. **Resolve stale/transient alert state** — only if already recovered or invalid`,
      `   bun -e "import {Database} from 'bun:sqlite'; const db = new Database('.state/may.db'); db.prepare(\\"UPDATE metric_alerts SET resolved_at = ${Date.now()} WHERE metric_id = '${metricId}' AND resolved_at IS NULL\\").run();"`,
      `7. **Document exception** — accepted breach with reason and review condition in metrics.blocker`,
      ``,
      `Investigation alone is NOT sufficient. State the chosen operation and evidence in your final summary. The next metrics snapshot is the judge for whether the metric recovered.`,
    ].join("\n");

    try {
      const PER_ALERT_TIMEOUT_MS = 240_000; // 4 minutes per alert
      await Promise.race([
        ctx.sdk.runAgent(owner, task, { source: `metric-alert-reactor:${metricId}` }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`Per-alert timeout (${PER_ALERT_TIMEOUT_MS / 1000}s) for ${metricId}`)), PER_ALERT_TIMEOUT_MS)),
      ]);
      ctx.log(`[metric-alert-reactor] Ran ${owner} to handle ${metricId}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      ctx.log(`[metric-alert-reactor] Failed to run ${owner}: ${msg}`);
    }
}
