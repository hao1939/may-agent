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

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
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

function emitSkip(ctx: HandlerContext, metricId: string | null, reason: string, data: Record<string, unknown> = {}): void {
  ctx.sdk.log("info", `[metric-alert-reactor] ${reason}`);
  ctx.sdk.emit("handler.skipped", {
    handler: "metric-alert-reactor",
    metricId,
    reason,
    ...data,
  });
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const configuredAgents = listConfiguredAgents(ctx.sdk.paths.agents);

  return async (event?: TriggerEvent) => {
    const entryName = typeof entry?.name === "string" && entry.name ? entry.name : "metric-alert-reactor";
    const isTriggerScan = event?.type === `trigger.${entryName}`;
    // If no event, timer tick, or a direct trigger event, poll unresolved
    // alerts and process each. Operators should not need to hand-build a
    // metric.breach payload to kick the default reactor scan.
    if (!event?.data || isTriggerScan) {
      try {
        const unresolved = ctx.sdk.query.alerts({ resolved: false, limit: 50 }).rows;

        if (unresolved.length === 0) {
          emitSkip(ctx, null, "Timer tick: no unresolved alerts.");
          return;
        }
        ctx.sdk.log("info", `[metric-alert-reactor] Timer tick: found ${unresolved.length} unresolved alert(s), processing...`);
        const promises = unresolved.map((row) => {
          const metricId = String(row.metric_id ?? "");
          const state = metricId ? ctx.sdk.query.metricAlertReactorState({ metricId, alertId: numberOrNull(row.id) }) : null;
          const metric = state?.metric ?? {};
          const syntheticEvent: TriggerEvent = {
            type: "metric.breach",
            data: {
              owner: resolveMetricOwner(metricId, configuredAgents, stringOrNull(metric.explicitOwner), stringOrNull(metric.projectOwner)),
              metricId,
              metricName: String(metric.name ?? metricId),
              current: numberOrNull(metric.current),
              threshold: numberOrNull(metric.threshold),
              target: numberOrNull(metric.target),
              message: String(row.message ?? ""),
              priority: String(metric.priority ?? "P2"),
            },
          };
          return processBreachEvent(ctx, syntheticEvent, configuredAgents);
        });
        await Promise.allSettled(promises);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        emitSkip(ctx, null, `Timer tick DB error: ${msg}`);
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
      emitSkip(ctx, null, "Missing metricId in event data.");
      return;
    }

    let owner = resolveMetricOwner(metricId, configuredAgents, eventOwner);
    let priority = eventPriority ?? "P2";
    let forceRetriageAfterJudgment = false;

    // P0 alerts get an immediate explicit owner session so handling is auditable.
    // P1/P2 alerts get explicit triage after a short grace period. P3 remains
    // visible in metric context only.
    try {
      const since = Date.now() - DEDUP_WINDOW_MS;
      let state = ctx.sdk.query.metricAlertReactorState({ metricId, owner, since });
      let metricRow = state.metric as { priority?: string; explicitOwner?: string | null; projectOwner?: string | null; current?: number | null; threshold?: number | null; alertOp?: string | null } | null;
      priority = metricRow?.priority ?? priority;
      if (metricRow) {
        const resolvedOwner = resolveMetricOwner(metricId, configuredAgents, stringOrNull(metricRow.explicitOwner), stringOrNull(metricRow.projectOwner));
        if (resolvedOwner !== owner) {
          owner = resolvedOwner;
          state = ctx.sdk.query.metricAlertReactorState({ metricId, owner, since });
          metricRow = state.metric as typeof metricRow;
        } else {
          owner = resolvedOwner;
        }
      }
      if (priority !== "P0" && priority !== "P1" && priority !== "P2") {
        emitSkip(ctx, metricId, `Deferring ${metricId} (${priority}) to metric context.`, { priority });
        return;
      }

      // P1/P2 alerts: allow a short grace period for heartbeat context, then
      // require an explicit durable judgment so the loop does not stall.
      if (priority === "P1" || priority === "P2") {
        const alertRow = state.alert as { id?: number; created_at?: number } | null;
        const alertCreatedAt = numberOrNull(alertRow?.created_at);
        const alertAge = alertCreatedAt != null ? Date.now() - alertCreatedAt : 0;
        if (alertAge < DIRECT_TRIAGE_AFTER_MS) {
          emitSkip(ctx, metricId, `${priority} ${metricId} alert age ${Math.round(alertAge/60000)}m < ${Math.round(DIRECT_TRIAGE_AFTER_MS / 60000)}m, deferring.`, { priority, alertAgeMs: alertAge });
          return;
        }
        const judgedEvent = state.latestJudgment as { id: number; data: string | null; timestamp: number } | null;
        if (judgedEvent) {
          const judgmentData = parseJsonObject(judgedEvent.data);
          const nextValidationAt = parseValidationTime(judgmentData.nextValidationAt);
          if (nextValidationAt != null && Date.now() < nextValidationAt) {
            emitSkip(ctx, metricId, `${priority} ${metricId} judged (event ${judgedEvent.id}); waiting for requested validation.`, { judgedEventId: judgedEvent.id, nextValidationAt });
            return;
          }

          const latestSnapshot = state.latestSnapshot as { value: number | null; measured_at: number } | null;
          if (!latestSnapshot || latestSnapshot.measured_at <= judgedEvent.timestamp) {
            emitSkip(ctx, metricId, `${priority} ${metricId} judged (event ${judgedEvent.id}); awaiting next metrics snapshot.`, { judgedEventId: judgedEvent.id });
            return;
          }
          if (Date.now() - judgedEvent.timestamp < P1_RETRIAGE_COOLDOWN_MS) {
            emitSkip(ctx, metricId, `${priority} ${metricId} judged (event ${judgedEvent.id}); validation cooldown active.`, { judgedEventId: judgedEvent.id });
            return;
          }

          const currentValue = numberOrNull(latestSnapshot.value ?? metricRow?.current ?? current);
          const thresholdValue = numberOrNull(metricRow?.threshold ?? threshold);
          if (!isBreaching(currentValue, thresholdValue, metricRow?.alertOp)) {
            emitSkip(ctx, metricId, `${priority} ${metricId} judged and latest snapshot is recovered; waiting for alert lifecycle.`, { judgedEventId: judgedEvent.id });
            return;
          }
          ctx.sdk.log("info", `[metric-alert-reactor] ${priority} ${metricId} still breaching after judgment event ${judgedEvent.id}; rerunning triage.`);
          forceRetriageAfterJudgment = true;
        }
      }

      const recentTriageRun = state.recentTriageRun as { runId: string; status: string; startedAt: number } | null;

      if (recentTriageRun) {
        if (recentTriageRun.status === "running") {
          emitSkip(ctx, metricId, `Skipping ${metricId} — metric-alert-triage already running (${recentTriageRun.runId})`, { workflowRunId: recentTriageRun.runId });
          return;
        }
        const judgment = state.recentTriageJudgment as { id: number } | null;
        if (judgment && !forceRetriageAfterJudgment) {
          emitSkip(ctx, metricId, `Skipping ${metricId} — recent triage workflow ${recentTriageRun.runId} emitted judgment ${judgment.id}`, { workflowRunId: recentTriageRun.runId, judgmentEventId: judgment.id });
          return;
        }
      }

      // Dedup: suppress only active metric handling or completed handling that
      // emitted a judgment. A finished session without metric.alert_judged did
      // not close the loop and must not block a still-breaching alert.
      const recentSession = state.recentOwnerSession as { sessionId: string; status: string; startedAt: number } | null;

      if (recentSession) {
        if (recentSession.status === "running") {
          emitSkip(ctx, metricId, `Skipping ${metricId} — ${owner} already has running session ${recentSession.sessionId}`, { owner, sessionId: recentSession.sessionId });
          return;
        }
        const judgment = state.recentOwnerSessionJudgment as { id: number } | null;
        if (judgment && !forceRetriageAfterJudgment) {
          emitSkip(ctx, metricId, `Skipping ${metricId} — ${owner} already judged it in recent session ${recentSession.sessionId}`, { owner, sessionId: recentSession.sessionId, judgmentEventId: judgment.id });
          return;
        }
        ctx.sdk.log("info", `[metric-alert-reactor] Re-running ${metricId} — recent session ${recentSession.sessionId} ended without judgment`);
      }
    } catch {
      if (priority !== "P0") {
        emitSkip(ctx, metricId, `Deferring ${metricId} (${priority}) to metric context.`, { priority, reasonType: "db_unavailable" });
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
      const result = await Promise.race([
        ctx.sdk.runWorkflow("metric-alert-triage", task, { source: owner }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`Per-alert timeout (${PER_ALERT_TIMEOUT_MS / 1000}s) for ${metricId}`)), PER_ALERT_TIMEOUT_MS)),
      ]);
      ctx.sdk.emit("handler.workflow_dispatched", {
        handler: "metric-alert-reactor",
        workflow: "metric-alert-triage",
        metricId,
        owner,
        priority,
        workflowRunId: result.runId ?? null,
        status: result.status,
      });
      ctx.sdk.log("info", `[metric-alert-reactor] Ran metric-alert-triage for ${owner} to handle ${metricId}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      ctx.sdk.log("info", `[metric-alert-reactor] Failed to run ${owner}: ${msg}`);
    }
}
