/**
 * metric-alert-reactor — Handler that reacts to metric.breach and metric.stalled events.
 *
 * Listens on: metric.breach, metric.stalled
 * Action: Forks the owning agent for P0 breaches. P1/P2 breaches get explicit
 * owner triage after they remain open long enough to need a durable judgment.
 * P3 alerts stay visible through metric alert context and the steward cron.
 *
 * Stall events (metric.stalled) are routed through the same dedup and triage
 * pipeline as breaches, with a distinct task header so stall and breach events
 * for the same metric use separate dedup keys.
 *
 * This keeps important issues auditable while preserving metric-context-based
 * handling for low-priority metric drift.
 *
 * Dedup: skips if the owner already has a metric-alert session for this
 * metric within the last 24h.
 */

import type {
  EventEnvelope,
  HandlerContext,
  HandlerModule,
} from "@may-agent/sdk";
import type { CronEntry } from "@may-agent/sdk";
import {
  listConfiguredAgents,
  resolveMetricOwner,
} from "../../../shared/lib/metric-ownership.ts";
import { tryAutoHandle } from "./metric-auto-handlers.ts";

const DEDUP_WINDOW_MS = 4 * 60 * 60 * 1000; // 4h — shorter window so repeated alerts get reacted to faster
const DIRECT_TRIAGE_AFTER_MS = 10 * 60 * 1000;
const P1_RETRIAGE_COOLDOWN_MS = 15 * 60 * 1000;
const ERROR_SESSION_COOLDOWN_MS = 15 * 60 * 1000; // 15min cooldown after error sessions to prevent amplification loops

function parseJsonObject(
  raw: string | null | undefined,
): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    Number.isFinite(Number(value))
  )
    return Number(value);
  return null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function agentNameFromOwner(owner: string | null): string | null {
  if (!owner) return null;
  return owner.startsWith("agent:") ? owner.slice("agent:".length) : owner;
}

function metricBreachData(event: EventEnvelope): {
  owner?: string;
  payload: Record<string, unknown>;
} {
  return {
    owner: agentNameFromOwner(stringOrNull(event.owner)) ?? undefined,
    payload: event.data,
  };
}

function parseValidationTime(value: unknown): number | null {
  const asNumber = numberOrNull(value);
  if (asNumber != null) return asNumber;
  if (
    typeof value !== "string" ||
    value.trim() === "" ||
    value === "next metrics-snapshot"
  )
    return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isBreaching(
  current: number | null,
  threshold: number | null,
  alertOp: string | null | undefined,
): boolean {
  if (current == null || threshold == null) return false;
  return alertOp === ">" || alertOp === "above"
    ? current > threshold
    : current < threshold;
}

function emitSkip(
  ctx: HandlerContext,
  metricId: string | null,
  reason: string,
  data: Record<string, unknown> = {},
): void {
  ctx.sdk.log("info", `[metric-alert-reactor] ${reason}`);
  ctx.sdk.emit("handler.skipped", {
    handler: "metric-alert-reactor",
    metricId,
    reason,
    ...data,
  });
}

export const create: HandlerModule["create"] = (
  ctx: HandlerContext,
  entry: CronEntry,
) => {
  const configuredAgents = listConfiguredAgents(ctx.sdk.paths.agents);

  return async (event?: EventEnvelope) => {
    const entryName =
      typeof entry?.name === "string" && entry.name
        ? entry.name
        : "metric-alert-reactor";
    const isTriggerScan = event?.type === `trigger.${entryName}`;
    const isTimerScan = event?.type === "timer.tick";
    // If no event, timer tick, or a direct trigger event, poll unresolved
    // alerts and process each. Operators should not need to hand-build a
    // metric.breach payload to kick the default reactor scan.
    if (!event || isTimerScan || isTriggerScan) {
      try {
        const unresolved = ctx.sdk.query.alerts({
          resolved: false,
          limit: 50,
        }).rows;

        if (unresolved.length === 0) {
          emitSkip(ctx, null, "Timer tick: no unresolved alerts.");
          return;
        }
        ctx.sdk.log(
          "info",
          `[metric-alert-reactor] Timer tick: found ${unresolved.length} unresolved alert(s), processing...`,
        );
        const promises = unresolved.map((row) => {
          const metricId = String(row.metric_id ?? "");
          const state = metricId
            ? ctx.sdk.query.metricAlertReactorState({
                metricId,
                alertId: numberOrNull(row.id),
              })
            : null;
          const metric = state?.metric ?? {};
          const owner = resolveMetricOwner(
            metricId,
            configuredAgents,
            stringOrNull(metric.explicitOwner),
            stringOrNull(metric.projectOwner),
          );
          const syntheticEvent: EventEnvelope = {
            type: "metric.breach",
            source: "metric-alert-reactor",
            owner: `agent:${owner}`,
            timestamp: Date.now(),
            data: {
              metricId,
              metricName: String(metric.name ?? metricId),
              project: stringOrNull(metric.project) ?? undefined,
              alertId: numberOrNull(row.id),
              current: numberOrNull(metric.current),
              threshold: numberOrNull(metric.threshold),
              target: numberOrNull(metric.target),
              message: String(row.message ?? ""),
              priority: String(metric.priority ?? "P2"),
            },
          };
          return processAlertEvent(ctx, syntheticEvent, configuredAgents);
        });
        await Promise.allSettled(promises);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        emitSkip(ctx, null, `Timer tick DB error: ${msg}`);
      }
      return;
    }

    await processAlertEvent(ctx, event, configuredAgents);
  };
};

async function processAlertEvent(
  ctx: HandlerContext,
  event: EventEnvelope,
  configuredAgents: Set<string>,
) {
  const normalized = metricBreachData(event);
  const {
    metricId,
    metricName,
    current,
    threshold,
    target,
    message,
    priority: eventPriority,
  } = normalized.payload as {
    owner?: string;
    metricId: string;
    metricName: string;
    current: number;
    threshold: number;
    target: number;
    message: string;
    priority?: string;
  };
  const eventOwner = normalized.owner ?? stringOrNull(normalized.payload.owner);

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
    let state = ctx.sdk.query.metricAlertReactorState({
      metricId,
      owner,
      since,
    });
    let metricRow = state.metric as {
      priority?: string;
      explicitOwner?: string | null;
      projectOwner?: string | null;
      current?: number | null;
      threshold?: number | null;
      alertOp?: string | null;
      status?: string | null;
    } | null;
    if (!metricRow || stringOrNull(metricRow.status) === "retired") {
      emitSkip(
        ctx,
        metricId,
        `Ignoring ${metricId}: metric is missing or retired.`,
        { status: metricRow?.status ?? null },
      );
      return;
    }
    priority = metricRow?.priority ?? priority;
    if (metricRow) {
      const resolvedOwner = resolveMetricOwner(
        metricId,
        configuredAgents,
        stringOrNull(metricRow.explicitOwner),
        stringOrNull(metricRow.projectOwner),
      );
      if (resolvedOwner !== owner) {
        owner = resolvedOwner;
        state = ctx.sdk.query.metricAlertReactorState({
          metricId,
          owner,
          since,
        });
        metricRow = state.metric as typeof metricRow;
      } else {
        owner = resolvedOwner;
      }
    }
    if (priority !== "P0" && priority !== "P1" && priority !== "P2") {
      emitSkip(
        ctx,
        metricId,
        `Deferring ${metricId} (${priority}) to metric context.`,
        { priority },
      );
      return;
    }

    const latestJudgment = state.latestJudgment as {
      id: number;
      data: string | null;
      timestamp: number;
    } | null;
    const routed = state.recentFeedbackRouted as {
      id: number;
      timestamp: number;
      data: string | null;
    } | null;
    const routedAt = numberOrNull(routed?.timestamp);
    if (!latestJudgment && routedAt != null) {
      const routedAge = Date.now() - routedAt;
      if (routedAge < DIRECT_TRIAGE_AFTER_MS) {
        emitSkip(
          ctx,
          metricId,
          `Owner app route receipt ${routed?.id} is ${Math.round(routedAge / 60000)}m old; deferring fallback triage.`,
          {
            priority,
            routedEventId: routed?.id,
            routedAgeMs: routedAge,
          },
        );
        return;
      }
    }

    // P1/P2 alerts: allow a short grace period for heartbeat context, then
    // require an explicit durable judgment so the loop does not stall.
    if (priority === "P1" || priority === "P2") {
      const alertRow = state.alert as {
        id?: number;
        created_at?: number;
      } | null;
      const alertCreatedAt = numberOrNull(alertRow?.created_at);
      const alertAge = alertCreatedAt != null ? Date.now() - alertCreatedAt : 0;
      if (alertAge < DIRECT_TRIAGE_AFTER_MS) {
        emitSkip(
          ctx,
          metricId,
          `${priority} ${metricId} alert age ${Math.round(alertAge / 60000)}m < ${Math.round(DIRECT_TRIAGE_AFTER_MS / 60000)}m, deferring.`,
          { priority, alertAgeMs: alertAge },
        );
        return;
      }
      const judgedEvent = latestJudgment;
      if (judgedEvent) {
        const judgmentData = parseJsonObject(judgedEvent.data);
        const nextValidationAt = parseValidationTime(
          judgmentData.nextValidationAt,
        );
        if (nextValidationAt != null && Date.now() < nextValidationAt) {
          emitSkip(
            ctx,
            metricId,
            `${priority} ${metricId} judged (event ${judgedEvent.id}); waiting for requested validation.`,
            { judgedEventId: judgedEvent.id, nextValidationAt },
          );
          return;
        }

        const latestSnapshot = state.latestSnapshot as {
          value: number | null;
          measured_at: number;
        } | null;
        if (
          !latestSnapshot ||
          latestSnapshot.measured_at <= judgedEvent.timestamp
        ) {
          emitSkip(
            ctx,
            metricId,
            `${priority} ${metricId} judged (event ${judgedEvent.id}); awaiting next metrics snapshot.`,
            { judgedEventId: judgedEvent.id },
          );
          return;
        }
        if (Date.now() - judgedEvent.timestamp < P1_RETRIAGE_COOLDOWN_MS) {
          emitSkip(
            ctx,
            metricId,
            `${priority} ${metricId} judged (event ${judgedEvent.id}); validation cooldown active.`,
            { judgedEventId: judgedEvent.id },
          );
          return;
        }

        const currentValue = numberOrNull(
          latestSnapshot.value ?? metricRow?.current ?? current,
        );
        const thresholdValue = numberOrNull(metricRow?.threshold ?? threshold);
        if (!isBreaching(currentValue, thresholdValue, metricRow?.alertOp)) {
          emitSkip(
            ctx,
            metricId,
            `${priority} ${metricId} judged and latest snapshot is recovered; waiting for alert lifecycle.`,
            { judgedEventId: judgedEvent.id },
          );
          return;
        }
        ctx.sdk.log(
          "info",
          `[metric-alert-reactor] ${priority} ${metricId} still breaching after judgment event ${judgedEvent.id}; rerunning triage.`,
        );
        forceRetriageAfterJudgment = true;
      }
    }

    const recentTriageRun = state.recentTriageRun as {
      runId: string;
      status: string;
      startedAt: number;
    } | null;

    if (recentTriageRun) {
      if (recentTriageRun.status === "running") {
        emitSkip(
          ctx,
          metricId,
          `Skipping ${metricId} — metric-alert-triage already running (${recentTriageRun.runId})`,
          { workflowRunId: recentTriageRun.runId },
        );
        return;
      }
      const judgment = state.recentTriageJudgment as { id: number } | null;
      if (judgment && !forceRetriageAfterJudgment) {
        emitSkip(
          ctx,
          metricId,
          `Skipping ${metricId} — recent triage workflow ${recentTriageRun.runId} emitted judgment ${judgment.id}`,
          {
            workflowRunId: recentTriageRun.runId,
            judgmentEventId: judgment.id,
          },
        );
        return;
      }
      // Cooldown after errored/escalated triage runs to prevent amplification
      if (recentTriageRun.status === "error" || recentTriageRun.status === "escalated") {
        const runAge = Date.now() - recentTriageRun.startedAt;
        if (runAge < ERROR_SESSION_COOLDOWN_MS) {
          emitSkip(
            ctx,
            metricId,
            `Skipping ${metricId} — recent triage run ${recentTriageRun.runId} ${recentTriageRun.status} ${Math.round(runAge / 60000)}m ago; cooldown ${Math.round(ERROR_SESSION_COOLDOWN_MS / 60000)}m`,
            { workflowRunId: recentTriageRun.runId, runAgeMs: runAge },
          );
          return;
        }
      }
    }

    // Dedup: suppress only active metric handling or completed handling that
    // emitted a judgment. A finished session without metric.alert_judged did
    // not close the loop and must not block a still-breaching alert.
    const recentSession = state.recentOwnerSession as {
      sessionId: string;
      status: string;
      startedAt: number;
    } | null;

    if (recentSession) {
      if (recentSession.status === "running") {
        emitSkip(
          ctx,
          metricId,
          `Skipping ${metricId} — ${owner} already has running session ${recentSession.sessionId}`,
          { owner, sessionId: recentSession.sessionId },
        );
        return;
      }
      const judgment = state.recentOwnerSessionJudgment as {
        id: number;
      } | null;
      if (judgment && !forceRetriageAfterJudgment) {
        emitSkip(
          ctx,
          metricId,
          `Skipping ${metricId} — ${owner} already judged it in recent session ${recentSession.sessionId}`,
          {
            owner,
            sessionId: recentSession.sessionId,
            judgmentEventId: judgment.id,
          },
        );
        return;
      }
      // Cooldown after error sessions to prevent amplification loops:
      // During provider outages, triage sessions error immediately (opCount=0),
      // which inflates session.error-rate-6h, which triggers more triage.
      // Wait ERROR_SESSION_COOLDOWN_MS before retrying after an error.
      if (recentSession.status === "error") {
        const errorAge = Date.now() - recentSession.startedAt;
        if (errorAge < ERROR_SESSION_COOLDOWN_MS) {
          emitSkip(
            ctx,
            metricId,
            `Skipping ${metricId} — recent triage session ${recentSession.sessionId} errored ${Math.round(errorAge / 60000)}m ago; cooldown ${Math.round(ERROR_SESSION_COOLDOWN_MS / 60000)}m`,
            { owner, sessionId: recentSession.sessionId, errorAgeMs: errorAge },
          );
          return;
        }
      }
      ctx.sdk.log(
        "info",
        `[metric-alert-reactor] Re-running ${metricId} — recent session ${recentSession.sessionId} ended without judgment`,
      );
    }
  } catch {
    if (priority !== "P0") {
      emitSkip(
        ctx,
        metricId,
        `Deferring ${metricId} (${priority}) to metric context.`,
        { priority, reasonType: "db_unavailable" },
      );
      return;
    }
    // DB unavailable for dedup — proceed for explicit P0 events.
  }

  // --- Auto-handler short-circuit ---
  const currentValue = numberOrNull(current);
  if (currentValue != null) {
    const autoHandled = await tryAutoHandle(
      ctx,
      metricId,
      currentValue,
      priority,
    );
    if (autoHandled) {
      emitSkip(ctx, metricId, `Auto-handled ${metricId} without LLM triage.`, {
        handler: "metric-auto-handler",
        priority,
      });
      return;
    }
  }

  // Determine event type: metric.stalled events get distinct labeling
  const isStallEvent = event.type === "metric.stalled";
  const eventTypeLabel = isStallEvent ? "metric.stalled" : "metric.breach";
  const taskLabel = isStallEvent
    ? "metric stall triage"
    : "metric alert triage";

  const task = [
    `Run ${taskLabel} for ${metricId}.`,
    "",
    "## Trigger Event",
    "```json",
    JSON.stringify(
      {
        type: eventTypeLabel,
        source: "metric-alert-reactor",
        owner: `agent:${owner}`,
        timestamp: Date.now(),
        data: {
          metricId,
          metricName,
          current,
          threshold,
          target,
          message,
          priority,
        },
      },
      null,
      2,
    ),
    "```",
  ].join("\n");

  try {
    const PER_ALERT_TIMEOUT_MS = 240_000; // 4 minutes per alert
    const result = await Promise.race([
      ctx.sdk.runWorkflow("metric-alert-triage", task, { source: "may" }),
      new Promise<never>((_, rej) =>
        setTimeout(
          () =>
            rej(
              new Error(
                `Per-alert timeout (${PER_ALERT_TIMEOUT_MS / 1000}s) for ${metricId}`,
              ),
            ),
          PER_ALERT_TIMEOUT_MS,
        ),
      ),
    ]);
    ctx.sdk.emit("handler.workflow_dispatched", {
      handler: "metric-alert-reactor",
      workflow: "metric-alert-triage",
      metricId,
      owner,
      priority,
      eventType: eventTypeLabel,
      workflowRunId: result.runId ?? null,
      status: result.status,
    });
    ctx.sdk.log(
      "info",
      `[metric-alert-reactor] Ran metric-alert-triage (${eventTypeLabel}) for ${owner} to handle ${metricId}`,
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    ctx.sdk.log(
      "info",
      `[metric-alert-reactor] Failed to run ${owner}: ${msg}`,
    );
  }
}
