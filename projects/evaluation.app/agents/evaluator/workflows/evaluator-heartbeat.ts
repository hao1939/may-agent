import { existsSync, readFileSync } from "node:fs";
import {
  admitProjectAppTaskHandlerResult,
  projectAppTaskOwnerResultSchema,
  resolveTaskTreePath,
  type ProjectAppTaskHandlerResult,
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk/legacy";

export const name = "evaluator-heartbeat";
export const description = "evaluation app owner review.";

const APP_DIR = "/app/projects/evaluation.app";
function taskTreePath(appDir: string): string {
  return process.env.MAY_AGENT_TASK_TREE_PATH ?? resolveTaskTreePath(appDir);
}

type OwnerResult = Exclude<
  ProjectAppTaskHandlerResult,
  { state: "needs-owner" }
>;

type TaskRecord = {
  id: string;
  item_type?: "group" | "task";
  outcome?: string;
  parent_id?: string | null;
  phase?: string;
  generation?: number;
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

function contextSummary(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (value === null) return { omitted: true, kind: "null" };
  if (Array.isArray(value)) {
    return { omitted: true, kind: "array", items: value.length };
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    return {
      omitted: true,
      kind: "object",
      keyCount: keys.length,
      keys: keys.slice(0, 8),
      keysOmitted: Math.max(0, keys.length - 8),
    };
  }
  return { omitted: true, kind: typeof value };
}

function compactTask(task: TaskRecord): Record<string, unknown> {
  return {
    id: task.id,
    parent: task.parent_id ?? null,
    phase: task.phase ?? (task.item_type === "group" ? "structural" : "unknown"),
    priority: task.priority ?? "P2",
    outcome: truncate(task.outcome ?? "", 360),
    children: task.children?.length ?? 0,
    summary: task.summary ? truncate(task.summary, 500) : undefined,
    contextSummary: contextSummary(task.context),
  };
}

function compactTasks(
  tasks: TaskRecord[],
  phase: string,
  max: number,
): { items: Array<Record<string, unknown>>; omitted: number } {
  const matching = tasks.filter((task) => task.phase === phase);
  return {
    items: matching.slice(0, max).map(compactTask),
    omitted: Math.max(0, matching.length - max),
  };
}

function readTaskTree(appDir = APP_DIR): Record<string, unknown> | null {
  const path = taskTreePath(appDir);
  if (!existsSync(path)) return null;
  return readJson(path) as Record<string, unknown>;
}

function taskPacket(appDir = APP_DIR): Record<string, unknown> {
  const path = taskTreePath(appDir);
  const tree = readTaskTree(appDir);
  if (!tree) {
    return { error: `missing ${path}` };
  }
  const allItems = Object.values((tree.tasks ?? {}) as Record<string, TaskRecord>);
  const tasks = allItems.filter((task) => task.item_type === "task");
  const byPhase = tasks.reduce<Record<string, number>>((acc, task) => {
    const phase = task.phase ?? "unknown";
    acc[phase] = (acc[phase] ?? 0) + 1;
    return acc;
  }, {});
  const root = allItems.find((task) => task.id === tree.root_task_id);
  const runningSlice = compactTasks(tasks, "running", 10);
  const waitingSlice = compactTasks(tasks, "waiting", 10);
  const attentionSlice = compactTasks(tasks, "attention", 8);
  const pendingSlice = compactTasks(tasks, "pending", 8);
  const activeTaskIds = Array.isArray(tree.active_task_ids)
    ? tree.active_task_ids
    : [];
  return {
    schemaVersion: tree.schema_version,
    project: tree.project,
    updated_at: tree.updated_at,
    root_task_id: tree.root_task_id,
    active_task_ids: activeTaskIds.slice(0, 20),
    active_task_ids_omitted: Math.max(0, activeTaskIds.length - 20),
    taskCount: tasks.length,
    byPhase,
    root: root ? compactTask(root) : undefined,
    running: runningSlice.items,
    runningOmitted: runningSlice.omitted,
    waiting: waitingSlice.items,
    waitingOmitted: waitingSlice.omitted,
    attention: attentionSlice.items,
    attentionOmitted: attentionSlice.omitted,
    nextPending: pendingSlice.items,
    pendingOmitted: pendingSlice.omitted,
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

function taskById(
  tree: Record<string, unknown> | null,
  taskId: string,
): TaskRecord | null {
  const tasks = tree?.tasks;
  if (!tasks || typeof tasks !== "object" || Array.isArray(tasks)) return null;
  const task = (tasks as Record<string, TaskRecord>)[taskId];
  return task && typeof task === "object" ? task : null;
}

function currentTaskGeneration(task: TaskRecord | null): number | null {
  const generation = task?.generation;
  return typeof generation === "number" && Number.isFinite(generation)
    ? generation
    : null;
}

function currentTaskPhase(task: TaskRecord | null): string | null {
  const phase = task?.phase;
  return typeof phase === "string" && phase.length > 0 ? phase : null;
}

function actionTargetId(action: ProjectAppTaskHandlerResult["actions"][number]):
  | string
  | null {
  const candidate = (action as { taskId?: unknown }).taskId;
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : null;
}

function actionExpectedGeneration(
  action: ProjectAppTaskHandlerResult["actions"][number],
): number | null {
  const candidate = (action as { expectedGeneration?: unknown })
    .expectedGeneration;
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : null;
}

export function normalizeOwnerResult(
  rawResult: ProjectAppTaskHandlerResult | Record<string, unknown>,
): OwnerResult {
  let ownerResult = rawResult as OwnerResult;
  if ((ownerResult as { state?: unknown }).state === "needs-owner") {
    const forbiddenFields: string[] = [];
    if ("actions" in ownerResult) forbiddenFields.push("actions");
    if ("conditions" in ownerResult) forbiddenFields.push("conditions");
    return {
      state: "converged",
      summary: `Owner review returned invalid needs-owner${forbiddenFields.length > 0 ? ` with ${forbiddenFields.join(" and ")}` : ""}; treating the already-resolved owner judgment as a converged no-op. ${ownerResult.summary}`,
      evidence: [
        ...(Array.isArray(ownerResult.evidence) ? ownerResult.evidence : []),
        "Filtered invalid resolved-owner needs-owner result so the handler never returns the rejected 'needs-owner cannot include actions or Conditions' payload family.",
      ],
      actions: [],
    };
  }

  if (
    ownerResult.state === "waiting" &&
    (!ownerResult.conditions || ownerResult.conditions.length === 0)
  ) {
    ownerResult = {
      ...ownerResult,
      state: "converged",
      summary: `Owner review returned waiting without exact conditions; treating no-condition judgment as converged/no-op. ${ownerResult.summary}`,
    };
  }

  return ownerResult;
}

function actionRequiresActionablePhase(
  action: ProjectAppTaskHandlerResult["actions"][number],
): boolean {
  return ["update-task", "unblock-task"].includes(String(action.kind ?? ""));
}

function staleActionReason(
  action: ProjectAppTaskHandlerResult["actions"][number],
  tree: Record<string, unknown> | null,
): string | null {
  const kind = String(action.kind ?? "");
  if (!["update-task", "unblock-task", "close-task"].includes(kind)) {
    return null;
  }
  const targetId = actionTargetId(action);
  if (!targetId) return `${kind} action is missing taskId`;
  const target = taskById(tree, targetId);
  if (!target) return `${kind} ${targetId} targets a task that no longer exists`;

  const expectedGeneration = actionExpectedGeneration(action);
  const generation = currentTaskGeneration(target);
  if (
    expectedGeneration !== null &&
    generation !== null &&
    expectedGeneration !== generation
  ) {
    return `${kind} ${targetId} expected generation ${expectedGeneration} but current generation is ${generation}`;
  }

  const phase = currentTaskPhase(target);
  if (
    actionRequiresActionablePhase(action) &&
    phase &&
    phase !== "waiting" &&
    phase !== "attention"
  ) {
    return `${kind} ${targetId} is not waiting or in attention (current phase: ${phase})`;
  }

  if (kind === "close-task" && phase && phase === "converged") {
    return `${kind} ${targetId} already converged`;
  }

  return null;
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
        deliveryStatus: row.delivery_status,
        acceptedBy: row.accepted_by,
        acceptedAt: row.accepted_at,
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
          deliveryStatus: row.delivery_status,
          acceptedBy: row.accepted_by,
          acceptedAt: row.accepted_at,
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
    taskTree: taskPacket(ctx.appDir ?? APP_DIR),
    runtime: runtimePacket(ctx),
    allowedActions: [
      "create-task",
      "update-task",
      "close-task",
      "unblock-task",
    ],
  };

  const prompt = `You are the owner of evaluation.app.

Review this compact owner packet and propose how the app task tree should move forward.

Rules:
- Do not create standalone projects such as projects/evaluator-*.
- Do not run session aftermath unless the trigger includes a concrete sessionId.
- Keep this task tree limited to evaluation.app's own audit-system work. Findings about target projects must be delivered to their owners, not converted into evaluator-owned remediation tasks.
- If the trigger is a health tick, metric breach, owner request, or task-ready signal, review the task tree and runtime packet.
- If the trigger is an owner-message, treat it as an owner decision or instruction. Propose a typed action when it names a concrete task/state/resume condition.
- You are read-only. Do not write files, run shell commands, send messages, delegate work, or mutate the task tree. The app validates and applies only the typed actions in your finish result.
- Propose a task-tree action only when the durable task model changes: task creation, goal/acceptance/output refinement, closing accepted work, or unblocking an exact wait.
- Every created task must declare mode=achieve for bounded work or mode=maintain for standing desired state. Use update-task mode to migrate a legacy task; do not use or preserve task kinds.
- Include expectedGeneration from the task resource for every mutation of an existing task. Never propose changes to reconciler-owned task ids beginning with runtime/.
- A judgment that needs no tree edit remains durable in this reconciliation result; do not create a separate discussion write.
- A no-op returns an empty actions array. Do not refresh summaries, context, evidence timestamps, or updated_at merely to record another unchanged observation.
- If existing active tasks already cover the signal, say so and avoid churn.
- Do not send direct human messages from this owner heartbeat. Human-facing project-health notifications are handled by the deduped project-health evaluator path.
- If the issue belongs to platform/runtime ownership, describe the new actionable evidence in the result; this owner step cannot send messages directly.
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
    tools: "readonly",
    schema: projectAppTaskOwnerResultSchema,
  });

  let ownerResult: OwnerResult;
  if (result.status === "error" || result.status === "interrupted") {
    ownerResult = {
      state: "converged",
      summary:
        "Owner review session failed before producing a structured decision; preserving the task tree with no proposed actions so the standing monitor remains retryable on the next concrete wake.",
      evidence: [
        `owner-review-session:${result.sessionId ?? "unknown"}`,
        `owner-review-status:${result.status}`,
        `owner-review-summary:${truncate(String(result.lastAssistantText ?? ""), 500)}`,
      ],
      actions: [],
    };
    ctx.emit({
      type: "evaluation.owner_review_failed_fallback",
      source: "agent:evaluator",
      owner: "agent:evaluator",
      data: {
        triggerType: trigger?.type ?? null,
        lane: trigger?.lane ?? null,
        sessionId: result.sessionId ?? null,
        status: result.status,
        summary: result.lastAssistantText ?? "",
      },
    });
  } else {
    ownerResult = result.structuredResult as OwnerResult;
  }
  ownerResult = normalizeOwnerResult(ownerResult);

  const latestTree = readTaskTree(ctx.appDir ?? APP_DIR);
  const staleTargetActions = (ownerResult.actions ?? [])
    .map((action) => ({ action, reason: staleActionReason(action, latestTree) }))
    .filter((entry) => entry.reason !== null);
  if (staleTargetActions.length > 0) {
    ownerResult.actions = (ownerResult.actions ?? []).filter(
      (action) =>
        !staleTargetActions.some((entry) => entry.action === action),
    );
    ownerResult.evidence = [
      ...(ownerResult.evidence ?? []),
      `Filtered ${staleTargetActions.length} stale or non-actionable task mutation action(s) after live tree recheck: ${staleTargetActions
        .map((entry) => entry.reason)
        .join("; ")}`,
    ];
    ownerResult.summary = `Filtered stale/non-actionable task mutation action(s) after live tree recheck; ${ownerResult.summary}`;
  }

  const runtimeTaskMutationActions = (ownerResult.actions ?? []).filter(
    (action) => {
      const actionTaskId = (action as { taskId?: unknown }).taskId;
      return (
        ["close-task", "update-task", "unblock-task"].includes(
          String(action?.kind ?? ""),
        ) && String(actionTaskId ?? "").startsWith("runtime/")
      );
    },
  );
  if (runtimeTaskMutationActions.length > 0) {
    ownerResult.actions = (ownerResult.actions ?? []).filter(
      (action) => !runtimeTaskMutationActions.includes(action),
    );
    ownerResult.evidence = [
      ...(ownerResult.evidence ?? []),
      `Filtered ${runtimeTaskMutationActions.length} illegal runtime task mutation action(s): ${runtimeTaskMutationActions
        .map(
          (action) =>
            `${String(action.kind)} ${String((action as { taskId?: unknown }).taskId)}`,
        )
        .join(", ")}`,
    ];
    ownerResult.summary = `Filtered illegal runtime task mutation action(s) from owner review result; ${ownerResult.summary}`;
  }

  ctx.emit({
    type: "evaluation.owner_reviewed",
    source: "agent:evaluator",
    owner: "agent:evaluator",
    data: {
      triggerType: trigger?.type ?? null,
      lane: trigger?.lane ?? null,
      sessionId: result.sessionId,
      state: ownerResult.state,
      proposedActions: ownerResult.actions ?? [],
      evidence: ownerResult.evidence,
    },
  });

  return ctx.done(ownerResult.summary, ownerResult);
}
