import type { TaskResult, WorkflowContext, WorkflowResult } from "@may-agent/sdk";

import { listConfiguredAgents, resolveMetricOwner } from "@may-agent/sdk";

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
  owner?: string;
  data?: Record<string, unknown>;
};

type TriggerPayload = {
  owner?: string;
  data: Record<string, unknown>;
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

type ProjectMetricFinding = {
  projectId: string;
  projectPath: string;
  codes: string[];
  projectPolicy?: string;
};

function extractTrigger(task: string): Trigger | null {
  // The trigger event JSON is always appended at the END of the task text
  // by the SDK's appendEvent(). When the task text itself contains nested
  // markdown fences (common in heartbeat/owner-loop prompts that embed
  // full agent instructions), regex-based extraction fails because lazy
  // [\s\S]*? stops at the first internal ``` instead of the real closing
  // fence.
  //
  // Strategy: find the LAST "## Trigger Event" header, then find the LAST
  // closing ``` fence. The JSON lives between the opening ```json and that
  // closing fence.
  const headerPattern = "## Trigger Event";
  const lastHeaderIdx = task.lastIndexOf(headerPattern);
  if (lastHeaderIdx === -1) return null;

  const afterHeader = task.slice(lastHeaderIdx + headerPattern.length);
  const jsonFenceStart = afterHeader.indexOf("```json");
  if (jsonFenceStart === -1) return null;

  const jsonStart = jsonFenceStart + 7; // length of "```json"
  const remaining = afterHeader.slice(jsonStart);

  // Find the LAST closing ``` fence in the remaining text (the one the SDK appended)
  const lastClosingFence = remaining.lastIndexOf("```");
  if (lastClosingFence === -1) return null;

  const jsonText = remaining.slice(0, lastClosingFence).trim();
  if (!jsonText) return null;

  try {
    return JSON.parse(jsonText) as Trigger;
  } catch {
    return null;
  }
}

function triggerData(trigger: Trigger | null): Record<string, unknown> {
  return (trigger?.data ?? trigger ?? {}) as Record<string, unknown>;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function agentNameFromOwner(owner: string | undefined): string | undefined {
  if (!owner) return undefined;
  return owner.startsWith("agent:") ? owner.slice("agent:".length) : owner;
}

function triggerPayload(trigger: Trigger | null): TriggerPayload {
  const data = triggerData(trigger);
  return {
    owner: agentNameFromOwner(optionalString(trigger?.owner)),
    data,
  };
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

function compactText(value: unknown, limit = 300): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}

function compactOwnerSessions(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return rows.map((row) => ({
    sessionId: row.sessionId,
    agent: row.agent,
    status: row.status,
    source: row.source,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    error: compactText(row.error, 200),
    taskPreview: compactText(row.task, 240),
  }));
}

function relatedEventTypes(metricId: string): string[] {
  switch (metricId) {
    case "project.health.finding-count":
    case "project.owner-judgment-needed-count":
    case "project.owner-incomplete-count":
      return ["project.health.finding", "project.owner.incomplete", "project.owner.dispatched", "project.owner.finished"];
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

function projectPathFromId(projectId: string): string {
  const slug = projectId.split("/").pop()?.trim();
  return slug ? `projects/${slug}` : projectId;
}

function projectFindingFromRaw(raw: unknown): ProjectMetricFinding | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const projectId = typeof row.projectId === "string" && row.projectId.trim() ? row.projectId.trim() : "";
  if (!projectId) return null;
  const projectPath = typeof row.projectPath === "string" && row.projectPath.trim()
    ? row.projectPath.trim()
    : projectPathFromId(projectId);
  const rawCodes = Array.isArray(row.codes) ? row.codes : [];
  const codes = rawCodes.map(String).filter(Boolean);
  return {
    projectId,
    projectPath,
    codes,
    projectPolicy: typeof row.projectPolicy === "string" ? row.projectPolicy : undefined,
  };
}

function projectFindingsFromSnapshots(snapshots: Array<Record<string, unknown>>): ProjectMetricFinding[] {
  const findings = new Map<string, ProjectMetricFinding>();
  for (const snapshot of snapshots) {
    const note = typeof snapshot.note === "string" ? snapshot.note : "";
    if (!note.trim()) continue;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(note) as Record<string, unknown>;
    } catch {
      continue;
    }
    const rawFindings = Array.isArray(parsed.findings) ? parsed.findings : [];
    for (const rawFinding of rawFindings) {
      const finding = projectFindingFromRaw(rawFinding);
      if (finding && !findings.has(finding.projectId)) findings.set(finding.projectId, finding);
    }
    if (findings.size > 0) break;
  }
  return [...findings.values()];
}

function projectMetricOperation(metricId: string): string | null {
  if (
    metricId === "project.health.finding-count"
    || metricId === "project.owner-judgment-needed-count"
    || metricId === "project.owner-incomplete-count"
  ) return "fix_root_cause";
  return null;
}

function routeProjectMetricAlert(ctx: WorkflowContext, alertContext: AlertContext): WorkflowResult | null {
  if (!projectMetricOperation(alertContext.metricId)) return null;

  const findings = projectFindingsFromSnapshots(alertContext.snapshots);
  const routable = findings.filter((finding) =>
    alertContext.metricId !== "project.owner-judgment-needed-count"
    || finding.codes.includes("owner_judgment_needed")
  );
  if (routable.length === 0) return null;

  ctx.emit({
    type: "metric.alert_judged",
    metricId: alertContext.metricId,
    alertId: alertContext.alertId,
    owner: alertContext.owner,
    priority: alertContext.priority,
    operation: "waiting_with_evidence",
    evidence: `Project health metric events are routed directly to the project reconciler; observed ${routable.length} affected project(s): ${routable.map((finding) => finding.projectId).join(", ")}.`,
    ownerSessionId: null,
    nextValidationAt: "next metrics-snapshot",
    workflow: name,
  });

  return ctx.done(`Project metric ${alertContext.metricId} is handled by project event routing for ${routable.length} project(s).`);
}

function buildOwnerTask(ctx: AlertContext): string {
  return [
    `[metric-alert-triage] Judge metric alert ${ctx.metricId}.`,
    "",
    "Follow shared/may-agent-docs/manual/metric-alerts.md.",
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
    "Note: `taskPreview` below is synthesized from `sessions.task` for compact context. If you query the DB directly, use the real `task` column, not `taskPreview`.",
    formatRows(ctx.ownerSessions),
    "",
    "Finish hygiene before any successful finish:",
    "1. Call read() on every file you wrote or edited; shell cat/head/grep does not satisfy the read-back guard.",
    "2. Run `cd /app && git status --short` and classify every dirty path before committing.",
    "3. Stage only intentional deliverables with explicit paths; never use broad `git add .` or stage unrelated agent/runtime work. If an intentional deliverable is under the ignored canonical `projects/` tree, use `git add -f <that exact path>` and explain why.",
    "4. If a dirty path is unrelated or unsafe to clean, do not commit it just to satisfy the guard. finish(partial/blocked) and name the exact path plus owner/escalation needed.",
    "5. After committing, re-run `cd /app && git status --short`; success requires a clean app worktree or an explicit blocker.",
    "6. In finish(success), cite the commit id, clean-status check, and read-back evidence.",
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
  const payload = triggerPayload(trigger);
  const data = payload.data;
  const metricId = String(data.metricId ?? data.metric_id ?? "");
  if (!metricId) return ctx.escalate("metric-alert-triage requires metricId", { trigger });

  const alertId = numberOrNull(data.alertId ?? data.alert_id);

  const loaded = await ctx.runFunction("load-alert-context", async () => {
    const configuredAgents = listConfiguredAgents(String(ctx.agentsRoot));
    const context = ctx.query.metricAlertContext({
      metricId,
      alertId,
      relatedEventTypes: relatedEventTypes(metricId),
    }) as Record<string, unknown>;
    const metric = context.metric as Record<string, unknown> | null;
    const alert = context.alert as Record<string, unknown> | null;

    const explicitOwner = String(metric?.explicitOwner ?? payload.owner ?? "");
    const projectOwner = String(metric?.projectOwner ?? "");
    const owner = resolveMetricOwner(metricId, configuredAgents, explicitOwner, projectOwner);
    const createdAt = Number(alert?.created_at ?? data.created_at ?? 0);
    const priority = String(metric?.priority ?? data.priority ?? "P2");

    const ownerSessions = ctx.query.sessions({
      agent: owner,
      since: createdAt || 0,
      limit: 5,
    }).rows as Array<Record<string, unknown>>;

    return JSON.stringify({
      alert,
      metric,
      snapshots: context.snapshots,
      relatedEvents: context.relatedEvents,
      ownerSessions: compactOwnerSessions(ownerSessions),
      owner,
      metricId,
      alertId: context.alertId ?? alertId ?? alert?.id ?? null,
      priority,
    });
  });

  if (loaded.status === "error") {
    notifyTriageEscalation(ctx, metricId, "failed to load metric alert context", { error: loaded.error });
    return ctx.escalate(`Failed to load metric alert context for ${metricId}`, { error: loaded.error });
  }

  let alertContext: AlertContext;
  try {
    alertContext = JSON.parse(String(loaded.lastAssistantText ?? "{}")) as AlertContext;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    notifyTriageEscalation(ctx, metricId, "failed to parse compact metric alert context", { error: msg });
    return ctx.escalate(`Failed to parse metric alert context for ${metricId}`, {
      error: msg,
      outputPreview: String(loaded.lastAssistantText ?? "").slice(0, 1000),
    });
  }
  const ownerTask = buildOwnerTask(alertContext);
  const routedProjectMetric = routeProjectMetricAlert(ctx, alertContext);
  if (routedProjectMetric) return routedProjectMetric;

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
