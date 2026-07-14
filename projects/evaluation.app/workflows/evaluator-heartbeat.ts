import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  resolveTaskTreePath,
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk";

export const name = "evaluator-heartbeat";
export const description = "evaluation app owner review.";

const APP_DIR = "/app/projects/evaluation.app";
const TASK_TREE_PATH = resolveTaskTreePath(APP_DIR);
const DISCUSSION_PATH = join(APP_DIR, "discussion.md");

type TaskRecord = {
  id: string;
  goal?: string;
  parent_id?: string | null;
  state?: string;
  priority?: string;
  owner?: string;
  children?: string[];
  summary?: string;
  context?: unknown;
};

function parseTrigger(task: string): Record<string, unknown> | null {
  const header = "\n## Trigger Event";
  const idx = task.lastIndexOf(header);
  const start =
    idx >= 0 ? idx + 1 : task.startsWith("## Trigger Event") ? 0 : -1;
  if (start < 0) return null;
  const tail = task.slice(start);
  const fence = tail.indexOf("```json");
  if (fence < 0) return null;
  const jsonStart = fence + "```json".length;
  const jsonEnd = tail.indexOf("```", jsonStart);
  if (jsonEnd < 0) return null;
  try {
    return JSON.parse(tail.slice(jsonStart, jsonEnd).trim());
  } catch {
    return null;
  }
}

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function compactTask(task: TaskRecord): Record<string, unknown> {
  return {
    id: task.id,
    parent: task.parent_id ?? null,
    state: task.state ?? "unknown",
    priority: task.priority ?? "P2",
    goal: task.goal ?? "",
    children: task.children?.length ?? 0,
    summary: task.summary,
    context: task.context,
  };
}

function taskPacket(): Record<string, unknown> {
  if (!existsSync(TASK_TREE_PATH)) {
    return { error: `missing ${TASK_TREE_PATH}` };
  }
  const tree = readJson(TASK_TREE_PATH);
  const tasks = Object.values((tree.tasks ?? {}) as Record<string, TaskRecord>);
  const byState = tasks.reduce<Record<string, number>>((acc, task) => {
    const state = task.state ?? "unknown";
    acc[state] = (acc[state] ?? 0) + 1;
    return acc;
  }, {});
  const active = tasks
    .filter((task) => task.state === "active")
    .map(compactTask);
  const backlog = tasks
    .filter((task) => task.state === "backlog")
    .map(compactTask);
  const blocked = tasks
    .filter((task) => task.state === "blocked")
    .map(compactTask);
  return {
    version: tree.version,
    project: tree.project,
    updated_at: tree.updated_at,
    root_task_id: tree.root_task_id,
    active_task_ids: tree.active_task_ids ?? [],
    byState,
    active,
    blocked,
    nextBacklog: backlog.slice(0, 8),
  };
}

function queryRows(
  ctx: WorkflowContext,
  label: string,
  fn: () => unknown,
): unknown {
  try {
    return fn();
  } catch (err) {
    return {
      unavailable: true,
      label,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function parseEventData(row: Record<string, unknown>): Record<string, unknown> {
  const raw = row.data;
  if (typeof raw !== "string" || raw.length === 0) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function truncate(text: string, max = 700): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function isEvaluationRuntimeEvent(row: Record<string, unknown>): boolean {
  const type = String(row.event_type ?? row.type ?? "");
  if (type.startsWith("evaluation.")) return true;
  if (type === "session.end") return true;
  if (!type.startsWith("metric.")) return false;

  const data = parseEventData(row);
  const owner = String(row.owner ?? "");
  const project = String(data.project ?? data.appId ?? "");
  const metric = String(data.metricId ?? data.metric_id ?? data.metric ?? "");
  return (
    project === "evaluation" ||
    project === "evaluation.app" ||
    owner === "agent:evaluator" ||
    owner === "evaluator" ||
    metric.startsWith("evaluator.") ||
    metric.startsWith("evaluation.") ||
    metric.startsWith("eval.")
  );
}

function isEvaluatorOwnerCommunication(row: Record<string, unknown>): boolean {
  const eventType = String(row.event_type ?? row.type ?? "");
  if (eventType !== "message.created" && eventType !== "telegram.reply") {
    return false;
  }
  const data = parseEventData(row);
  const owner = String(row.owner ?? "");
  const to = String(data.to ?? "");
  const project = String(data.project ?? data.projectId ?? "");
  const target = data.target;
  const targetProject =
    target && typeof target === "object" && !Array.isArray(target)
      ? String((target as Record<string, unknown>).project ?? "")
      : "";
  const targetOwner =
    target && typeof target === "object" && !Array.isArray(target)
      ? String((target as Record<string, unknown>).owner ?? "")
      : "";

  return (
    owner === "agent:evaluator" ||
    owner === "evaluator" ||
    to === "evaluator" ||
    targetOwner === "agent:evaluator" ||
    targetOwner === "evaluator" ||
    project === "evaluation" ||
    project === "evaluation.app" ||
    targetProject === "evaluation" ||
    targetProject === "evaluation.app"
  );
}

function runtimePacket(ctx: WorkflowContext): Record<string, unknown> {
  const now = Date.now();
  const last6h = now - 6 * 60 * 60 * 1000;
  const evaluatorMetrics = queryRows(ctx, "metrics", () =>
    ctx.query.metrics({ owner: "evaluator", limit: 30 }).rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      current: row.current,
      target: row.target,
      threshold: row.threshold,
      alert_op: row.alert_op,
      updated_at: row.updated_at,
      priority: row.priority,
    })),
  );
  const recentWorkflowRuns = queryRows(ctx, "workflowRuns", () =>
    ctx.query
      .workflowRuns({ since: last6h, limit: 30 })
      .rows.filter((row) => String(row.workflow ?? "").startsWith("evaluator-"))
      .map((row) => ({
        workflow: row.workflow,
        status: row.status,
        startedAt: row.startedAt ?? row.started_at,
        completedAt: row.completedAt ?? row.completed_at,
        result: row.result_summary ?? row.summary,
      })),
  );
  const recentEvents = queryRows(ctx, "events", () =>
    ctx.query
      .events({ since: last6h, limit: 80 })
      .rows.filter((row) => isEvaluationRuntimeEvent(row))
      .slice(0, 30)
      .map((row) => ({
        id: row.id,
        type: row.event_type ?? row.type,
        source: row.source,
        owner: row.owner,
        status: row.status,
        handled_by: row.handled_by,
        timestamp: row.timestamp,
      })),
  );
  const recentOwnerMessages = queryRows(ctx, "ownerMessages", () =>
    ctx.query
      .events({ since: last6h, limit: 160 })
      .rows.filter((row) => isEvaluatorOwnerCommunication(row))
      .slice(0, 20)
      .map((row) => {
        const data = parseEventData(row);
        return {
          id: row.id,
          type: row.event_type ?? row.type,
          source: row.source,
          owner: row.owner,
          status: row.status,
          timestamp: row.timestamp,
          from: data.from,
          to: data.to,
          intent: data.intent,
          priority: data.priority,
          conversationId: data.conversationId,
          content: truncate(String(data.content ?? ""), 1200),
        };
      }),
  );
  return {
    now,
    evaluatorMetrics,
    recentWorkflowRuns,
    recentEvents,
    recentOwnerMessages,
  };
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const trigger = parseTrigger(String(ctx.task ?? ""));
  const packet = {
    app: "evaluation.app",
    trigger,
    taskTree: taskPacket(),
    runtime: runtimePacket(ctx),
    writableFiles: [TASK_TREE_PATH, DISCUSSION_PATH],
  };

  const prompt = `You are the owner of evaluation.app.

Review this compact owner packet and drive the app task tree forward.

Rules:
- Do not create standalone projects such as projects/evaluator-*.
- Do not run session aftermath unless the trigger includes a concrete sessionId.
- If the trigger is a health tick, metric breach, owner request, or task-ready signal, review the task tree and runtime packet.
- If the trigger is an owner-message, treat it as an owner decision or instruction. Apply it to the task tree when it names a concrete task/state/resume condition.
- Update the task tree when it needs a new leaf, clearer context, a state change, or a rollup.
- Append projects/evaluation.app/discussion.md when you make an owner judgment that should be durable but does not need a tree edit.
- If existing active tasks already cover the signal, say so and avoid churn.
- Do not send direct human messages from this owner heartbeat. Human-facing project-health notifications are handled by the deduped project-health evaluator path.
- If the issue belongs to platform/runtime ownership, send one concise message to the exact agent owner only when there is new actionable evidence. Do not send repeated "still unresolved" status updates.
- If an owner message says an active task is resolved, accepted as normal, or should be closed, update the task state/context instead of re-escalating the same family.
- Finish with what changed, what remains active, and the next wake condition.

Owner packet:
\`\`\`json
${JSON.stringify(packet, null, 2)}
\`\`\``;

  ctx.emit({
    type: "evaluation.owner_review_started",
    source: "agent:evaluator",
    owner: "agent:evaluator",
    data: { triggerType: trigger?.type ?? null, lane: trigger?.lane ?? null },
  });

  const result = await ctx.runAgent("evaluator", prompt, {
    timeoutMs: 900_000,
  });
  if (result.status === "error" || result.status === "interrupted") {
    return ctx.blocked("Evaluation owner review session failed", {
      sessionId: result.sessionId,
      status: result.status,
      summary: result.lastAssistantText,
    });
  }

  ctx.emit({
    type: "evaluation.owner_reviewed",
    source: "agent:evaluator",
    owner: "agent:evaluator",
    data: {
      triggerType: trigger?.type ?? null,
      lane: trigger?.lane ?? null,
      sessionId: result.sessionId,
    },
  });

  return ctx.done(ctx.summarize(result, { maxLength: 700 }));
}
