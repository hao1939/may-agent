/**
 * closed-loop-steward — recurring may-owned audit of the metric/action loop.
 *
 * The cron schedule is static; the work context is not. Each run builds a
 * fresh brief from DB state so may can judge whether red metrics and delivery
 * failures are moving toward closure.
 */

import type { CronEntry, HandlerContext, HandlerModule } from "@may-agent/sdk";
import { listConfiguredAgents, resolveMetricOwner } from "../../../shared/lib/metric-ownership.ts";

type Config = {
  lookbackMs?: number;
  alertLimit?: number;
  deliveryFailureLimit?: number;
  triageLimit?: number;
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
  alertOp: string | null;
};

type SessionRow = {
  sessionId: string;
  status: string;
  source: string | null;
  startedAt: number;
  endedAt: number | null;
};

type WorkflowRunRow = {
  runId: string;
  status: string;
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

type SnapshotRow = {
  value: number | null;
  measured_at: number | null;
};

type AlertContextRow = {
  alert: AlertRow;
  latestJudgment: JudgmentRow | null;
  latestSnapshot: SnapshotRow | null;
  activeTriageRun: { runId: string; status?: string; startedAt?: number } | null;
};

const DEFAULT_LOOKBACK_MS = 6 * 60 * 60_000;
const DEFAULT_ALERT_LIMIT = 12;
const DEFAULT_DELIVERY_FAILURE_LIMIT = 12;
const DEFAULT_TRIAGE_LIMIT = 3;
const RETRIAGE_COOLDOWN_MS = 15 * 60_000;

function emitSkip(ctx: HandlerContext, reason: string, data: Record<string, unknown> = {}): void {
  ctx.sdk.log("info", `[closed-loop-steward] ${reason}`);
  try {
    ctx.sdk.emit("handler.skipped", {
      handler: "closed-loop-steward",
      reason,
      ...data,
    });
  } catch { /* best-effort */ }
}

function age(now: number, timestamp?: number | null): string {
  if (!timestamp) return "unknown";
  const minutes = Math.max(0, Math.round((now - timestamp) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

function parseEventData(row: EventRow): Record<string, unknown> {
  return parseJsonData(row.data);
}

function parseJsonData(data: string | null | undefined): Record<string, unknown> {
  try {
    return data ? JSON.parse(data) as Record<string, unknown> : {};
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

function summarizeWorkflowRuns(runs: WorkflowRunRow[], now: number): string {
  if (runs.length === 0) return "none";
  return runs
    .map((run) => `${run.runId}:${run.status}:${age(now, run.startedAt)} ago`)
    .join("; ");
}

function isBreaching(current: number | null, threshold: number | null, alertOp: string | null): boolean {
  if (current == null || threshold == null) return false;
  return alertOp === ">" || alertOp === "above" ? current > threshold : current < threshold;
}

function buildTriageTask(alert: AlertRow, owner: string, reason: string): string {
  return [
    `Run metric alert triage for ${alert.metric_id}.`,
    "",
    `Reason: ${reason}.`,
    "",
    "## Trigger Event",
    "```json",
    JSON.stringify({
      type: "metric.breach",
      source: "closed-loop-steward",
      owner: `agent:${owner}`,
      timestamp: Date.now(),
      data: {
        alertId: alert.id,
        metricId: alert.metric_id,
        metricName: alert.metricName ?? alert.metric_id,
        current: alert.current,
        threshold: alert.threshold,
        target: alert.target,
        message: alert.message,
        priority: alert.priority ?? "P2",
      },
    }, null, 2),
    "```",
  ].join("\n");
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const config = (entry.handlerConfig ?? {}) as Config;
  const lookbackMs = config.lookbackMs ?? DEFAULT_LOOKBACK_MS;
  const alertLimit = config.alertLimit ?? DEFAULT_ALERT_LIMIT;
  const deliveryFailureLimit = config.deliveryFailureLimit ?? DEFAULT_DELIVERY_FAILURE_LIMIT;
  const triageLimit = config.triageLimit ?? DEFAULT_TRIAGE_LIMIT;
  const configuredAgents = listConfiguredAgents(ctx.sdk.paths.agents);

  return async () => {
    const context = ctx.sdk.query.closedLoopStewardContext({
      lookbackMs,
      alertLimit,
      deliveryFailureLimit,
    });
    const now = context.now;
    const schemaBrief = context.schemaBrief;
    const running = context.runningStewardRun as { runId: string } | null;
    if (running) {
      emitSkip(ctx, `Skip: prior steward workflow still running (${running.runId}).`, { workflowRunId: running.runId });
      return;
    }

    const alertContexts = context.alerts as unknown as AlertContextRow[];
    const failures = context.deliveryFailures as unknown as EventRow[];

    if (alertContexts.length === 0 && failures.length === 0) {
      emitSkip(ctx, "Skip: no open metric alerts or recent delivery failures.");
      return;
    }

    const triageCandidates: Array<{ alert: AlertRow; owner: string; reason: string }> = [];

    const alertLines = alertContexts.map(({ alert, latestJudgment: judgment, latestSnapshot, activeTriageRun }) => {
      const owner = resolveMetricOwner(alert.metric_id, configuredAgents, alert.explicitOwner, alert.projectOwner);
      const ownerSessions = ctx.sdk.query.sessions({
        agent: owner,
        since: alert.created_at ?? 0,
        limit: 3,
      }).rows as unknown as SessionRow[];
      const judgmentData = judgment ? parseJsonData(judgment.data) : null;
      const validatedAfterJudgment = !!judgment && !!latestSnapshot?.measured_at && latestSnapshot.measured_at > judgment.timestamp;
      const stillBreaching = isBreaching(
        latestSnapshot?.value ?? alert.current,
        alert.threshold,
        alert.alertOp,
      );
      const validationLine = judgmentData
        ? validatedAfterJudgment
          ? `  validation: ${stillBreaching ? "still breaching after judgment" : "latest snapshot is in range"} (snapshot age=${age(now, latestSnapshot?.measured_at)})`
          : `  validation: awaiting a newer metrics snapshot after judgment`
        : `  validation: no judgment to validate`;
      const priority = alert.priority ?? "P2";
      if ((priority === "P0" || priority === "P1" || priority === "P2") && !activeTriageRun) {
        if (!judgmentData) {
          triageCandidates.push({ alert, owner, reason: "missing metric.alert_judged event" });
        } else if (
          validatedAfterJudgment &&
          stillBreaching &&
          judgment &&
          now - judgment.timestamp >= RETRIAGE_COOLDOWN_MS
        ) {
          triageCandidates.push({ alert, owner, reason: "still breaching after latest judgment validation" });
        }
      }

      return [
        `- alert#${alert.id} metric=${alert.metric_id} priority=${alert.priority ?? "P2"} owner=${owner} age=${age(now, alert.created_at)}`,
        `  current=${alert.current ?? "unknown"} threshold=${alert.threshold ?? "unknown"} target=${alert.target ?? "unknown"}`,
        `  message=${alert.message}`,
        `  owner activity since alert: ${summarizeSessions(ownerSessions, now)}`,
        judgmentData
          ? `  latest judgment: operation=${String(judgmentData.operation ?? "unknown")} session=${String(judgmentData.ownerSessionId ?? "unknown")} age=${age(now, judgment?.timestamp)} evidence=${String(judgmentData.evidence ?? "").slice(0, 220)}`
          : `  latest judgment: none recorded (no metric.alert_judged event)`,
        validationLine,
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

    const recentStewardRuns = context.recentStewardRuns as unknown as WorkflowRunRow[];

    const routedTriageCandidates = triageCandidates.slice(0, triageLimit);
    for (const candidate of routedTriageCandidates) {
      const task = buildTriageTask(candidate.alert, candidate.owner, candidate.reason);
      ctx.sdk.runWorkflow("metric-alert-triage", task, { source: "may" })
        .then((result) => {
          ctx.sdk.log("info", `[closed-loop-steward] Routed ${candidate.alert.metric_id} to metric-alert-triage for ${candidate.owner}: ${String((result as any)?.status ?? "done")}`);
          ctx.sdk.emit("handler.workflow_dispatched", {
            handler: "closed-loop-steward",
            workflow: "metric-alert-triage",
            metricId: candidate.alert.metric_id,
            alertId: candidate.alert.id,
            source: candidate.owner,
            owner: candidate.owner,
            workflowRunId: result.runId ?? null,
            status: result.status,
            reason: candidate.reason,
          });
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          ctx.sdk.log("info", `[closed-loop-steward] Failed to route ${candidate.alert.metric_id}: ${msg.slice(0, 200)}`);
          ctx.sdk.emit("handler.failed", {
            handler: "closed-loop-steward",
            agent: ctx.agentName,
            workflow: "metric-alert-triage",
            metricId: candidate.alert.metric_id,
            alertId: candidate.alert.id,
            error: msg.slice(0, 200),
            durationMs: 0,
          });
        });
    }

    const routedTriageLines = routedTriageCandidates.map((candidate) => (
      `- ${candidate.alert.metric_id} owner=${candidate.owner} reason=${candidate.reason}`
    ));

    const routedAlertIds = new Set(routedTriageCandidates.map((candidate) => candidate.alert.id));
    const remainingActionableAlerts = alertContexts.filter(({ alert }) => {
      const priority = alert.priority ?? "P2";
      if (priority === "P3") return false;
      return !routedAlertIds.has(alert.id);
    });

    if (remainingActionableAlerts.length === 0 && failures.length === 0) {
      emitSkip(
        ctx,
        `Skip: no remaining steward action after routing ${routedTriageCandidates.length} alert(s); ${alertContexts.length - routedTriageCandidates.length} remaining alert(s) are monitor-only P3/no-op cases and there are no delivery failures.`,
        {
          routedTriageCount: routedTriageCandidates.length,
          routedAlertIds: [...routedAlertIds],
          remainingAlertCount: alertContexts.length - routedTriageCandidates.length,
        },
      );
      return;
    }

    const task = [
      "[cron:closed-loop-steward] Audit whether red metrics and failed deliveries are moving toward closure.",
      "",
      "You own the global closed loop, not every metric. The generated context below is workflow-collected live evidence.",
      "The handler has already collected live alert/delivery context below so you should not need exploratory SQL for routine audit decisions.",
      "Use query_db only when the context is missing or internally inconsistent.",
      "If you do need SQL, use the injected schema and safe-query examples below; do not guess runtime DB column names.",
      "If the context lacks a fact this audit needs, record that as a handler data-collection gap so the next run can be fixed to inject it.",
      "",
      "Mental model: project carries goal/context; metrics are signals; cron/events trigger reassessment; agents judge and act.",
      "",
      "Rules:",
      "- Prefer native ownership: metrics.owner, then project.owner, then agent-name prefix, then may fallback.",
      "- Treat metric.alert_judged as the durable record that the owner judged an alert.",
      "- A judgment is not closure. The handler has already routed P0/P1/P2 alerts that need triage; do not hand-roll metric.alert_judged events.",
      "- Never attempt direct DB writes from bash/node/sqlite during this audit. query_db is read-only; if a state change is needed, route/escalate or fix the handler/workflow code instead of improvising DB/event writes.",
      "- If routing itself is wrong, fix this handler or the workflow instead of asking an agent to improvise DB/event writes.",
      "- Take the smallest operation that advances closure: route/nudge owner, fix broken ownership/routing, document a valid exception, or escalate when blocked.",
      "- For every open alert, name the issue, owner, judgment, action taken, and next validation signal. If an alert is still breaching after a prior judgment, do not conclude 'no action' from owner activity alone; either record a valid exception with evidence, route/nudge the owner, or describe the concrete blocker/data gap.",
      "- Recent owner activity is context, not closure evidence. Closure evidence is a resolved alert, an in-range latest snapshot, a newer metric.alert_judged event with a validation plan, or a specific action/escalation you take this run.",
      "- Do not create a project for this cron itself. Create/update a project only when you discover systemic implementation work that cannot be completed in this run.",
      "- If this recurring procedure is wrong or stale, improve the handler/cron/config directly and verify it.",
      "- Finish hygiene: before finish(success), read back every edited file, run `cd /app && git status --short`, classify every dirty path, stage only intentional deliverables with explicit paths, and never commit unrelated dirty files just to satisfy the guard.",
      "- If unrelated or unsafe dirty paths remain, finish(partial/blocked) with the exact path and owner/escalation needed instead of opportunistically committing them.",
      "- After any commit, re-run `cd /app && git status --short`; success requires a clean app worktree or an explicit blocker, and verification_evidence must cite the clean-status check plus commit id.",
      "- End with: issue, owner, judgment, action taken, next validation signal.",
      "",
      "## Runtime DB Schema (safe query reference)",
      ...schemaBrief,
      "",
      "## Safe Query Examples",
      "- Inspect a table schema before querying an unfamiliar field: `PRAGMA table_info(metrics);`",
      "- Recent sessions: `SELECT sessionId, agent, status, source, startedAt, endedAt, error FROM sessions ORDER BY startedAt DESC LIMIT 5;`",
      "- Recent message failures: `SELECT id, source, owner, data, timestamp FROM events WHERE event_type='message.delivery_failed' ORDER BY timestamp DESC LIMIT 5;`",
      "- Metric alert context: `SELECT ma.id, ma.metric_id, m.name, m.owner, ma.message, ma.created_at FROM metric_alerts ma LEFT JOIN metrics m ON m.id = ma.metric_id WHERE ma.resolved_at IS NULL ORDER BY ma.created_at DESC LIMIT 5;`",
      "",
      "## Open Metric Alerts",
      alertLines.length ? alertLines.join("\n") : "none",
      "",
      "## Recent Message Delivery Failures",
      failureLines.length ? failureLines.join("\n") : "none",
      "",
      "## Recent Steward Runs",
      summarizeWorkflowRuns(recentStewardRuns, now),
      "",
      "## Routed Triage This Run",
      routedTriageLines.length ? routedTriageLines.join("\n") : "none",
    ].join("\n");

    try {
      ctx.sdk.runWorkflow("closed-loop-steward", task, { source: "may" })
        .then((result) => {
          ctx.sdk.log("info", `[closed-loop-steward] Workflow completed for ${alertContexts.length} alert(s), ${failures.length} delivery failure(s): ${result.status}${result.runId ? ` (${result.runId})` : ""}`);
          ctx.sdk.emit("handler.workflow_dispatched", {
            handler: "closed-loop-steward",
            workflow: "closed-loop-steward",
            source: "may",
            workflowRunId: result.runId ?? null,
            status: result.status,
            alertCount: alertContexts.length,
            deliveryFailureCount: failures.length,
          });
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          ctx.sdk.log("info", `[closed-loop-steward] Workflow failed: ${msg.slice(0, 200)}`);
          ctx.sdk.emit("handler.failed", {
            handler: "closed-loop-steward",
            agent: ctx.agentName,
            workflow: "closed-loop-steward",
            error: msg.slice(0, 200),
            durationMs: 0,
          });
        });
      ctx.sdk.log("info", `[closed-loop-steward] Dispatched workflow with ${alertContexts.length} alert(s), ${failures.length} delivery failure(s).`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.sdk.log("info", `[closed-loop-steward] Failed to dispatch workflow: ${msg.slice(0, 200)}`);
    }
  };
};
