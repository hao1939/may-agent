/**
 * metric-alert-reactor — Handler that reacts to metric.breach events.
 *
 * Listens on: metric.breach
 * Action: Forks the owning agent with a clear remediation task.
 *
 * This closes the gap where metric.breach events were emitted but nobody
 * acted on them. The owning agent is given concrete action options
 * (fix root cause, adjust threshold, or resolve alert).
 *
 * Dedup: skips if the owner already has a metric-alert session for this
 * metric within the last 24h.
 */

import type { HandlerContext, HandlerModule, TriggerEvent } from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";

const DEDUP_WINDOW_MS = 4 * 60 * 60 * 1000; // 4h — shorter window so repeated alerts get reacted to faster

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async (event?: TriggerEvent) => {
    if (!event?.data) {
      ctx.log("[metric-alert-reactor] No event data, skipping.");
      return;
    }

    const { owner, metricId, metricName, current, threshold, target, message } = event.data as {
      owner: string;
      metricId: string;
      metricName: string;
      current: number;
      threshold: number;
      target: number;
      message: string;
    };

    if (!owner || !metricId) {
      ctx.log("[metric-alert-reactor] Missing owner or metricId in event data.");
      return;
    }

    // Dedup: check if owner already has a recent session for this metric
    try {
      const db = ctx.getDb();
      const recentSession = db.prepare(
        `SELECT sessionId FROM sessions
         WHERE agent = ? AND task LIKE ? AND startedAt > ?`
      ).get(owner, `%${metricId}%`, Date.now() - DEDUP_WINDOW_MS) as { sessionId: string } | null;

      if (recentSession) {
        ctx.log(`[metric-alert-reactor] Skipping ${metricId} — ${owner} already has recent session ${recentSession.sessionId}`);
        return;
      }
    } catch {
      // DB unavailable — proceed anyway, runAgentTask will handle errors
    }

    const task = [
      `[metric-alert][${metricId}] ⚠️ ${message}`,
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
      await ctx.manager.callAgent(owner, task, {
        source: `metric-alert-reactor:${metricId}`,
        waitForCompletion: false,
      });
      ctx.log(`[metric-alert-reactor] Forked ${owner} to handle ${metricId}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      ctx.log(`[metric-alert-reactor] Failed to fork ${owner}: ${msg}`);
    }
  };
};
