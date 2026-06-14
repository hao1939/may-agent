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
): Record<string, unknown> {
  const since = Date.now() - 60 * 60_000;
  const result: Record<string, unknown> = {};
  for (const type of types) {
    try {
      const rows = ctx.query.events({ type, since, limit: 8 }).rows as Array<
        Record<string, unknown>
      >;
      result[type] = compactRows(rows);
    } catch (error) {
      result[type] = {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return result;
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
): Record<string, unknown> {
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

  return {
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
    recent_abnormal_events: recentEvents(ctx, [
      "handler.failed",
      "session.resume_failed",
      "subscriber.failed",
      "message.delivery_failed",
      "agent.config_invalid",
      "metric.breach",
      "metric.recovered",
      "metric.stalled",
      "message.created",
    ]),
    owner_sessions: compactRows(ownerSessions, 10),
    active_may_sessions: compactRows(activeMaySessions, 10),
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
  const packet = buildReviewPacket(ctx, appDir);
  const packetJson = JSON.stringify(packet, null, 2);

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
