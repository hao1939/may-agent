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

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerModule, TriggerEvent } from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";

const DEDUP_WINDOW_MS = 4 * 60 * 60 * 1000; // 4h — shorter window so repeated alerts get reacted to faster
const DEFAULT_OWNER = "may";

function listConfiguredAgents(agentsRoot: string): Set<string> {
  try {
    return new Set(readdirSync(agentsRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && !entry.name.startsWith(".") && !entry.name.startsWith("_") && entry.name !== "shared" && entry.name !== "gym")
      .map(entry => {
        const agentJson = join(agentsRoot, entry.name, "agent.json");
        if (!existsSync(agentJson)) return null;
        try {
          const config = JSON.parse(readFileSync(agentJson, "utf8")) as { name?: string; disabled?: boolean };
          if (config.disabled) return null;
          return config.name ?? entry.name;
        } catch {
          return entry.name;
        }
      })
      .filter((name): name is string => Boolean(name)));
  } catch {
    return new Set();
  }
}

function resolveMetricOwner(metricId: string, configuredAgents: Set<string>, explicitOwner?: string | null): string {
  if (explicitOwner?.trim()) return explicitOwner.trim();
  const prefix = metricId.split(".")[0];
  return configuredAgents.has(prefix) ? prefix : DEFAULT_OWNER;
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const configuredAgents = listConfiguredAgents(ctx.agentsRoot);

  return async (event?: TriggerEvent) => {
    // If no event (timer tick), poll for unresolved alerts and process each
    if (!event?.data) {
      try {
        const db = ctx.getDb();
        const unresolved = db.prepare(
          `SELECT ma.metric_id, ma.message, m.name as metricName,
                  COALESCE(NULLIF(trim(m.owner), ''), NULLIF(trim(p.owner), ''), ?) as owner,
                  m.threshold, m.target,
                  m.current as current, COALESCE(m.priority, 'P2') as priority
           FROM metric_alerts ma
           JOIN metrics m ON m.id = ma.metric_id
           LEFT JOIN projects p ON m.project IS NOT NULL AND trim(m.project) != ''
             AND (p.id = m.project OR p.path = m.project OR p.name = m.project)
           WHERE ma.resolved_at IS NULL`
        ).all(DEFAULT_OWNER) as Array<{ metric_id: string; message: string; metricName: string; owner: string; threshold: number; target: number; current: number; priority: string }>;

        if (unresolved.length === 0) {
          ctx.log("[metric-alert-reactor] Timer tick: no unresolved alerts.");
          return;
        }
        ctx.log(`[metric-alert-reactor] Timer tick: found ${unresolved.length} unresolved alert(s), processing...`);
        for (const row of unresolved) {
          const syntheticEvent: TriggerEvent = {
            type: "metric.breach",
            data: {
              owner: resolveMetricOwner(row.metric_id, configuredAgents, row.owner),
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
          await processBreachEvent(ctx, syntheticEvent, configuredAgents);
        }
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
                COALESCE(NULLIF(trim(m.owner), ''), NULLIF(trim(p.owner), ''), ?) as owner
         FROM metrics m
         LEFT JOIN projects p ON m.project IS NOT NULL AND trim(m.project) != ''
           AND (p.id = m.project OR p.path = m.project OR p.name = m.project)
         WHERE m.id = ?`
      ).get(DEFAULT_OWNER, metricId) as { priority?: string; owner?: string } | null;
      priority = metricRow?.priority ?? priority;
      owner = resolveMetricOwner(metricId, configuredAgents, metricRow?.owner ?? owner);
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
      await ctx.sdk.runAgent(owner, task, { source: `metric-alert-reactor:${metricId}` });
      ctx.log(`[metric-alert-reactor] Ran ${owner} to handle ${metricId}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      ctx.log(`[metric-alert-reactor] Failed to run ${owner}: ${msg}`);
    }
}
