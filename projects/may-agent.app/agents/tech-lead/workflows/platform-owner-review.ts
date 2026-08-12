import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  projectAppTaskOwnerResultSchema,
  resolveTaskTreePath,
  type ProjectAppTaskHandlerResult,
  type ProjectTaskProjectionItem,
  type ProjectTaskTreeProjection,
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk";

function isResource(task: ProjectTaskProjectionItem): boolean {
  return task.item_type === "task";
}

function observedTaskPhase(task: ProjectTaskProjectionItem): string {
  return task.phase ?? "unknown";
}

function dependenciesSatisfied(task: ProjectTaskProjectionItem): boolean {
  return task.readiness?.state === "ready";
}

type OwnerResult = Exclude<
  ProjectAppTaskHandlerResult,
  { state: "needs-owner" }
>;

type OwnerAuthFailure = {
  provider: string;
  detail: string;
};

export const name = "platform-owner-review";
export const description =
  "May-agent.app local owner workflow. Builds a platform review packet, then wakes tech-lead to judge and advance the platform project.";

const ownerAgent = "tech-lead";
const ownerEventOwner = `agent:${ownerAgent}`;
// Messages may be addressed to either the project owner (agent:tech-lead) or
// the platform agent (agent:may). Both land in the may-agent.app owner inbox
// via routing, so lifecycle drain must cover both to prevent accumulation.
const platformOwnerAliases = new Set([ownerEventOwner, "agent:may"]);
const platformMetricOwners = new Set([
  ownerAgent,
  ownerEventOwner,
  "may",
  "agent:may",
]);
const reviewedSignalTypes = new Set([
  "metric.breach",
  "metric.recovered",
  "metric.stalled",
  "session.resume_failed",
  "session.recovery_failed",
  "handler.failed",
  "subscriber.failed",
  "message.delivery_failed",
  "agent.config_invalid",
]);

function field(task: string, name: string): string | undefined {
  const pattern = new RegExp(`^${name}:\\s*(.+)$`, "m");
  return task.match(pattern)?.[1]?.trim();
}

function triggerBlock(task: string): string {
  return task.match(/## Trigger Event[\s\S]*$/)?.[0] ?? "";
}

function triggerEventId(task: string): number | null {
  const block = triggerBlock(task)
    .replace(/^## Trigger Event\s*/m, "")
    .replace(/^```json\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();
  try {
    const parsed = JSON.parse(block) as Record<string, unknown>;
    const value = parsed.eventId;
    return typeof value === "number" && Number.isInteger(value) ? value : null;
  } catch {
    const match = task.match(/"eventId"\s*:\s*(\d+)/);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isInteger(value) ? value : null;
  }
}

type OwnerReviewArtifactStatus =
  | "pending"
  | "blocked"
  | "waiting"
  | "converged";

type OwnerReviewArtifact = {
  generated_at: string;
  updated_at: string;
  trigger_event_id: number | null;
  status: OwnerReviewArtifactStatus;
  packet_path: string;
  task_tree_path: string;
  owner_prompt_artifact_path: string;
  trigger_excerpt: string;
  owner_worklog?: {
    required_before_speculative_edits: boolean;
    prompt: string;
    current_hypothesis: string | null;
    next_step: string | null;
    updated_at: string | null;
  };
  owner_session?: {
    session_id: string | null;
    status: string;
    summary: string | null;
  };
  owner_result?: OwnerResult;
  interim_note?: string;
};

export function buildOwnerReviewArtifactPath(
  appDir: string,
  task: string,
  now = Date.now(),
): string {
  const eventId = triggerEventId(task);
  const fileName = eventId ? `event-${eventId}.json` : `review-${now}.json`;
  return join(appDir, ".state", "owner-review-artifacts", fileName);
}

export function writeOwnerReviewArtifact(
  path: string,
  artifact: OwnerReviewArtifact,
): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`, "utf-8");
}

function preservedOwnerProgress(
  path: string,
): Pick<OwnerReviewArtifact, "owner_worklog" | "interim_note"> {
  const current = parseJsonFile(path);
  const ownerWorklog = asRecord(current.owner_worklog);
  return {
    owner_worklog:
      Object.keys(ownerWorklog).length > 0
        ? (ownerWorklog as OwnerReviewArtifact["owner_worklog"])
        : undefined,
    interim_note:
      typeof current.interim_note === "string"
        ? current.interim_note
        : undefined,
  };
}

export function buildOwnerPrompt(input: {
  appDir: string;
  projectDir: string;
  packetPath: string;
  packetSummary: string;
  taskTreePath: string;
  trigger: string;
  reviewArtifactPath: string;
}): string {
  const {
    appDir,
    projectDir,
    packetPath,
    packetSummary,
    taskTreePath,
    trigger,
    reviewArtifactPath,
  } = input;
  return [
    "You are the May-agent platform project owner.",
    "",
    `App/control plane: ${appDir}`,
    `Domain workspace: ${projectDir}`,
    "",
    "Current trigger:",
    trigger || "(no trigger event was provided)",
    "",
    "Trigger priority:",
    "- When project.owner.requested carries an explicit instruction, treat that instruction as the primary bounded owner request.",
    "- Use the health packet as context; do not silently replace the requested review with an unrelated alert review.",
    "- If the instruction cannot be completed safely, return the exact conflict or blocker and the smallest supported task action.",
    "",
    "Admission-review terminal decision gate:",
    "- For a held admission candidate, gather only three anchors: the exact candidate payload, its exact runtime lineage, and any exact prior terminal closure.",
    "- Resolve each anchor by exact event ID, cited artifact path, or exact task/resource ID. Do not read whole state files, discover schemas, or load broad reference documents when an exact lookup is available.",
    "- As soon as all three anchors are known, stop investigating. Immediately checkpoint the supported disposition, then return the safest terminal handle, route, clarify-producer, reject, or deliver result and call finish.",
    "- Reserve the final quarter of the session budget for the terminal decision and finish. If an anchor remains unavailable at that checkpoint, choose the safest supported route or clarify-producer disposition instead of starting another lookup.",
    "",
    "The full system-review packet is at:",
    `  ${packetPath}`,
    "",
    "Durable owner-review artifact:",
    `  ${reviewArtifactPath}`,
    "",
    "Read the review packet for complete data. Here is the signal summary:",
    "",
    packetSummary,
    "",
    "Required owner judgment:",
    "- If the packet shows real abnormal signals, fix the smallest root cause, propose typed task actions, or record the exact blocker.",
    "- If project.json and the runtime project row disagree, treat that as a platform read-model/sync issue unless another session already fixed it.",
    "- Prefer project-local app workflow/design fixes over adding behavior to global May handlers.",
    "- Do not claim the platform is healthy or waiting from a narrow post-restart check while open alerts, recent failures, stale state, or evaluator findings remain.",
    "- NEVER write to the runtime DB (may.db) directly via bash/bun:sqlite. All state changes must go through ctx.emit() or the event system. Direct DB inserts violate runtime safety and will be flagged by the evaluator.",
    "- For cross-project durable task-state mutations, route through the target project app owner. Use break-glass/direct mutation only with an explicit audited note that names failure of the target app route itself; failed calls to May-agent internal agents or other unrelated boundaries are not sufficient proof.",
    "- Start from bounded durable evidence: the packet, cited artifact paths, current task-tree truth, and exact runtime records for the named lineage or alert. Do not fall back to repository-wide search unless one exact cited file path still needs inspection.",
    "- If you edit files, run focused checks and cite them before finish.",
    "- The generic reconciler is the sole task-tree mutation authority. Never edit task-tree JSON, call task-tree mutation commands, or write task state through the database.",
    "- Return task-tree changes only as typed actions in finish. Existing-task actions require the exact revision shown in the tree.",
    "- For an unfinished owner message, create required delegated work as a direct child of runtime/platform-owner-review and return waiting. Routing or task creation is progress, not message completion.",
    "- Return converged for an owner message only when its intended result is verified and no required delegated child remains live.",
    "- Never mutate or create task ids beginning with runtime/; those standing responsibilities belong to the reconciler.",
    "- You may edit May-agent-owned code and docs when that is the smallest useful domain step. Cite the resulting files and checks as evidence.",
    "- Use converged after the current bounded actions are declared, and waiting only for a named external fact with an exact Condition that an observer can emit.",
    "- Every waiting Condition subject must be typed (for example event:5011463, session:s_123, pull-request:77); bare numeric ids or free-text subjects are rejected by the task-handler contract.",
    "- An evidence-backed no-op is valid; return an empty actions array and explain why existing work already covers the signal.",
    "",
    "Loss-prevention discipline for this owner review:",
    "- As soon as you confirm the primary trigger evidence and your first gap/no-op hypothesis, immediately call checkpoint() with that proof, the likely next step, and any files or session ids a successor would need.",
    `- Immediately after that checkpoint, update ${reviewArtifactPath} with a 1-3 sentence interim note before any speculative edit, broad repo search, or secondary investigation.`,
    "- Do that checkpoint before broader repo searches or secondary investigation; if a later interruption occurs, the checkpoint must still support a recoverable waiting/converged decision.",
    `- If you collect a stable interim decision before final finish, update ${reviewArtifactPath} again with the latest durable note so recovery can resume from evidence instead of re-deriving it.`,
    "- If a preferred tool is unavailable, pivot immediately to an available equivalent (for example grep instead of rg) instead of spending more turns probing the environment.",
    "",
    "Start with these files:",
    `- ${packetPath}`,
    `- ${appDir}/project.json`,
    `- ${taskTreePath}`,
    `- ${appDir}/app.ts`,
    `- ${appDir}/agents/tech-lead/workflows/platform-owner-review.ts`,
  ].join("\n");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseJsonFile(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function taskTreePacket(appDir: string): Record<string, unknown> {
  const treePath = resolveTaskTreePath(appDir);
  if (!existsSync(treePath)) return { available: false, path: treePath };
  const tree = JSON.parse(
    readFileSync(treePath, "utf-8"),
  ) as ProjectTaskTreeProjection;
  const tasks = tree.tasks;
  const counts: Record<string, number> = {};
  for (const task of Object.values(tasks)) {
    if (!isResource(task)) continue;
    const phase = observedTaskPhase(task);
    counts[phase] = (counts[phase] ?? 0) + 1;
  }
  const resources = Object.entries(tasks).filter(([, task]) =>
    isResource(task),
  );
  const runnable = resources
    .filter(
      ([, task]) =>
        observedTaskPhase(task) === "pending" && dependenciesSatisfied(task),
    )
    .map(([id, task]) => ({ id, outcome: task.outcome }));
  const running = resources
    .filter(([, task]) => observedTaskPhase(task) === "running")
    .map(([id, task]) => ({ id, outcome: task.outcome }));
  const attention = resources
    .filter(([, task]) => observedTaskPhase(task) === "attention")
    .map(([id, task]) => ({ id, outcome: task.outcome }));
  const waiting = resources
    .filter(([, task]) => observedTaskPhase(task) === "waiting")
    .map(([id, task]) => ({ id, outcome: task.outcome }));

  return {
    available: true,
    updated_at: tree.updated_at,
    total: resources.length,
    counts,
    runnable: runnable.slice(0, 12),
    running,
    attention,
    waiting,
  };
}

function compactRows(
  rows: Array<Record<string, unknown>>,
  limit = 8,
): Array<Record<string, unknown>> {
  const MAX_FIELD = 500;
  return rows.slice(0, limit).map((row) => {
    const compact: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === "string" && value.length > MAX_FIELD) {
        compact[key] =
          `${value.slice(0, MAX_FIELD)}...[truncated ${value.length} chars]`;
      } else {
        compact[key] = value;
      }
    }
    return compact;
  });
}

function reviewInboxEvents(
  ctx: WorkflowContext,
  eventIds: number[],
  reviewedBy: string,
): number {
  if (eventIds.length === 0) return 0;
  return ctx.commands.reviewInboxEvents(eventIds, reviewedBy);
}

function acknowledgeReviewPacket(
  ctx: WorkflowContext,
  input: {
    escalationIds: number[];
    signalEventIds: number[];
  },
): void {
  try {
    if (input.escalationIds.length > 0) {
      reviewInboxEvents(ctx, input.escalationIds, ownerAgent);
      ctx.emit({
        type: "escalation.lifecycle",
        action: "drain_pending",
        drained: input.escalationIds.length,
        reason: "owner-review consumed escalation events",
      });
    }
  } catch {
    /* best-effort: a later review can acknowledge these events */
  }

  try {
    if (input.signalEventIds.length > 0) {
      reviewInboxEvents(ctx, input.signalEventIds, ownerAgent);
      ctx.emit({
        type: "signal.lifecycle",
        action: "drain_pending_signals",
        drained: input.signalEventIds.length,
        reason: "owner-review consumed metric signal events",
      });
    }
  } catch {
    /* best-effort: a later review can acknowledge these events */
  }
}

function recentEvents(
  ctx: WorkflowContext,
  types: string[],
): Record<string, unknown> {
  const since = Date.now() - 60 * 60_000;
  const data: Record<string, unknown> = {};
  for (const type of types) {
    try {
      const rows = ctx.query.events({ type, since, limit: 8 }).rows as Array<
        Record<string, unknown>
      >;
      data[type] = compactRows(rows);
    } catch (error) {
      data[type] = {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return data;
}

function openPlatformInboxRows(
  ctx: WorkflowContext,
): Array<Record<string, unknown>> {
  const rows = new Map<number, Record<string, unknown>>();
  for (const owner of platformOwnerAliases) {
    const agent = owner.replace(/^agent:/, "");
    const inbox = ctx.query.heartbeatContext({
      agent,
      inboxLookbackMs: 48 * 60 * 60_000,
      inboxLimit: 200,
    }).inbox;
    for (const row of inbox) {
      if (typeof row.id === "number") rows.set(row.id, row);
    }
  }
  return [...rows.values()];
}

function queryRows(
  ctx: WorkflowContext,
  query: () => { rows: Array<Record<string, unknown>> },
): Array<Record<string, unknown>> {
  try {
    return query().rows;
  } catch {
    return [];
  }
}

function metricOwner(alert: Record<string, unknown>): string | null {
  const explicitOwner = alert.explicitOwner ?? alert.explicit_owner;
  if (typeof explicitOwner === "string" && explicitOwner.trim() !== "") {
    return explicitOwner;
  }
  const projectOwner = alert.projectOwner ?? alert.project_owner;
  return typeof projectOwner === "string" && projectOwner.trim() !== ""
    ? projectOwner
    : null;
}

function isPlatformOpenAlert(alert: Record<string, unknown>): boolean {
  const owner = metricOwner(alert);
  return owner !== null && platformMetricOwners.has(owner);
}

function enrichAlerts(
  openAlerts: Array<Record<string, unknown>>,
  heartbeatAlerts: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const byMetricId = new Map<string, Record<string, unknown>>();
  for (const alert of heartbeatAlerts) {
    const metricId = alert.metricId ?? alert.metric_id;
    if (typeof metricId === "string" && metricId.trim() !== "") {
      byMetricId.set(metricId, alert);
    }
  }
  return openAlerts.map((alert) => {
    const metricId = alert.metric_id ?? alert.metricId;
    if (typeof metricId !== "string" || metricId.trim() === "") return alert;
    const enriched = byMetricId.get(metricId);
    if (!enriched) return alert;
    return {
      ...alert,
      explicit_owner: enriched.explicitOwner ?? enriched.explicit_owner ?? null,
      project_owner: enriched.projectOwner ?? enriched.project_owner ?? null,
    };
  });
}

function buildReviewPacket(
  ctx: WorkflowContext,
  appDir: string,
): {
  packet: Record<string, unknown>;
  consumedMessageIds: number[];
  consumedEscalationIds: number[];
  consumedSignalEventIds: number[];
} {
  const projectJson = parseJsonFile(join(appDir, "project.json"));
  const projectRows = queryRows(ctx, () =>
    ctx.query.projects({ id: "may-agent.app", limit: 5 }),
  );
  const openAlerts = queryRows(ctx, () =>
    ctx.query.alerts({ resolved: false, limit: 20 }),
  );
  const heartbeatAlerts = (() => {
    try {
      return ctx.query.heartbeatContext({
        agent: ownerAgent,
        metricLimit: 1,
        metricSnapshotLimit: 1,
        alertLimit: 50,
        inboxLimit: 1,
      }).alerts as Array<Record<string, unknown>>;
    } catch {
      return [];
    }
  })();
  const openAlertsWithOwners = enrichAlerts(openAlerts, heartbeatAlerts);
  const platformOpenAlerts = openAlertsWithOwners.filter(isPlatformOpenAlert);
  const otherOpenAlerts = openAlertsWithOwners.filter(
    (alert) => !isPlatformOpenAlert(alert),
  );
  const ownerSessions = queryRows(ctx, () =>
    ctx.query.sessions({
      agent: ownerAgent,
      projectId: "may-agent",
      limit: 10,
    }),
  );
  const activeOwnerSessions = queryRows(ctx, () =>
    ctx.query.sessions({ agent: ownerAgent, status: "running", limit: 10 }),
  );

  const abnormalEvents = recentEvents(ctx, [
    "handler.failed",
    "session.resume_failed",
    "session.recovery_failed",
    "subscriber.failed",
    "message.delivery_failed",
    "agent.config_invalid",
    "metric.breach",
    "metric.recovered",
    "metric.stalled",
    "message.created",
  ]);

  // Lifecycle work comes from the canonical open owner inbox projection, not
  // from mutable fields on event rows.
  let openInboxRows: Array<Record<string, unknown>> = [];
  try {
    openInboxRows = openPlatformInboxRows(ctx);
  } catch {
    /* best-effort: owner review can continue without lifecycle draining */
  }
  const inboxIds = (type: string | Set<string>): number[] =>
    openInboxRows
      .filter((row) =>
        typeof type === "string"
          ? row.eventType === type
          : typeof row.eventType === "string" && type.has(row.eventType),
      )
      .map((row) => row.id)
      .filter((id): id is number => typeof id === "number");

  return {
    packet: {
      generated_at: new Date().toISOString(),
      project_json: {
        id: projectJson.id,
        owner: projectJson.owner,
        status: projectJson.status,
        currentFocus: projectJson.currentFocus,
      },
      runtime_project_rows: projectRows,
      project_state_mismatch: projectRows.some(
        (row) =>
          row.status !== projectJson.status || row.owner !== projectJson.owner,
      ),
      task_tree: taskTreePacket(appDir),
      open_alerts: openAlertsWithOwners,
      platform_open_alerts: platformOpenAlerts,
      other_open_alerts: otherOpenAlerts,
      recent_abnormal_events: abnormalEvents,
      owner_sessions: compactRows(ownerSessions, 10),
      active_owner_sessions: compactRows(activeOwnerSessions, 10),
    },
    consumedMessageIds: [],
    consumedEscalationIds: inboxIds("escalation.created"),
    consumedSignalEventIds: inboxIds(reviewedSignalTypes),
  };
}

function classifyOwnerAuthFailure(
  error: string | null | undefined,
): OwnerAuthFailure | null {
  if (!error) return null;
  const trimmed = error.trim();
  const genericAuth =
    /(AuthenticationError|auth(?:entication)? failed|unauthorized|token expired|oauth)/i;
  if (!genericAuth.test(trimmed)) return null;
  if (/Github_copilotException|github-copilot|copilot/i.test(trimmed)) {
    return { provider: "github-copilot", detail: trimmed };
  }
  return { provider: "llm-provider", detail: trimmed };
}

export function normalizeOwnerResult(ownerResult: OwnerResult): OwnerResult {
  const createsRequiredChild = ownerResult.actions?.some(
    (action) => action.kind === "create-task",
  );
  if (ownerResult.state !== "converged" || !createsRequiredChild) {
    return ownerResult;
  }

  // A newly required child is live work by definition. Preserve the proposal,
  // but fail closed to waiting so reconciliation can admit the child instead
  // of rejecting the contradictory converged decision.
  return {
    ...ownerResult,
    state: "waiting",
    evidence: [
      ...ownerResult.evidence,
      "owner-result-normalized: create-task actions require waiting until delegated work converges",
    ],
  };
}

function authFailureOwnerResult(input: {
  provider: string;
  detail: string;
  sessionId: string | null;
  reviewArtifactPath: string;
}): OwnerResult {
  const providerLabel =
    input.provider === "github-copilot" ? "GitHub Copilot" : input.provider;
  return {
    state: "waiting",
    summary: `Platform owner review could not complete because the ${ownerAgent} session hit a ${providerLabel} authentication failure; refresh the credential and rerun the owner review.`,
    evidence: [
      `owner-session:${input.sessionId ?? "unknown"}`,
      `provider-auth:${input.detail}`,
      `artifact:${input.reviewArtifactPath}`,
    ],
    actions: [],
    conditions: [
      {
        id: "owner-provider-auth-restored",
        type: "external.fact",
        subject: `credential:${input.provider}`,
        expected: { status: "valid", agent: ownerAgent },
        owner: "human",
        reviewAfterMs: 300_000,
      },
    ],
  };
}

function buildPacketSummary(packet: Record<string, unknown>): string {
  const lines: string[] = [];

  // Project state
  const pj = asRecord(packet.project_json);
  lines.push(`Project: ${pj.id} (status=${pj.status}, owner=${pj.owner})`);
  if (packet.project_state_mismatch) {
    lines.push("⚠ project.json/runtime status MISMATCH");
  }

  // Task tree
  const tree = asRecord(packet.task_tree);
  if (tree.available) {
    const counts = asRecord(tree.counts);
    const countStr = Object.entries(counts)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    lines.push(`Task tree: ${tree.total} tasks (${countStr})`);
    const runnable = Array.isArray(tree.runnable) ? tree.runnable : [];
    const running = Array.isArray(tree.running) ? tree.running : [];
    const attention = Array.isArray(tree.attention) ? tree.attention : [];
    const waiting = Array.isArray(tree.waiting) ? tree.waiting : [];
    if (running.length)
      lines.push(
        `  Running: ${running.map((t: { id?: string }) => t.id).join(", ")}`,
      );
    if (attention.length)
      lines.push(
        `  Attention: ${attention.map((t: { id?: string }) => t.id).join(", ")}`,
      );
    if (waiting.length)
      lines.push(
        `  Waiting: ${waiting.map((t: { id?: string }) => t.id).join(", ")}`,
      );
    if (runnable.length)
      lines.push(
        `  Runnable backlog: ${runnable.map((t: { id?: string }) => t.id).join(", ")}`,
      );
  }

  // Open alerts
  const platformAlerts = Array.isArray(packet.platform_open_alerts)
    ? (packet.platform_open_alerts as Array<Record<string, unknown>>)
    : [];
  const otherAlerts = Array.isArray(packet.other_open_alerts)
    ? (packet.other_open_alerts as Array<Record<string, unknown>>)
    : Array.isArray(packet.open_alerts)
      ? (packet.open_alerts as Array<Record<string, unknown>>)
      : [];
  if (platformAlerts.length) {
    lines.push(`Platform-owned open alerts (${platformAlerts.length}):`);
    for (const a of platformAlerts) {
      lines.push(`  #${a.id} ${a.metric_id}: ${a.message}`);
    }
  } else {
    lines.push("Platform-owned open alerts: 0");
  }
  if (otherAlerts.length) {
    lines.push(`Other open alerts in packet context (${otherAlerts.length}):`);
    for (const a of otherAlerts) {
      const owner = metricOwner(a) ?? "unknown";
      lines.push(`  #${a.id} ${a.metric_id}: ${a.message} [owner=${owner}]`);
    }
  }

  // Abnormal events summary
  const abnormal = asRecord(packet.recent_abnormal_events);
  const abnormalSummary: string[] = [];
  for (const [type, value] of Object.entries(abnormal)) {
    const arr = Array.isArray(value) ? value : [];
    if (arr.length > 0) {
      abnormalSummary.push(`${type}=${arr.length}`);
    }
  }
  if (abnormalSummary.length) {
    lines.push(`Recent abnormal events (1h): ${abnormalSummary.join(", ")}`);
  } else {
    lines.push("Recent abnormal events (1h): none");
  }

  // Owner sessions
  const sessions = Array.isArray(packet.owner_sessions)
    ? (packet.owner_sessions as Array<Record<string, unknown>>)
    : [];
  const errorSessions = sessions.filter(
    (s) => s.status === "error" || s.outcome === "error",
  );
  if (errorSessions.length) {
    lines.push(
      `Owner sessions with errors: ${errorSessions.map((s) => s.sessionId).join(", ")}`,
    );
  }

  // Active sessions
  const activeSessions = Array.isArray(packet.active_owner_sessions)
    ? (packet.active_owner_sessions as Array<Record<string, unknown>>)
    : [];
  if (activeSessions.length) {
    lines.push(`Active owner sessions: ${activeSessions.length}`);
  }

  return lines.join("\n");
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const appDir =
    ctx.appDir ?? field(ctx.task, "app") ?? "/app/projects/may-agent.app";
  const projectDir =
    ctx.projectDir ?? field(ctx.task, "project") ?? "/app/projects/may-agent";

  // Retire stale owner-inbox signal work older than 24h. These signals are
  // non-actionable historical noise once their review window passes.
  try {
    const STALE_SIGNAL_AGE_MS = 24 * 60 * 60_000; // 24 hours
    if (typeof ctx.commands.expireStaleSignalEvents === "function") {
      const expiredSignals =
        ctx.commands.expireStaleSignalEvents(STALE_SIGNAL_AGE_MS);
      if (expiredSignals > 0) {
        ctx.emit({
          type: "signal.lifecycle",
          action: "expire_stale_signals",
          expired: expiredSignals,
          olderThanMs: STALE_SIGNAL_AGE_MS,
        });
      }
    }
  } catch {
    /* best-effort: don't block review if signal expiry fails */
  }

  const { packet, consumedEscalationIds, consumedSignalEventIds } =
    buildReviewPacket(ctx, appDir);
  const packetJson = JSON.stringify(packet, null, 2);

  // Write packet to file instead of embedding inline.
  // Previous approach embedded 15-20KB of JSON in the prompt, producing
  // 22-27KB tasks that consistently triggered request-quality evaluator
  // findings and caused at least one error session (empty assistant turn).
  const packetPath = join(appDir, ".state/review-packet.json");
  mkdirSync(join(appDir, ".state"), { recursive: true });
  writeFileSync(packetPath, packetJson, "utf-8");

  // Build a compact summary for inline context (key signals only, not full data).
  const packetSummary = buildPacketSummary(packet);
  const taskTreePath = resolveTaskTreePath(appDir);
  const trigger = triggerBlock(ctx.task);
  const reviewArtifactPath = buildOwnerReviewArtifactPath(appDir, ctx.task);
  const reviewArtifactBase = {
    generated_at: new Date().toISOString(),
    trigger_event_id: triggerEventId(ctx.task),
    packet_path: packetPath,
    task_tree_path: taskTreePath,
    owner_prompt_artifact_path: reviewArtifactPath,
    trigger_excerpt: trigger,
    owner_worklog: {
      required_before_speculative_edits: true,
      prompt:
        "After the first evidence checkpoint, write a 1-3 sentence interim note here before any speculative edit, broad repo search, or secondary investigation.",
      current_hypothesis: null,
      next_step: null,
      updated_at: null,
    },
  };
  writeOwnerReviewArtifact(reviewArtifactPath, {
    ...reviewArtifactBase,
    updated_at: new Date().toISOString(),
    status: "pending",
  });

  const prompt = buildOwnerPrompt({
    appDir,
    projectDir,
    packetPath,
    packetSummary,
    taskTreePath,
    trigger,
    reviewArtifactPath,
  });

  const result = await ctx.runAgent(ownerAgent, prompt, {
    timeoutMs: 1_800_000,
    schema: projectAppTaskOwnerResultSchema,
  });
  if (result.status === "error" || result.status === "interrupted") {
    const authFailure = classifyOwnerAuthFailure(
      result.error ?? result.lastAssistantText,
    );
    if (authFailure) {
      const ownerResult = authFailureOwnerResult({
        provider: authFailure.provider,
        detail: authFailure.detail,
        sessionId: result.sessionId ?? null,
        reviewArtifactPath: reviewArtifactPath,
      });
      writeOwnerReviewArtifact(reviewArtifactPath, {
        ...reviewArtifactBase,
        ...preservedOwnerProgress(reviewArtifactPath),
        updated_at: new Date().toISOString(),
        status: "waiting",
        owner_session: {
          session_id: result.sessionId ?? null,
          status: result.status,
          summary: result.lastAssistantText ?? result.error ?? null,
        },
        owner_result: ownerResult,
        interim_note: `Owner session ${result.sessionId ?? "(unknown)"} failed closed on provider auth for ${authFailure.provider}. Review artifact preserved a waiting owner result so the app can request credential refresh instead of leaving a generic blocked owner review.`,
      });
      try {
        ctx.notify(
          `⚠️ may-agent platform owner review is waiting on ${authFailure.provider} credential refresh for ${ownerAgent}. Artifact: ${reviewArtifactPath}`,
        );
      } catch {
        /* best-effort: preserve waiting result even if notification fails */
      }
      return ctx.done(ownerResult.summary, ownerResult);
    }
    writeOwnerReviewArtifact(reviewArtifactPath, {
      ...reviewArtifactBase,
      ...preservedOwnerProgress(reviewArtifactPath),
      updated_at: new Date().toISOString(),
      status: "blocked",
      owner_session: {
        session_id: result.sessionId ?? null,
        status: result.status,
        summary: result.lastAssistantText ?? null,
      },
    });
    return ctx.blocked("Platform owner review session failed", {
      sessionId: result.sessionId,
      status: result.status,
      summary: result.lastAssistantText,
      artifactPath: reviewArtifactPath,
    });
  }

  const ownerResult = normalizeOwnerResult(
    result.structuredResult as unknown as OwnerResult,
  );
  const artifactStatus: OwnerReviewArtifactStatus =
    ownerResult.state === "waiting" ? "waiting" : "converged";
  writeOwnerReviewArtifact(reviewArtifactPath, {
    ...reviewArtifactBase,
    ...preservedOwnerProgress(reviewArtifactPath),
    updated_at: new Date().toISOString(),
    status: artifactStatus,
    owner_session: {
      session_id: result.sessionId ?? null,
      status: result.status,
      summary: result.lastAssistantText ?? ownerResult.summary,
    },
    owner_result: ownerResult,
  });
  // Signals retain the legacy review acknowledgement. Owner messages stay
  // open until the task reconciler verifies their intended result.
  acknowledgeReviewPacket(ctx, {
    escalationIds: consumedEscalationIds,
    signalEventIds: consumedSignalEventIds,
  });
  return ctx.done(ownerResult.summary, ownerResult);
}
