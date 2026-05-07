/**
 * metric-alert-reactor — Handler that reacts to metric.breach events.
 *
 * Listens on: metric.breach
 * Action: Forks the owning agent for P0 breaches. Lower-priority breaches stay
 * visible through metric alert context and are handled on heartbeat.
 *
 * This keeps urgent safety issues immediate while preserving deliberative
 * heartbeat-based handling for normal metric drift.
 *
 * Dedup: skips if the owner already has a metric-alert session for this
 * metric within the last 24h.
 */

import type { HandlerContext, HandlerModule, TriggerEvent } from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";

const DEDUP_WINDOW_MS = 4 * 60 * 60 * 1000; // 4h — shorter window so repeated alerts get reacted to faster

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async (event?: TriggerEvent) => {
    // If no event (timer tick), poll for unresolved alerts and process each
    if (!event?.data) {
      try {
        const db = ctx.getDb();
        const unresolved = db.prepare(
          `SELECT ma.metric_id, ma.message, m.name as metricName, m.owner, m.threshold, m.target,
                  m.current as current, COALESCE(m.priority, 'P2') as priority
           FROM metric_alerts ma
           JOIN metrics m ON m.id = ma.metric_id
           WHERE ma.resolved_at IS NULL`
        ).all() as Array<{ metric_id: string; message: string; metricName: string; owner: string; threshold: number; target: number; current: number; priority: string }>;

        if (unresolved.length === 0) {
          ctx.log("[metric-alert-reactor] Timer tick: no unresolved alerts.");
          return;
        }
        ctx.log(`[metric-alert-reactor] Timer tick: found ${unresolved.length} unresolved alert(s), processing...`);
        for (const row of unresolved) {
          const syntheticEvent: TriggerEvent = {
            type: "metric.breach",
            data: {
              owner: row.owner,
              metricId: row.metric_id,
              metricName: row.metricName,
              current: row.current,
              threshold: row.threshold,
              target: row.target,
              message: row.message,
              priority: row.priority,
            },
          };
          // Re-invoke self with synthetic event (inline the logic below)
          await processBreachEvent(ctx, syntheticEvent);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.log(`[metric-alert-reactor] Timer tick DB error: ${msg}`);
      }
      return;
    }

    await processBreachEvent(ctx, event);
  };
};

async function processBreachEvent(ctx: HandlerContext, event: TriggerEvent) {

    const { owner, metricId, metricName, current, threshold, target, message, priority: eventPriority } = event.data as {
      owner: string;
      metricId: string;
      metricName: string;
      current: number;
      threshold: number;
      target: number;
      message: string;
      priority?: string;
    };

    if (!owner || !metricId) {
      ctx.log("[metric-alert-reactor] Missing owner or metricId in event data.");
      return;
    }

    let priority = eventPriority ?? "P2";

    // Only P0 breaches fork immediately. Lower priorities are still visible in
    // heartbeat metric context through the unresolved alert row.
    try {
      const db = ctx.getDb();
      const metricRow = db.prepare("SELECT COALESCE(priority, 'P2') as priority FROM metrics WHERE id = ?").get(metricId) as { priority?: string } | null;
      priority = metricRow?.priority ?? priority;
      if (priority !== "P0") {
        ctx.log(`[metric-alert-reactor] Deferring ${metricId} (${priority}) to heartbeat context.`);
        return;
      }

      // Dedup: check if owner already has a recent session for this metric
      const recentSession = db.prepare(
        `SELECT sessionId FROM sessions
         WHERE agent = ? AND task LIKE ? AND startedAt > ?`
      ).get(owner, `%${metricId}%`, Date.now() - DEDUP_WINDOW_MS) as { sessionId: string } | null;

      if (recentSession) {
        ctx.log(`[metric-alert-reactor] Skipping ${metricId} — ${owner} already has recent session ${recentSession.sessionId}`);
        return;
      }
    } catch {
      if (priority !== "P0") {
        ctx.log(`[metric-alert-reactor] Deferring ${metricId} (${priority}) to heartbeat context.`);
        return;
      }
      // DB unavailable for dedup — proceed for explicit P0 events.
    }

    const task = [
      `[metric-alert][${metricId}][${priority}] ${message}`,
      ``,
      `Your metric "${metricName}" is breaching its threshold.`,
      `  Current: ${current}`,
      `  Threshold: ${threshold}`,
      `  Target: ${target}`,
      ``,
      `You MUST take exactly ONE of these actions:`,
      `1. **Fix the root cause** — change behavior/code so the metric improves`,
      `2. **Adjust the threshold** — if it's unrealistic, run:`,
      `   bun -e "import {Database} from 'bun:sqlite'; const db = new Database('.state/may.db'); db.prepare(\\"UPDATE metrics SET threshold = <new_value> WHERE id = '${metricId}'\\").run();"`,
      `3. **Resolve the alert** — if transient/measurement bug, run:`,
      `   bun -e "import {Database} from 'bun:sqlite'; const db = new Database('.state/may.db'); db.prepare(\\"UPDATE metric_alerts SET resolved_at = ${Date.now()} WHERE metric_id = '${metricId}' AND resolved_at IS NULL\\").run();"`,
      ``,
      `Investigation alone is NOT sufficient. You must take corrective action.`,
    ].join("\n");

    try {
      await ctx.sdk.runAgent(owner, task, { source: `metric-alert-reactor:${metricId}` });
      ctx.log(`[metric-alert-reactor] Ran ${owner} to handle ${metricId}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      ctx.log(`[metric-alert-reactor] Failed to run ${owner}: ${msg}`);
    }
}
