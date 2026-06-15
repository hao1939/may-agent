import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";

export const name = "platform-owner-review";
export const description =
  "May-agent.app local owner workflow. Builds a platform review packet, then wakes May to judge and advance the platform project.";

type TaskNode = {
  id?: string;
  state?: string;
  status?: string;
  children?: string[];
  depends_on?: string[];
  goal?: string;
};

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

function taskState(task: TaskNode): string {
  const raw = task.state ?? task.status ?? "backlog";
  if (raw === "ready" || raw === "proposed" || raw === "decomposed")
    return "backlog";
  if (raw === "accepted" || raw === "superseded" || raw === "cancelled")
    return "done";
  if (raw === "claimed_done" || raw === "rejected") return "review";
  return raw;
}

function leafTasks(tasks: Record<string, TaskNode>): Array<[string, TaskNode]> {
  return Object.entries(tasks).filter(
    ([, task]) => !Array.isArray(task.children) || task.children.length === 0,
  );
}

function depsDone(tasks: Record<string, TaskNode>, task: TaskNode): boolean {
  return (task.depends_on ?? []).every(
    (id) => taskState(tasks[id] ?? {}) === "done",
  );
}

function taskTreePacket(appDir: string): Record<string, unknown> {
  const treePath = join(appDir, "tasks/tree.json");
  if (!existsSync(treePath)) return { available: false, path: treePath };
  const tree = parseJsonFile(treePath);
  const tasks = asRecord(tree.tasks) as Record<string, TaskNode>;
  const counts: Record<string, number> = {};
  for (const task of Object.values(tasks)) {
    const state = taskState(task);
    counts[state] = (counts[state] ?? 0) + 1;
  }
  const leaves = leafTasks(tasks);
  const runnable = leaves
    .filter(
      ([, task]) => taskState(task) === "backlog" && depsDone(tasks, task),
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
        compact[key] = `${value.slice(0, MAX_FIELD)}...[truncated ${value.length} chars]`;
      } else {
        compact[key] = value;
      }
    }
    return compact;
  });
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
      // Track message.created event IDs so the caller can mark them handled.
      if (type === "message.created") {
        for (const row of rows) {
          if (typeof row.id === "number" && row.status === "pending") {
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
): { packet: Record<string, unknown>; consumedMessageIds: number[] } {
  const projectJson = parseJsonFile(join(appDir, "project.json"));
  const projectRows = queryRows(ctx, () =>
    ctx.query.projects({ id: "may-agent.app", limit: 5 }),
  );
  const openAlerts = queryRows(ctx, () =>
    ctx.query.alerts({ resolved: false, limit: 20 }),
  );
  const ownerSessions = queryRows(ctx, () =>
    ctx.query.sessions({ agent: "may", projectId: "may-agent", limit: 10 }),
  );
  const activeMaySessions = queryRows(ctx, () =>
    ctx.query.sessions({ agent: "may", status: "running", limit: 10 }),
  );

  const abnormalEvents = recentEvents(ctx, [
    "handler.failed",
    "session.resume_failed",
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
  const allPendingMessageIds = [...abnormalEvents.consumedMessageIds];
  try {
    const LIFECYCLE_LOOKBACK_MS = 25 * 60 * 60_000; // 25h — slightly wider than expiry to catch edge cases
    const allPendingMessages = ctx.query.events({
      type: "message.created",
      owner: "agent:may",
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
  } catch { /* best-effort: fall back to recentEvents IDs only */ }

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
        (row) => row.status !== projectJson.status,
      ),
      task_tree: taskTreePacket(appDir),
      open_alerts: openAlerts,
      recent_abnormal_events: abnormalEvents.data,
      owner_sessions: compactRows(ownerSessions, 10),
      active_may_sessions: compactRows(activeMaySessions, 10),
    },
    consumedMessageIds: allPendingMessageIds,
  };
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
  } catch { /* best-effort: don't block review if expiry fails */ }

  // Expire stale pending signal events (session.resume_failed, metric.breach/recovered/stalled)
  // older than 24h. These are non-actionable historical noise once reviewed.
  try {
    const STALE_SIGNAL_AGE_MS = 24 * 60 * 60_000; // 24 hours
    if (typeof ctx.query.expireStaleSignalEvents === "function") {
      const expiredSignals = ctx.query.expireStaleSignalEvents(STALE_SIGNAL_AGE_MS);
      if (expiredSignals > 0) {
        ctx.emit({
          type: "signal.lifecycle",
          action: "expire_stale_signals",
          expired: expiredSignals,
          olderThanMs: STALE_SIGNAL_AGE_MS,
        });
      }
    }
  } catch { /* best-effort: don't block review if signal expiry fails */ }

  const { packet, consumedMessageIds } = buildReviewPacket(ctx, appDir);
  const packetJson = JSON.stringify(packet, null, 2);

  // Mark consumed message.created events as handled so they don't reappear.
  // This closes the lifecycle gap where the owner workflow reads messages
  // but never transitions them from pending → handled.
  try {
    if (consumedMessageIds.length > 0 && typeof ctx.query.markInboxHandled === "function") {
      ctx.query.markInboxHandled(consumedMessageIds, "may");
    }
  } catch { /* best-effort: don't block review if marking fails */ }

  // Safety cap: if the serialized packet exceeds 200KB, something is wrong.
  // Truncate to prevent recursive amplification from bloating session tasks.
  const MAX_PACKET_BYTES = 200_000;
  const safePacketJson =
    packetJson.length > MAX_PACKET_BYTES
      ? `${packetJson.slice(0, MAX_PACKET_BYTES)}\n... [TRUNCATED: packet was ${packetJson.length} bytes, max ${MAX_PACKET_BYTES}]`
      : packetJson;

  const prompt = [
    "You are the May-agent platform project owner.",
    "",
    `App/control plane: ${appDir}`,
    `Domain workspace: ${projectDir}`,
    "",
    "Use the system-review packet below as the starting point. Do not rediscover these basics unless a packet field is missing or contradictory.",
    "",
    "Required owner judgment:",
    "- If the packet shows real abnormal signals, update/assign task-tree work, fix the smallest root cause, or record the exact blocker.",
    "- If project.json and the runtime project row disagree, treat that as a platform read-model/sync issue unless another session already fixed it.",
    "- Prefer project-local app workflow/design fixes over adding behavior to global May handlers.",
    "- Do not claim the platform is healthy or waiting from a narrow post-restart check while open alerts, recent failures, stale state, or evaluator findings remain.",
    "- If you edit files, run focused checks and cite them before finish.",
    "",
    "Start with these files:",
    `- ${appDir}/project.json`,
    `- ${appDir}/tasks/tree.json`,
    `- ${appDir}/app.ts`,
    `- ${appDir}/workflows/platform-owner-review.ts`,
    "",
    "## System Review Packet",
    "```json",
    safePacketJson,
    "```",
    "",
    triggerBlock(ctx.task),
  ].join("\n");

  const result = await ctx.runAgent("may", prompt, { timeoutMs: 1_800_000 });
  const summary = resultSummary(result);
  ctx.emit({
    type: "project.reviewed",
    project: "may-agent",
    owner: "may",
    summary,
  });
  return ctx.done(summary);
}
