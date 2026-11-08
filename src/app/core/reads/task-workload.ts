import type { TaskWorkload, TaskWorkloadOptions } from "@may-agent/sdk";
import { appTaskReadinessById, type AppTaskContext } from "../tasks/app-task-store.js";
import { pendingTaskExecutionRetryAt, taskExecutionRetryExhausted } from "../tasks/app-task-state.js";
import { readAppTaskAgent } from "../tasks/app-task-reconciler.js";
import { listRuntimeTaskViews } from "./app-read.js";
import type { AppTaskRuntimeOptions } from "../tasks/runtime-options.js";
import type { AppTaskRuntimeDescriptor } from "../tasks/runtime-definition.js";

export type TaskWorkloadSource = {
  /** Absent in an isolated attempt worker: its limiter is not Host authority. */
  host?: () => TaskWorkload["limits"]["host"];
  foregroundTaskIds?: (taskIds: readonly string[]) => ReadonlySet<string>;
};

export function runtimeWorkloadSource(opts: AppTaskRuntimeOptions, descriptor?: AppTaskRuntimeDescriptor): TaskWorkloadSource {
  return {
    ...(opts.installControllers === false ? {} : { host: () => opts.hostCapacity.workloadSnapshot() }),
    ...(descriptor?.app.conversation ? { foregroundTaskIds: (taskIds: readonly string[]) =>
      new Set(taskIds.filter(id => descriptor.resourceStore.hasPendingHumanConversationInput(id))) } : {}),
  };
}

/** A bounded page over existing Task authority, never a second work ledger. */
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
    const tree = store.readTaskContext({ taskIds: page.items.map(task => task.id) }, {
      childLimit: 0, includeHistory: false, maxRelatedItems: 512,
    });
    const phases = store.readTaskViewPhases(page.items.map(task => task.id));
    // Keep prerequisite readiness distinct from scheduling pause; existing
    // human Conversation eligibility is the only pause exception today.
    const readiness = appTaskReadinessById({ ...tree, project_lifecycle: "active" }, config.maxConcurrent, phases);
    const foreground = opts.workloadSource?.foregroundTaskIds?.(page.items.map(task => task.id)) ?? new Set<string>();
    const result: TaskWorkload = {
      version: 1, observedAt: new Date(observedAt).toISOString(),
      scope: { appId: store.appId, ...(agent ? { agent } : {}) },
      coverage: { limit: options.limit ?? 50, scanned: page.items.length, matched: 0,
        truncated: Boolean(page.nextCursor), ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}) },
      counts: { running: 0, runnable: 0, waiting: 0, attention: 0, idle: 0,
        paused: 0, cooldown: 0, unknown: 0, pendingInputTasks: 0 },
      examples: { blockers: [], dispositionCandidates: [], truncated: false },
      limits: {
        app: { backgroundMaxConcurrent: config.maxConcurrent, interactiveAdditional: 1 },
        host: opts.workloadSource?.host?.() ?? { available: false },
        agent: { available: false }, root: { available: false },
      },
      queueWait: { available: false },
      resourceHealth: { available: false },
    };
    const blocker = (taskId: string, kind: TaskWorkload["examples"]["blockers"][number]["kind"]) => {
      if (result.examples.blockers.length < 5 && Buffer.byteLength(taskId) <= 256)
        result.examples.blockers.push({ taskId, kind });
      else result.examples.truncated = true;
    };
    for (const task of page.items) {
      if (agent && readAppTaskAgent(config, task.id, tree) !== agent) continue;
      result.coverage.matched++;
      const resource = tree.resources?.[task.id];
      if (!resource) { result.counts.unknown++; blocker(task.id, "unknown"); continue; }
      if (tree.taskTriggers?.[task.id]) result.counts.pendingInputTasks++;
      if (task.status === "running") result.counts.running++;
      else if (taskExecutionRetryExhausted(resource)) result.counts.attention++;
      else if (pendingTaskExecutionRetryAt(resource, observedAt)) {
        result.counts.cooldown++; blocker(task.id, "cooldown");
      } else if (task.status === "attention") {
        result.counts.attention++;
      } else if (task.status === "idle") {
        result.counts.idle++;
        // This is an inspection candidate, including standing responsibilities.
        // No persisted consumed marker or fulfillment inference is invented.
        if (resource.status.observedGeneration === resource.metadata.generation &&
            resource.status.observedAttemptId && (resource.status.response?.trim() || resource.status.summary?.trim())) {
          const id = resource.status.observedAttemptId;
          if (result.examples.dispositionCandidates.length < 5 && Buffer.byteLength(task.id) <= 256 && Buffer.byteLength(id) <= 256)
            result.examples.dispositionCandidates.push({ taskId: task.id, acceptedAttemptId: id });
          else result.examples.truncated = true;
        }
      } else {
        const state = readiness[task.id]?.state;
        if (state === "ready" || state === "capacity-blocked") {
          if (tree.project_lifecycle !== "active" && !foreground.has(task.id)) {
            result.counts.paused++; blocker(task.id, "paused");
          } else result.counts.runnable++;
        }
        else if (state === "dependency-blocked" || state === "condition-blocked") {
          result.counts.waiting++; blocker(task.id, state === "dependency-blocked" ? "dependency" : "waiting");
        } else { result.counts.unknown++; blocker(task.id, "unknown"); }
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
