/// <reference path="../../../src/lib/workflow-defs.d.ts" />

import { listConfiguredAgents, resolveMetricOwner } from "../lib/metric-ownership.ts";

export const name = "metric-alert-triage";
export const description = "Judge one metric alert, require a concrete operation, and emit a durable judgment event.";

const OPERATIONS = new Set([
  "fix_root_cause",
  "calibrate_metric",
  "downgrade_priority",
  "upgrade_or_escalate",
  "resolve_stale",
  "document_exception",
  "waiting_with_evidence",
]);
const OPERATION_LIST = [...OPERATIONS];

type Trigger = {
  type?: string;
  data?: Record<string, unknown>;
};

type AlertContext = {
  alert: Record<string, unknown> | null;
  metric: Record<string, unknown> | null;
  snapshots: Array<Record<string, unknown>>;
  relatedEvents: Array<Record<string, unknown>>;
  ownerSessions: Array<Record<string, unknown>>;
  owner: string;
  metricId: string;
  alertId: number | null;
  priority: string;
};

function extractTrigger(task: string): Trigger | null {
  const match = task.match(/## Trigger Event\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as Trigger;
  } catch {
    return null;
  }
}

function triggerData(trigger: Trigger | null): Record<string, unknown> {
  return (trigger?.data ?? trigger ?? {}) as Record<string, unknown>;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function finishResultText(result: TaskResult): string {
  const finish = result.finishResult as Record<string, unknown> | undefined;
  const parts = [
    result.lastAssistantText ?? "",
    typeof finish?.summary === "string" ? finish.summary : "",
    Array.isArray(finish?.verification_evidence) ? finish.verification_evidence.join("\n") : "",
    finish ? JSON.stringify(finish) : "",
  ].filter(Boolean);
  return parts.join("\n");
}

function extractEvidence(text: string, result?: TaskResult): string {
  const explicit = text.match(/METRIC_ALERT_EVIDENCE:\s*([^\n]+)/)?.[1]?.trim();
  if (explicit) return explicit;
  const finish = result?.finishResult as Record<string, unknown> | undefined;
  const summary = typeof finish?.summary === "string" ? finish.summary.trim() : "";
  const evidence = Array.isArray(finish?.verification_evidence)
    ? finish.verification_evidence.map(String).filter(Boolean).join("; ")
    : "";
  return evidence || summary;
}

function parseOperation(text: string, result?: TaskResult): { operation: string | null; evidence: string; nextValidationAt: number | null } {
  const explicitOperation = text.match(/METRIC_ALERT_OPERATION:\s*([a-zA-Z0-9_-]+)/)?.[1]?.trim() ?? null;
  const exactOperation = OPERATION_LIST.find((operation) => new RegExp(`\\b${operation}\\b`).test(text)) ?? null;
  const operation = explicitOperation ?? exactOperation;
  const evidence = extractEvidence(text, result);
  const validation = text.match(/METRIC_ALERT_NEXT_VALIDATION:\s*([^\n]+)/)?.[1]?.trim() ?? "";
  const parsedValidation = Date.parse(validation);
  return {
    operation,
    evidence,
    nextValidationAt: Number.isFinite(parsedValidation) ? parsedValidation : null,
  };
}

function formatRows(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "none";
  return rows.map((row) => `- ${JSON.stringify(row)}`).join("\n");
}

function relatedEventTypes(metricId: string): string[] {
  switch (metricId) {
    case "evaluator.false-good-rate-sample":
      return ["evaluation.false_good", "evaluation.reviewed", "evaluation.success_candidate"];
    case "evaluator.meaningful-review-rate-24h":
      return ["evaluation.routed", "evaluation.reviewed"];
    case "evaluator.triage-closure-rate-24h":
      return ["evaluation.routed", "evaluation.triage_closed", "evaluation.reviewed"];
    case "evaluator.success-candidates-24h":
      return ["evaluation.success_candidate"];
    case "evaluator.success-learnings-24h":
      return ["evaluation.success_candidate", "evaluation.learning_created"];
    default:
      return [];
  }
}

function buildOwnerTask(ctx: AlertContext): string {
  return [
    `[metric-alert-triage] Judge metric alert ${ctx.metricId}.`,
    "",
    "Follow agents/shared/may-agent-docs/manual/metric-alerts.md.",
    "Metrics are signals, not judges. You are responsible for judging the alert using goal/context/facts/theory.",
    "",
    "Choose exactly one final operation:",
    "- fix_root_cause",
    "- calibrate_metric",
    "- downgrade_priority",
    "- upgrade_or_escalate",
    "- resolve_stale",
    "- document_exception",
    "- waiting_with_evidence",
    "",
    "Investigation alone is not a final operation.",
    "A final operation must leave evidence that something concrete changed, was deliberately accepted, or was escalated to the right human/project context.",
    "A queued message to the same owner is not escalation; if the owner can safely change state, use fix_root_cause and do it.",
    "If you use finish(), put the exact operation token in the finish summary, for example: `Choosing upgrade_or_escalate because ...`.",
    "NEVER use to=\"functions.message\" in the message tool — it is NOT an agent. Use real agent names: may, arc, dev, scout, coach.",
    "",
    "## Alert",
    JSON.stringify(ctx.alert, null, 2),
    "",
    "## Metric",
    JSON.stringify(ctx.metric, null, 2),
    "",
    "## Recent Snapshots",
    formatRows(ctx.snapshots),
    "",
    "## Metric Source Events",
    formatRows(ctx.relatedEvents),
    "",
    "## Recent Owner Sessions Since Alert",
    formatRows(ctx.ownerSessions),
    "",
    "End your final response with these exact lines:",
    "METRIC_ALERT_OPERATION: <one operation from the list>",
    "METRIC_ALERT_EVIDENCE: <one sentence with concrete evidence>",
    "METRIC_ALERT_NEXT_VALIDATION: <ISO timestamp or next metrics-snapshot>",
  ].join("\n");
}

function notifyTriageEscalation(ctx: WorkflowContext, metricId: string, reason: string, details?: Record<string, unknown>): void {
  try {
    const suffix = details ? `\n${JSON.stringify(details)}` : "";
    ctx.notify(`Metric alert triage needs attention for ${metricId}: ${reason}${suffix}`);
  } catch {
    // Notification is best-effort; the workflow escalation remains durable.
  }
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const trigger = extractTrigger(String(ctx.task ?? ""));
  const data = triggerData(trigger);
  const metricId = String(data.metricId ?? data.metric_id ?? "");
  if (!metricId) return ctx.escalate("metric-alert-triage requires metricId", { trigger });

  const alertId = numberOrNull(data.alertId ?? data.alert_id);

  const loaded = await ctx.runFunction("load-alert-context", async () => {
    const db = ctx.getDb() as any;
    const configuredAgents = listConfiguredAgents(String(ctx.agentsRoot));
    const metric = db.prepare(
      `SELECT m.id, m.name, m.owner as explicitOwner, p.owner as projectOwner,
              m.current, m.threshold, m.target, COALESCE(m.priority, 'P2') as priority,
              m.project, m.status, m.updated_at
       FROM metrics m
       LEFT JOIN projects p ON m.project IS NOT NULL AND trim(m.project) != ''
         AND (p.id = m.project OR p.path = m.project OR p.name = m.project)
       WHERE m.id = ?`,
    ).get(metricId) as Record<string, unknown> | null;

    const alert = alertId != null
      ? db.prepare(`SELECT * FROM metric_alerts WHERE id = ?`).get(alertId)
      : db.prepare(`SELECT * FROM metric_alerts WHERE metric_id = ? AND resolved_at IS NULL ORDER BY created_at DESC LIMIT 1`).get(metricId);

    const explicitOwner = String(metric?.explicitOwner ?? data.owner ?? "");
    const projectOwner = String(metric?.projectOwner ?? "");
    const owner = resolveMetricOwner(metricId, configuredAgents, explicitOwner, projectOwner);
    const createdAt = Number((alert as Record<string, unknown> | null)?.created_at ?? data.created_at ?? 0);
    const priority = String(metric?.priority ?? data.priority ?? "P2");

    const snapshots = db.prepare(
      `SELECT value, measured_at, note
       FROM metric_snapshots
       WHERE metric_id = ?
       ORDER BY measured_at DESC
       LIMIT 10`,
    ).all(metricId) as Array<Record<string, unknown>>;

    const eventTypes = relatedEventTypes(metricId);
    const relatedEvents = eventTypes.length > 0
      ? db.prepare(
        `SELECT id, event_type, source, owner, timestamp, data
         FROM events
         WHERE timestamp >= ?
           AND event_type IN (${eventTypes.map(() => "?").join(", ")})
         ORDER BY timestamp DESC
         LIMIT 20`,
      ).all(Math.max(0, createdAt || Date.now() - 24 * 60 * 60_000), ...eventTypes) as Array<Record<string, unknown>>
      : [];

    const ownerSessions = db.prepare(
      `SELECT sessionId, status, source, startedAt, endedAt
       FROM sessions
       WHERE agent = ? AND startedAt >= ?
       ORDER BY startedAt DESC
       LIMIT 5`,
    ).all(owner, createdAt || 0) as Array<Record<string, unknown>>;

    return JSON.stringify({
      alert,
      metric,
      snapshots,
      relatedEvents,
      ownerSessions,
      owner,
      metricId,
      alertId: alertId ?? ((alert as Record<string, unknown> | null)?.id ?? null),
      priority,
    });
  });

  if (loaded.status === "error") {
    notifyTriageEscalation(ctx, metricId, "failed to load metric alert context", { error: loaded.error });
    return ctx.escalate(`Failed to load metric alert context for ${metricId}`, { error: loaded.error });
  }

  const alertContext = JSON.parse(String(loaded.lastAssistantText ?? "{}")) as AlertContext;
  const ownerTask = buildOwnerTask(alertContext);
  const ownerResult = await ctx.runAgent(alertContext.owner, ownerTask);

  if (ownerResult.status === "error" || ownerResult.status === "interrupted") {
    notifyTriageEscalation(ctx, metricId, `owner triage session failed (${ownerResult.status})`, {
      owner: alertContext.owner,
      ownerSessionId: ownerResult.sessionId,
    });
    return ctx.escalate(`Owner triage session failed for ${metricId}`, {
      owner: alertContext.owner,
      ownerSessionId: ownerResult.sessionId,
      status: ownerResult.status,
    });
  }

  const ownerResultText = finishResultText(ownerResult);
  const parsed = parseOperation(ownerResultText, ownerResult);
  if (!parsed.operation || !OPERATIONS.has(parsed.operation)) {
    notifyTriageEscalation(ctx, metricId, "owner did not produce a valid METRIC_ALERT_OPERATION", {
      owner: alertContext.owner,
      ownerSessionId: ownerResult.sessionId,
      operation: parsed.operation,
    });
    return ctx.escalate(`Owner triage for ${metricId} did not produce a valid METRIC_ALERT_OPERATION`, {
      owner: alertContext.owner,
      ownerSessionId: ownerResult.sessionId,
      operation: parsed.operation,
      allowed: [...OPERATIONS],
    });
  }

  ctx.emit({
    type: "metric.alert_judged",
    metricId,
    alertId: alertContext.alertId,
    owner: alertContext.owner,
    priority: alertContext.priority,
    operation: parsed.operation,
    evidence: parsed.evidence,
    ownerSessionId: ownerResult.sessionId,
    nextValidationAt: parsed.nextValidationAt,
    workflow: name,
  });

  return ctx.done(`Judged ${metricId}: ${parsed.operation} by ${alertContext.owner} (${ownerResult.sessionId}).`);
}
