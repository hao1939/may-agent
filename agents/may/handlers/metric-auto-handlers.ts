/**
 * metric-auto-handlers — Declarative auto-remediation for known recurring metric breaches.
 *
 * This module exports a registry of metrics that have deterministic fixes,
 * plus a runner that checks the registry before falling through to LLM triage.
 *
 * PoC: handles `evaluator.stale-running-session-count` by killing stale sessions.
 *
 * Integration: called from metric-alert-reactor before dispatching triage workflow.
 * If an auto-handler matches and cooldown has elapsed, it runs the action and
 * returns true (suppressing the LLM triage). Otherwise returns false.
 */

import type { HandlerContext } from "@may-agent/sdk";

export interface MetricAutoHandler {
  metricId: string;
  description: string;
  trigger: { op: ">" | "<"; threshold: number };
  cooldownMs: number;
  priorities?: string[];
  action: (ctx: HandlerContext, current: number) => Promise<void>;
}

// In-memory cooldown tracker
const lastFired = new Map<string, number>();

/**
 * Auto-handler registry. Add entries here for metrics with deterministic fixes.
 */
export const AUTO_HANDLER_REGISTRY: MetricAutoHandler[] = [
  {
    metricId: "evaluator.stale-running-session-count",
    description: "Kill sessions running >30min with no recent activity",
    trigger: { op: ">", threshold: 0 },
    cooldownMs: 10 * 60 * 1000, // 10 minutes
    priorities: ["P1", "P2"],
    action: async (ctx: HandlerContext, _current: number) => {
      const STALE_THRESHOLD_MS = 30 * 60 * 1000;
      const cutoff = Date.now() - STALE_THRESHOLD_MS;

      // Query stale running sessions
      const stale = ctx.sdk.db.prepare(`
        SELECT sessionId, agent, task, startedAt
        FROM sessions
        WHERE status = 'running'
          AND startedAt < ?
        ORDER BY startedAt ASC
        LIMIT 10
      `).all(cutoff) as Array<{ sessionId: string; agent: string; task: string; startedAt: number }>;

      if (stale.length === 0) {
        ctx.sdk.log("info", "[metric-auto-handler] No stale sessions found despite metric breach");
        return;
      }

      for (const row of stale) {
        try {
          ctx.sdk.db.prepare(`
            UPDATE sessions SET status = 'failed', endedAt = ?, error = ?
            WHERE sessionId = ? AND status = 'running'
          `).run(Date.now(), "Auto-closed by metric-auto-handler: stale >30min", row.sessionId);

          ctx.sdk.emit("session.completed", {
            sessionId: row.sessionId,
            agent: row.agent,
            status: "failed",
            error: "Auto-closed by metric-auto-handler: stale >30min",
            reason: "stale_auto_handler",
          });

          ctx.sdk.log("info", `[metric-auto-handler] Auto-closed stale session ${row.sessionId} (agent: ${row.agent})`);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          ctx.sdk.log("warn", `[metric-auto-handler] Failed to close ${row.sessionId}: ${msg}`);
        }
      }

      ctx.sdk.emit("metric.auto_handled", {
        metricId: "evaluator.stale-running-session-count",
        handler: "stale-session-reaper",
        sessionsReaped: stale.length,
        sessionIds: stale.map(s => s.sessionId),
      });
    },
  },
];

/**
 * Try to handle a metric breach automatically.
 * Returns true if handled (caller should skip LLM triage), false otherwise.
 */
export function tryAutoHandle(
  ctx: HandlerContext,
  metricId: string,
  current: number,
  priority: string,
): Promise<boolean> {
  const handler = AUTO_HANDLER_REGISTRY.find(h => h.metricId === metricId);
  if (!handler) return Promise.resolve(false);

  // Check priority filter
  if (handler.priorities && !handler.priorities.includes(priority)) {
    return Promise.resolve(false);
  }

  // Check trigger condition
  const breaching = handler.trigger.op === ">"
    ? current > handler.trigger.threshold
    : current < handler.trigger.threshold;
  if (!breaching) return Promise.resolve(false);

  // Check cooldown
  const lastTime = lastFired.get(metricId) ?? 0;
  if (Date.now() - lastTime < handler.cooldownMs) {
    ctx.sdk.log("info", `[metric-auto-handler] ${metricId} cooldown active, skipping`);
    return Promise.resolve(false);
  }

  // Fire the handler
  lastFired.set(metricId, Date.now());
  return handler.action(ctx, current)
    .then(() => {
      ctx.sdk.log("info", `[metric-auto-handler] Successfully auto-handled ${metricId}`);
      return true;
    })
    .catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      ctx.sdk.log("warn", `[metric-auto-handler] Action failed for ${metricId}: ${msg}`);
      return false; // Fall through to LLM triage
    });
}
