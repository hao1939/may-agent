import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  projectAppTaskOwnerResultSchema,
  resolveTaskTreePath,
  type ProjectAppTaskHandlerResult,
  type TaskNode,
  type TaskTree,
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk";

function isLeaf(task: TaskNode): boolean {
  return (task.children ?? []).length === 0;
}

function observedTaskState(tree: TaskTree, task: TaskNode): string {
  const phase = tree.resources?.[task.id]?.status.phase;
  if (phase === "running") return "active";
  if (phase === "waiting") return "blocked";
  if (phase === "attention") return "review";
  if (phase === "converged") return "done";
  return phase ?? task.state ?? "backlog";
}

function dependenciesSatisfied(tree: TaskTree, task: TaskNode): boolean {
  const dependencyValue =
    tree.resources?.[task.id]?.spec.dependsOn ?? task.depends_on ?? [];
  const dependencies = Array.isArray(dependencyValue)
    ? dependencyValue
    : [dependencyValue];
  return dependencies.every(
    (id) =>
      tree.receipts?.[id] !== undefined ||
      tree.resources?.[id]?.status.phase === "converged",
  );
}

type OwnerResult = Exclude<
  ProjectAppTaskHandlerResult,
  { state: "needs-owner" }
>;

export const name = "platform-owner-review";
export const description =
  "May-agent.app local owner workflow. Builds a platform review packet, then wakes tech-lead to judge and advance the platform project.";

const ownerAgent = "tech-lead";
const ownerEventOwner = `agent:${ownerAgent}`;
// Messages may be addressed to either the project owner (agent:tech-lead) or
// the platform agent (agent:may). Both land in the may-agent.app owner inbox
// via routing, so lifecycle drain must cover both to prevent accumulation.
const platformOwnerAliases = new Set([ownerEventOwner, "agent:may"]);
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
  return task.match(/## Trigger Event[\\s\\S]*$/)?.[0] ?? "";
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
  const tree = JSON.parse(readFileSync(treePath, "utf-8")) as TaskTree;
  const tasks = tree.tasks;
  const counts: Record<string, number> = {};
  for (const task of Object.values(tasks)) {
    const state = observedTaskState(tree, task);
    counts[state] = (counts[state] ?? 0) + 1;
  }
  const leaves = Object.entries(tasks).filter(([, task]) => isLeaf(task));
  const runnable = leaves
    .filter(
      ([, task]) =>
        observedTaskState(tree, task) === "backlog" &&
        dependenciesSatisfied(tree, task),
    )
    .map(([id, task]) => ({ id, goal: task.goal }));
  const active = leaves
    .filter(([, task]) => observedTaskState(tree, task) === "active")
    .map(([id, task]) => ({ id, goal: task.goal }));
  const review = leaves
    .filter(([, task]) => observedTaskState(tree, task) === "review")
    .map(([id, task]) => ({ id, goal: task.goal }));
  const blocked = leaves
    .filter(([, task]) => observedTaskState(tree, task) === "blocked")
    .map(([id, task]) => ({ id, goal: task.goal }));

  return {
    available: true,
    updated_at: tree.updated_at,
    total: Object.keys(tasks).length,
    counts,
    runnable: runnable.slice(0, 12),
    active,
    review,
    blocked,
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
    messageIds: number[];
    escalationIds: number[];
    signalEventIds: number[];
  },
): void {
  try {
    reviewInboxEvents(ctx, input.messageIds, ownerAgent);
  } catch {
    /* best-effort: a later review can acknowledge these events */
  }

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
      open_alerts: openAlerts,
      recent_abnormal_events: abnormalEvents,
      owner_sessions: compactRows(ownerSessions, 10),
      active_owner_sessions: compactRows(activeOwnerSessions, 10),
    },
    consumedMessageIds: inboxIds("message.created"),
    consumedEscalationIds: inboxIds("escalation.created"),
    consumedSignalEventIds: inboxIds(reviewedSignalTypes),
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
    const active = Array.isArray(tree.active) ? tree.active : [];
    const review = Array.isArray(tree.review) ? tree.review : [];
    const blocked = Array.isArray(tree.blocked) ? tree.blocked : [];
    if (active.length)
      lines.push(
        `  Active: ${active.map((t: { id?: string }) => t.id).join(", ")}`,
      );
    if (review.length)
      lines.push(
        `  Review: ${review.map((t: { id?: string }) => t.id).join(", ")}`,
      );
    if (blocked.length)
      lines.push(
        `  Blocked: ${blocked.map((t: { id?: string }) => t.id).join(", ")}`,
      );
    if (runnable.length)
      lines.push(
        `  Runnable backlog: ${runnable.map((t: { id?: string }) => t.id).join(", ")}`,
      );
  }

  // Open alerts
  const alerts = Array.isArray(packet.open_alerts)
    ? (packet.open_alerts as Array<Record<string, unknown>>)
    : [];
  if (alerts.length) {
    lines.push(`Open alerts (${alerts.length}):`);
    for (const a of alerts) {
      lines.push(`  #${a.id} ${a.metric_id}: ${a.message}`);
    }
  } else {
    lines.push("Open alerts: 0");
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

  // Retire stale owner-inbox message work older than 24h on each review cycle.
  try {
    const STALE_MESSAGE_AGE_MS = 24 * 60 * 60_000; // 24 hours
    const expired = ctx.commands.expireStaleMessages(STALE_MESSAGE_AGE_MS);
    if (expired > 0) {
      ctx.emit({
        type: "message.lifecycle",
        action: "expire_stale",
        expired,
        olderThanMs: STALE_MESSAGE_AGE_MS,
      });
    }
  } catch {
    /* best-effort: don't block review if expiry fails */
  }

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

  const {
    packet,
    consumedMessageIds,
    consumedEscalationIds,
    consumedSignalEventIds,
  } = buildReviewPacket(ctx, appDir);
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

  const prompt = [
    "You are the May-agent platform project owner.",
    "",
    `App/control plane: ${appDir}`,
    `Domain workspace: ${projectDir}`,
    "",
    "The full system-review packet is at:",
    `  ${packetPath}`,
    "",
    "Read that file for complete data. Here is the signal summary:",
    "",
    packetSummary,
    "",
    "Required owner judgment:",
    "- If the packet shows real abnormal signals, fix the smallest root cause, propose typed task actions, or record the exact blocker.",
    "- If project.json and the runtime project row disagree, treat that as a platform read-model/sync issue unless another session already fixed it.",
    "- Prefer project-local app workflow/design fixes over adding behavior to global May handlers.",
    "- Do not claim the platform is healthy or waiting from a narrow post-restart check while open alerts, recent failures, stale state, or evaluator findings remain.",
    "- NEVER write to the runtime DB (may.db) directly via bash/bun:sqlite. All state changes must go through ctx.emit() or the event system. Direct DB inserts violate runtime safety and will be flagged by the evaluator.",
    "- If you edit files, run focused checks and cite them before finish.",
    "- The generic reconciler is the sole task-tree mutation authority. Never edit task-tree JSON, call task-tree mutation commands, or write task state through the database.",
    "- Return task-tree changes only as typed actions in finish. Existing-task actions require the exact revision shown in the tree.",
    "- Never mutate or create task ids beginning with runtime/; those standing responsibilities belong to the reconciler.",
    "- You may edit May-agent-owned code and docs when that is the smallest useful domain step. Cite the resulting files and checks as evidence.",
    "- Use converged after the current bounded actions are declared, and waiting only for a named external fact with an exact Condition that an observer can emit.",
    "- An evidence-backed no-op is valid; return an empty actions array and explain why existing work already covers the signal.",
    "",
    "Start with these files:",
    `- ${packetPath}`,
    `- ${appDir}/project.json`,
    `- ${taskTreePath}`,
    `- ${appDir}/app.ts`,
    `- ${appDir}/workflows/platform-owner-review.ts`,
    "",
    triggerBlock(ctx.task),
  ].join("\n");

  const result = await ctx.runAgent(ownerAgent, prompt, {
    timeoutMs: 1_800_000,
    schema: projectAppTaskOwnerResultSchema,
  });
  if (result.status === "error" || result.status === "interrupted") {
    return ctx.blocked("Platform owner review session failed", {
      sessionId: result.sessionId,
      status: result.status,
      summary: result.lastAssistantText,
    });
  }

  const ownerResult = result.structuredResult as unknown as OwnerResult;
  // Acknowledgement is the commit point for the review packet. Keep every
  // inbox row open when the owner session fails so recovery can replay it.
  acknowledgeReviewPacket(ctx, {
    messageIds: consumedMessageIds,
    escalationIds: consumedEscalationIds,
    signalEventIds: consumedSignalEventIds,
  });
  ctx.emit({
    type: "project.owner.reviewed",
    project: "may-agent",
    owner: ownerAgent,
    summary: ownerResult.summary,
    state: ownerResult.state,
    proposedActions: ownerResult.actions ?? [],
    evidence: ownerResult.evidence,
  });
  return ctx.done(ownerResult.summary, ownerResult);
}
