import type { TaskWorkload, TaskWorkloadOptions } from "@may-agent/sdk";
import { appTaskReadinessById, type AppTaskContext } from "../tasks/app-task-store.js";
import { pendingTaskExecutionRetryAt, taskExecutionRetryExhausted } from "../tasks/app-task-state.js";
import { readAppTaskAgent } from "../tasks/app-task-reconciler.js";
import { listRuntimeTaskViews } from "./app-read.js";
import type { AppTaskRuntimeOptions } from "../tasks/runtime-options.js";
import type { AppTaskRuntimeDescriptor } from "../tasks/runtime-definition.js";
import type { AppTaskDispatch } from "../tasks/controller.js";
import type { ExecutionRecipient } from "../../../lib/execution-recipient.js";

export type TaskWorkloadSource = {
  /** Trusted attempt context, never a workload query argument. */
  currentTaskId?: string;
  /** Same pinned definitions as execution; aliases are never capacity keys. */
  executionRecipient?: (agent: string) => ExecutionRecipient | null;
  /** Absent in an isolated attempt worker: its limiter is not Host authority. */
  host?: () => TaskWorkload["limits"]["host"];
  foregroundTaskIds?: (taskIds: readonly string[]) => ReadonlySet<string>;
  dispatch?: AppTaskDispatch & { taskId: string };
};

export function runtimeWorkloadSource(
  opts: AppTaskRuntimeOptions,
  descriptor?: AppTaskRuntimeDescriptor,
  dispatch?: AppTaskDispatch,
  taskId?: string,
): TaskWorkloadSource {
  const executionRecipient = opts.agents?.executionRecipient?.bind(opts.agents);
  return {
    ...(taskId ? { currentTaskId: taskId } : {}),
    ...(executionRecipient ? { executionRecipient } : {}),
    ...(opts.installControllers === false
      ? dispatch?.hostCapacityAtDispatch
        ? { host: () => dispatch.hostCapacityAtDispatch! }
        : {}
      : { host: () => opts.hostCapacity.workloadSnapshot() }),
    ...(dispatch && taskId ? { dispatch: { ...dispatch, taskId } } : {}),
    ...(descriptor?.app.conversation
      ? {
          foregroundTaskIds: (taskIds: readonly string[]) =>
            new Set(taskIds.filter((id) => descriptor.resourceStore.hasPendingHumanConversationInput(id))),
        }
      : {}),
  };
}

function readUnadmittedInputs(config: AppTaskContext, cursor?: string): NonNullable<TaskWorkload["unadmittedInputs"]> {
  let after = "";
  if (cursor !== undefined) {
    after = typeof cursor === "string" ? Buffer.from(cursor, "base64url").toString("utf8") : "";
    if (!after || Buffer.from(after, "utf8").toString("base64url") !== cursor)
      throw new Error("Invalid workload input cursor");
  }
  const rows = config.resourceStore.db
    .prepare(
      `SELECT id, input_kind, source_kind, source_id, created_at, changed_at
    FROM app_inbox_items INDEXED BY idx_app_inbox_admission_read
    WHERE app_id = ? AND status != 'done' AND execution_task_id IS NULL
      AND (waiting_on_kind IS NULL OR waiting_on_kind != 'task') AND id > ?
    ORDER BY id LIMIT 6`,
    )
    .all(config.resourceStore.appId, after) as Array<{
    id: string;
    input_kind: string;
    source_kind: "human" | "app" | "system";
    source_id: string;
    created_at: number;
    changed_at: number | null;
  }>;
  const selected = rows.slice(0, 5);
  const items = selected.flatMap((row) =>
    [row.id, row.input_kind, row.source_id].some((value) => Buffer.byteLength(value) > 1024)
      ? []
      : [
          {
            id: row.id,
            kind: row.input_kind,
            source: { kind: row.source_kind, id: row.source_id },
            receivedAt: row.created_at,
            changedAt: row.changed_at ?? row.created_at,
          },
        ],
  );
  return {
    scope: { appId: config.resourceStore.appId },
    coverage: {
      limit: 5,
      scanned: selected.length,
      truncated: rows.length > 5,
      ...(rows.length > 5 ? { nextCursor: Buffer.from(selected.at(-1)!.id, "utf8").toString("base64url") } : {}),
    },
    omitted: selected.length - items.length,
    items,
  };
}

/** Bounded projections over Task and Inbox authority, never a second ledger. */
export function readTaskWorkload(
  opts: { taskStateConfig?: AppTaskContext; workloadSource?: TaskWorkloadSource },
  options: TaskWorkloadOptions = {},
): TaskWorkload {
  const config = opts.taskStateConfig;
  if (!config) throw new Error("Workload reads require an App scope");
  if (options.agent !== undefined && (typeof options.agent !== "string" || !options.agent.trim()))
    throw new Error("Workload agent must be a non-empty string");
  const agent = options.agent?.trim().replace(/^agent:/, "");
  if (agent === "") throw new Error("Workload agent must be a non-empty string");
  const observedAt = Date.now();
  const store = config.resourceStore;
  store.db.exec("SAVEPOINT task_workload_read");
  try {
    const page = listRuntimeTaskViews(opts, {
      status: ["pending", "running", "waiting", "attention", "idle"],
      limit: options.limit ?? 50,
      ...(options.cursor !== undefined ? { cursor: options.cursor } : {}),
    });
    const tree = store.readTaskContext(
      { taskIds: page.items.map((task) => task.id) },
      { childLimit: 0, includeHistory: false, maxRelatedItems: 512 },
    );
    const phases = store.readTaskViewPhases(page.items.map((task) => task.id));
    const readiness = appTaskReadinessById(
      { ...tree, project_lifecycle: "active" },
      config.maxConcurrent,
      phases,
      observedAt,
    );
    const foreground = opts.workloadSource?.foregroundTaskIds?.(page.items.map((task) => task.id)) ?? new Set<string>();
    const result: TaskWorkload = {
      version: 1,
      observedAt: new Date(observedAt).toISOString(),
      scope: { appId: store.appId, ...(agent ? { agent } : {}) },
      coverage: {
        limit: options.limit ?? 50,
        scanned: page.items.length,
        matched: 0,
        truncated: Boolean(page.nextCursor),
        ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
      },
      counts: {
        running: 0,
        runnable: 0,
        waiting: 0,
        attention: 0,
        idle: 0,
        paused: 0,
        cooldown: 0,
        unknown: 0,
        pendingInputTasks: 0,
      },
      assignments: { rootTasks: 0, contributions: 0, unattributed: 0, representedRoots: 0 },
      unadmittedInputs: readUnadmittedInputs(config, options.inputCursor),
      examples: { blockers: [], dispositionCandidates: [], truncated: false },
      limits: {
        app: { backgroundMaxConcurrent: config.maxConcurrent, interactiveAdditional: 1 },
        host: structuredClone(opts.workloadSource?.host?.() ?? { available: false }),
        sharedHost: { available: false },
        agent: { available: false },
        root: { available: false },
      },
      queueWait: opts.workloadSource?.dispatch
        ? {
            available: true,
            scope: "current-task-dispatch",
            appId: store.appId,
            taskId: opts.workloadSource.dispatch.taskId,
            enqueuedAt: opts.workloadSource.dispatch.enqueuedAt,
            dispatchedAt: opts.workloadSource.dispatch.startedAt,
            elapsedMs: opts.workloadSource.dispatch.readyWaitMs,
            lifetime: "current-controller",
          }
        : { available: false },
      resourceHealth: { available: false },
      funding: { ordinary: { available: false }, currentRoot: { available: false } },
    };
    const blocker = (
      taskId: string,
      kind: TaskWorkload["examples"]["blockers"][number]["kind"],
      constraint?: { reason: string; retryAt: number | null },
    ) => {
      if (result.examples.blockers.length < 5 && Buffer.byteLength(taskId) <= 256)
        result.examples.blockers.push({
          taskId,
          kind,
          ...(constraint ? { reason: constraint.reason, retryAt: constraint.retryAt } : {}),
        });
      else result.examples.truncated = true;
    };
    const assignments = result.assignments!;
    for (const task of page.items) {
      if (agent && readAppTaskAgent(config, task.id, tree) !== agent) continue;
      result.coverage.matched++;
      assignments.unattributed++;
      const resource = tree.resources?.[task.id];
      if (!resource) {
        result.counts.unknown++;
        blocker(task.id, "unknown");
        continue;
      }
      if (tree.taskTriggers?.[task.id] || Object.keys(resource.status.inputWaits ?? {}).length)
        result.counts.pendingInputTasks++;
      if (task.status === "running") result.counts.running++;
      else if (taskExecutionRetryExhausted(resource)) result.counts.attention++;
      else if (pendingTaskExecutionRetryAt(resource, observedAt)) {
        result.counts.cooldown++;
        blocker(task.id, "cooldown");
      } else if (task.status === "idle") {
        result.counts.idle++;
        if (
          resource.status.observedGeneration === resource.metadata.generation &&
          resource.status.observedAttemptId &&
          (resource.status.response?.trim() || resource.status.summary?.trim())
        ) {
          const id = resource.status.observedAttemptId;
          if (
            result.examples.dispositionCandidates.length < 5 &&
            Buffer.byteLength(task.id) <= 256 &&
            Buffer.byteLength(id) <= 256
          )
            result.examples.dispositionCandidates.push({ taskId: task.id, acceptedAttemptId: id });
          else result.examples.truncated = true;
        }
      } else {
        const state = readiness[task.id]?.state;
        if (state === "ready" || state === "capacity-blocked") {
          if (tree.project_lifecycle !== "active" && !foreground.has(task.id)) {
            result.counts.paused++;
            blocker(task.id, "paused");
          } else {
            result.counts.runnable++;
          }
        } else if (task.status === "attention" && state === "not-applicable") result.counts.attention++;
        else if (state === "resource-blocked") {
          result.counts.waiting++;
          blocker(task.id, "workspace", resource.status.workspaceConstraint);
          const example = result.examples.blockers.at(-1);
          const constraint = resource.status.workspaceConstraint;
          if (example?.taskId === task.id && constraint)
            example.workspace = {
              operation: "checkout",
              requiredBytes: constraint.requiredBytes,
              availableBytes: constraint.availableBytes,
              observedAt: constraint.observedAt,
            };
        } else if (state === "dependency-blocked" || state === "condition-blocked") {
          result.counts.waiting++;
          blocker(task.id, state === "dependency-blocked" ? "dependency" : "waiting");
        } else {
          result.counts.unknown++;
          blocker(task.id, "unknown");
        }
      }
    }
    store.db.exec("RELEASE task_workload_read");
    return result;
  } catch (error) {
    store.db.exec("ROLLBACK TO task_workload_read");
    store.db.exec("RELEASE task_workload_read");
    throw error;
  }
}
