import type { TaskWorkload, TaskWorkloadOptions } from "@may-agent/sdk";
import { appTaskReadinessById, type AppTaskContext } from "../tasks/app-task-store.js";
import { pendingTaskExecutionRetryAt, taskExecutionRetryExhausted } from "../tasks/app-task-state.js";
import { readAppTaskAgent } from "../tasks/app-task-reconciler.js";
import { listRuntimeTaskViews } from "./app-read.js";
import type { AppTaskRuntimeOptions } from "../tasks/runtime-options.js";
import type { AppTaskRuntimeDescriptor } from "../tasks/runtime-definition.js";
import type { AppTaskDispatch } from "../tasks/controller.js";
import { TaskBudgetAdmissionStore } from "../state/task-budget-admission.js";
import { utcBudgetPeriod, type BudgetPurpose, type BudgetSponsor } from "../state/task-budget-store.js";
import { TaskExecutionStore } from "../state/task-execution-store.js";
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

export function runtimeWorkloadSource(opts: AppTaskRuntimeOptions, descriptor?: AppTaskRuntimeDescriptor, dispatch?: AppTaskDispatch, taskId?: string): TaskWorkloadSource {
  const executionRecipient = opts.agents?.executionRecipient?.bind(opts.agents);
  return {
    ...(taskId ? { currentTaskId: taskId } : {}),
    ...(executionRecipient ? { executionRecipient } : {}),
    ...(opts.installControllers === false
      ? dispatch?.hostCapacityAtDispatch ? { host: () => dispatch.hostCapacityAtDispatch! } : {}
      : { host: () => opts.hostCapacity.workloadSnapshot() }),
    ...(dispatch && taskId ? { dispatch: { ...dispatch, taskId } } : {}),
    ...(descriptor?.app.conversation ? { foregroundTaskIds: (taskIds: readonly string[]) =>
      new Set(taskIds.filter(id => descriptor.resourceStore.hasPendingHumanConversationInput(id))) } : {}),
  };
}

/** Same read snapshot as readiness and credits, using only live reservations.
 * Current-root scope comes from trusted context, never a workload argument. */
function readWorkloadExecution(
  config: AppTaskContext, source: TaskWorkloadSource | undefined, agent: string | undefined,
): Pick<TaskWorkload["limits"], "sharedHost" | "agent" | "root"> {
  const executions = new TaskExecutionStore(config.resourceStore.db);
  const result: Pick<TaskWorkload["limits"], "sharedHost" | "agent" | "root"> = {
    sharedHost: { available: false }, agent: { available: false }, root: { available: false },
  };
  const host = executions.usage({ kind: "host" });
  if (host.limit === null) return result;
  const { backgroundMaxConcurrent } = executions.hostPolicy()!;
  const backgroundOccupied = executions.backgroundOccupied();
  const remaining = Math.max(0, host.limit - host.occupied);
  result.sharedHost = { available: true, scope: "installation", maxConcurrent: host.limit,
    occupied: host.occupied, remaining, backgroundMaxConcurrent, backgroundOccupied,
    backgroundRemaining: Math.max(0, Math.min(remaining, backgroundMaxConcurrent - backgroundOccupied)) };
  const taskId = source?.currentTaskId;
  const selectedAgent = agent ?? (taskId ? readAppTaskAgent(config, taskId) : undefined);
  const recipient = selectedAgent ? source?.executionRecipient?.(selectedAgent) : null;
  if (recipient) {
    const usage = executions.usage({ kind: "agent", recipient });
    if (usage.limit !== null) result.agent = { available: true, scope: "installation-recipient", recipient: structuredClone(recipient),
      maxConcurrent: usage.limit, occupied: usage.occupied, remaining: Math.max(0, usage.limit - usage.occupied) };
  }
  const task = taskId ? { appId: config.resourceStore.appId, taskId } : null;
  const root = task ? new TaskBudgetAdmissionStore(config.resourceStore.db).budget.binding(task) : null;
  if (root && task) {
    const usage = executions.usage({ kind: "root", root });
    if (usage.limit !== null) result.root = { available: true, scope: "current-task-root", task, root,
      maxConcurrent: usage.limit, occupied: usage.occupied, remaining: Math.max(0, usage.limit - usage.occupied) };
  }
  return result;
}

/** Caller holds the same SQLite snapshot as Task readiness. Exact keyed reads
 * only; observing a UTC grant never publishes it or changes accounting. */
function readWorkloadFunding(
  config: AppTaskContext,
  taskId: string | undefined,
  now: number,
): NonNullable<TaskWorkload["funding"]> {
  const accounting = new TaskBudgetAdmissionStore(config.resourceStore.db);
  const period = utcBudgetPeriod(now);
  const grant = (sponsor: BudgetSponsor, purpose: BudgetPurpose) => {
    const saved = accounting.db
      .prepare(
        `SELECT credits, charged FROM task_credit_grants
      WHERE sponsor_app_id = ? AND sponsor_agent = ? AND purpose = ? AND period = ?`,
      )
      .get(sponsor.appId, sponsor.agent, purpose, period);
    const policy = accounting.policy(sponsor.appId);
    const configured =
      policy?.sponsor.agent === sponsor.agent
        ? purpose === "ordinary"
          ? policy.dailyCredits
          : policy.coordination?.dailyCredits
        : undefined;
    const credits = (saved?.credits as number | undefined) ?? configured;
    if (credits === undefined) return null;
    const charged = (saved?.charged as number | undefined) ?? 0;
    return { credits, charged, remaining: Math.max(0, credits - charged) };
  };
  const policy = accounting.policy(config.resourceStore.appId);
  const ordinary = policy ? grant(policy.sponsor, "ordinary") : null;
  const task = taskId ? { appId: config.resourceStore.appId, taskId } : null;
  const root = task ? accounting.budget.view(task, now) : null;
  return {
    ordinary:
      ordinary && policy ? { available: true, sponsor: policy.sponsor, period, ...ordinary } : { available: false },
    currentRoot:
      root && task
        ? {
            available: true,
            task,
            root: root.root,
            sponsor: root.sponsor,
            purpose: root.purpose,
            renewal: root.renewal,
            period: root.rootPeriod,
            credits: root.credits,
            charged: root.rootCharged,
            remaining: Math.max(0, root.credits - root.rootCharged),
            sponsorRemaining: grant(root.sponsor, root.purpose)?.remaining ?? null,
          }
        : { available: false },
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
    const readiness = appTaskReadinessById({ ...tree, project_lifecycle: "active" }, config.maxConcurrent, phases, observedAt);
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
        host: structuredClone(opts.workloadSource?.host?.() ?? { available: false }),
        ...readWorkloadExecution(config, opts.workloadSource, agent),
      },
      queueWait: opts.workloadSource?.dispatch ? {
        available: true, scope: "current-task-dispatch",
        appId: store.appId, taskId: opts.workloadSource.dispatch.taskId,
        enqueuedAt: opts.workloadSource.dispatch.enqueuedAt,
        dispatchedAt: opts.workloadSource.dispatch.startedAt,
        elapsedMs: opts.workloadSource.dispatch.readyWaitMs,
        lifetime: "current-controller",
      } : { available: false },
      resourceHealth: { available: false },
      funding: readWorkloadFunding(config, opts.workloadSource?.currentTaskId, observedAt),
    };
    const blocker = (taskId: string, kind: TaskWorkload["examples"]["blockers"][number]["kind"], constraint?: { reason: string; retryAt: number | null; requiredSlots?: number; scope?: { kind: "host" | "agent" | "root" | "recipient" } }) => {
      if (result.examples.blockers.length < 5 && Buffer.byteLength(taskId) <= 256)
        result.examples.blockers.push({ taskId, kind, ...(constraint ? { reason: constraint.reason, retryAt: constraint.retryAt,
          ...(constraint.requiredSlots ? { requiredSlots: constraint.requiredSlots } : {}),
          ...(constraint.scope ? { scope: constraint.scope.kind } : {}) } : {}) });
      else result.examples.truncated = true;
    };
    for (const task of page.items) {
      if (agent && readAppTaskAgent(config, task.id, tree) !== agent) continue;
      result.coverage.matched++;
      const resource = tree.resources?.[task.id];
      if (!resource) { result.counts.unknown++; blocker(task.id, "unknown"); continue; }
      if (tree.taskTriggers?.[task.id] || Object.keys(resource.status.inputWaits ?? {}).length)
        result.counts.pendingInputTasks++;
      if (task.status === "running") result.counts.running++;
      else if (taskExecutionRetryExhausted(resource)) result.counts.attention++;
      else if (pendingTaskExecutionRetryAt(resource, observedAt)) {
        result.counts.cooldown++; blocker(task.id, "cooldown");
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
          } else {
            result.counts.runnable++;
            if (state === "capacity-blocked" && resource.status.executionConstraint)
              blocker(task.id, "capacity", resource.status.executionConstraint);
          }
        }
        else if (task.status === "attention" && state === "not-applicable") result.counts.attention++;
        else if (state === "funding-blocked") {
          result.counts.waiting++; blocker(task.id, "funding", resource.status.funding);
        } else if (state === "resource-blocked") {
          result.counts.waiting++; blocker(task.id, "workspace", resource.status.workspaceConstraint);
          const example = result.examples.blockers.at(-1);
          const constraint = resource.status.workspaceConstraint;
          if (example?.taskId === task.id && constraint) example.workspace = {
            operation: "checkout", requiredBytes: constraint.requiredBytes, availableBytes: constraint.availableBytes,
            observedAt: constraint.observedAt,
          };
        } else if (state === "dependency-blocked" || state === "condition-blocked") {
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
