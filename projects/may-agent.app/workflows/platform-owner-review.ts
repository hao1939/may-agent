import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  dependenciesSatisfied,
  isLeaf,
  readTaskTree,
  resolveTaskTreePath,
  taskState,
  type TaskTreeConfig,
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk";

export const name = "platform-owner-review";
export const description =
  "May-agent.app local owner workflow. Builds a platform review packet, then wakes tech-lead to judge and advance the platform project.";

const ownerAgent = "tech-lead";
const ownerEventOwner = `agent:${ownerAgent}`;
// Messages may be addressed to either the project owner (agent:tech-lead) or
// the platform agent (agent:may). Both land in the may-agent.app owner inbox
// via routing, so lifecycle drain must cover both to prevent accumulation.
const platformOwnerAliases = new Set([ownerEventOwner, "agent:may"]);

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
  const treeConfig: TaskTreeConfig = {
    appDir,
    projectDir: appDir,
    treePath,
    journalPath: join(appDir, ".state", "journal.jsonl"),
    worker: ownerAgent,
    maxConcurrent: 3,
  };
  const tree = readTaskTree(treeConfig);
  const tasks = tree.tasks;
  const counts: Record<string, number> = {};
  for (const task of Object.values(tasks)) {
    const state = taskState(task);
    counts[state] = (counts[state] ?? 0) + 1;
  }
  const leaves = Object.entries(tasks).filter(([, task]) => isLeaf(task));
  const runnable = leaves
    .filter(
      ([, task]) =>
        taskState(task) === "backlog" && dependenciesSatisfied(tree, task),
    )
    .map(([id, task]) => ({ id, goal: task.goal }));
  const active = leaves
    .filter(([, task]) => taskState(task) === "active")
    .map(([id, task]) => ({ id, goal: task.goal }));
  const review = leaves
    .filter(([, task]) => taskState(task) === "review")
    .map(([id, task]) => ({ id, goal: task.goal }));
  const blocked = leaves
    .filter(([, task]) => taskState(task) === "blocked")
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
  if (typeof ctx.query.reviewInboxEvents === "function") {
    return ctx.query.reviewInboxEvents(eventIds, reviewedBy);
  }
  if (typeof ctx.query.markInboxHandled === "function") {
    return ctx.query.markInboxHandled(eventIds, reviewedBy);
  }
  return 0;
}

function recentEvents(
  ctx: WorkflowContext,
  types: string[],
): { data: Record<string, unknown>; consumedMessageIds: number[] } {
  const since = Date.now() - 60 * 60_000;
  const data: Record<string, unknown> = {};
  const consumedMessageIds: number[] = [];
  for (const type of types) {
    try {
      const rows = ctx.query.events({ type, since, limit: 8 }).rows as Array<
        Record<string, unknown>
      >;
      // Track message.created event IDs so the caller can record owner review.
      // CRITICAL: only collect IDs for this app's owner aliases — otherwise we
      // steal messages belonging to other agents (aks-explorer, scout, etc.).
      if (type === "message.created") {
        for (const row of rows) {
          if (
            typeof row.id === "number" &&
            row.status === "pending" &&
            typeof row.owner === "string" &&
            platformOwnerAliases.has(row.owner)
          ) {
            consumedMessageIds.push(row.id);
          }
        }
      }
      data[type] = compactRows(rows);
    } catch (error) {
      data[type] = {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return { data, consumedMessageIds };
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

  // Collect ALL pending message.created events for lifecycle management,
  // not just the 1h window used for the review packet display.
  // The review packet shows recent events (1h, limit 8) for owner context,
  // but lifecycle needs to mark ALL pending messages as handled to prevent
  // accumulation between the 1h lookback and 24h expiry threshold.
  // Query both owner aliases (agent:tech-lead and agent:may) since external
  // agents (evaluator) address messages to agent:may.
  const allPendingMessageIds = [...abnormalEvents.consumedMessageIds];
  try {
    const LIFECYCLE_LOOKBACK_MS = 25 * 60 * 60_000; // 25h — slightly wider than expiry to catch edge cases
    for (const ownerAlias of platformOwnerAliases) {
      const allPendingMessages = ctx.query.events({
        type: "message.created",
        owner: ownerAlias,
        since: Date.now() - LIFECYCLE_LOOKBACK_MS,
        limit: 200,
      }).rows as Array<Record<string, unknown>>;
      for (const row of allPendingMessages) {
        if (
          typeof row.id === "number" &&
          row.status === "pending" &&
          !allPendingMessageIds.includes(row.id)
        ) {
          allPendingMessageIds.push(row.id);
        }
      }
    }
  } catch {
    /* best-effort: fall back to recentEvents IDs only */
  }

  // Collect pending escalation.created events owned by this app owner from
  // project agents (aks-explorer, evaluator, scout, etc.). These are
  // informational "waiting_with_evidence" escalations that the owner review
  // consumes by reading the packet.
  const pendingEscalationIds: number[] = [];
  try {
    const ESCALATION_LOOKBACK_MS = 48 * 60 * 60_000; // 48h to catch any backlog
    for (const ownerAlias of platformOwnerAliases) {
      const pendingEscalations = ctx.query.events({
        type: "escalation.created",
        owner: ownerAlias,
        since: Date.now() - ESCALATION_LOOKBACK_MS,
        limit: 200,
      }).rows as Array<Record<string, unknown>>;
      for (const row of pendingEscalations) {
        if (typeof row.id === "number" && row.status === "pending") {
          pendingEscalationIds.push(row.id);
        }
      }
    }
  } catch {
    /* best-effort: don't block review if escalation collection fails */
  }

  // Collect pending signal events owned by this app owner.
  // These are informational signals that the owner review consumes by including
  // them in the review packet. Without draining them, they accumulate indefinitely
  // (the expireStaleSignalEvents helper only catches events >24h old, so recent
  // ones pile up between creation and the 24h threshold).
  const pendingSignalEventIds: number[] = [];
  try {
    const SIGNAL_LOOKBACK_MS = 48 * 60 * 60_000; // 48h to catch backlog
    const signalTypes = [
      "metric.breach",
      "metric.recovered",
      "metric.stalled",
      "session.resume_failed",
      "session.recovery_failed",
      "handler.failed",
      "subscriber.failed",
      "message.delivery_failed",
      "agent.config_invalid",
    ];
    for (const type of signalTypes) {
      for (const ownerAlias of platformOwnerAliases) {
        const pendingSignals = ctx.query.events({
          type,
          owner: ownerAlias,
          since: Date.now() - SIGNAL_LOOKBACK_MS,
          limit: 200,
        }).rows as Array<Record<string, unknown>>;
        for (const row of pendingSignals) {
          if (typeof row.id === "number" && row.status === "pending") {
            pendingSignalEventIds.push(row.id);
          }
        }
      }
    }
  } catch {
    /* best-effort: don't block review if signal collection fails */
  }

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
      recent_abnormal_events: abnormalEvents.data,
      owner_sessions: compactRows(ownerSessions, 10),
      active_owner_sessions: compactRows(activeOwnerSessions, 10),
    },
    consumedMessageIds: allPendingMessageIds,
    consumedEscalationIds: pendingEscalationIds,
    consumedSignalEventIds: pendingSignalEventIds,
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

function resultSummary(result: unknown): string {
  if (!result || typeof result !== "object") return String(result);
  const record = result as {
    summary?: unknown;
    lastAssistantText?: unknown;
    status?: unknown;
    finishResult?: { summary?: unknown };
  };
  const text =
    record.finishResult?.summary ??
    record.summary ??
    record.lastAssistantText ??
    JSON.stringify(result);
  return typeof text === "string" ? text : JSON.stringify(text);
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const appDir = field(ctx.task, "app") ?? "/app/projects/may-agent.app";
  const projectDir = field(ctx.task, "project") ?? "/app/projects/may-agent";

  // Expire stale pending messages older than 24h on each review cycle.
  // This prevents unbounded growth of the pending count.
  try {
    const STALE_MESSAGE_AGE_MS = 24 * 60 * 60_000; // 24 hours
    const expired = ctx.query.expireStaleMessages(STALE_MESSAGE_AGE_MS);
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

  // Expire stale pending signal events (session.resume_failed, metric.breach/recovered/stalled)
  // older than 24h. These are non-actionable historical noise once reviewed.
  try {
    const STALE_SIGNAL_AGE_MS = 24 * 60 * 60_000; // 24 hours
    if (typeof ctx.query.expireStaleSignalEvents === "function") {
      const expiredSignals =
        ctx.query.expireStaleSignalEvents(STALE_SIGNAL_AGE_MS);
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

  // Record reviewed message.created events so they don't reappear.
  // The query layer emits follow-up events and closes owner-inbox pairs; it also
  // updates legacy pending rows during migration.
  try {
    reviewInboxEvents(ctx, consumedMessageIds, ownerAgent);
  } catch {
    /* best-effort: don't block review if marking fails */
  }

  // Record reviewed escalation.created events.
  // These are project-agent escalations (aks-explorer, evaluator) that the
  // owner review consumes by seeing them in the review packet. Without this,
  // the escalation.pending-count metric grows unbounded and triggers alerts.
  try {
    if (consumedEscalationIds.length > 0) {
      reviewInboxEvents(ctx, consumedEscalationIds, ownerAgent);
      if (consumedEscalationIds.length > 0) {
        ctx.emit({
          type: "escalation.lifecycle",
          action: "drain_pending",
          drained: consumedEscalationIds.length,
          reason: "owner-review consumed escalation events",
        });
      }
    }
  } catch {
    /* best-effort: don't block review if escalation marking fails */
  }

  // Record reviewed metric.breach/recovered/stalled events.
  // These are signal events the owner review includes in the packet for
  // context. Without draining them, pending counts grow between measurement
  // cycles and trigger cascading metric alerts.
  try {
    if (consumedSignalEventIds.length > 0) {
      reviewInboxEvents(ctx, consumedSignalEventIds, ownerAgent);
      ctx.emit({
        type: "signal.lifecycle",
        action: "drain_pending_signals",
        drained: consumedSignalEventIds.length,
        reason: "owner-review consumed metric signal events",
      });
    }
  } catch {
    /* best-effort: don't block review if signal marking fails */
  }

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
    "- If the packet shows real abnormal signals, update/assign task-tree work, fix the smallest root cause, or record the exact blocker.",
    "- If project.json and the runtime project row disagree, treat that as a platform read-model/sync issue unless another session already fixed it.",
    "- Prefer project-local app workflow/design fixes over adding behavior to global May handlers.",
    "- Do not claim the platform is healthy or waiting from a narrow post-restart check while open alerts, recent failures, stale state, or evaluator findings remain.",
    "- NEVER write to the runtime DB (may.db) directly via bash/bun:sqlite. All state changes must go through ctx.emit() or the event system. Direct DB inserts violate runtime safety and will be flagged by the evaluator.",
    "- If you edit files, run focused checks and cite them before finish.",
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
  });
  const summary = resultSummary(result);
  ctx.emit({
    type: "project.owner.reviewed",
    project: "may-agent",
    owner: ownerAgent,
    summary,
  });
  return ctx.done(summary);
}
