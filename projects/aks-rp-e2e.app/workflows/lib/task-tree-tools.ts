import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { extname, join, resolve } from "node:path";
import {
  appendToolJournal,
  completeTask as sdkCompleteTask,
  isLeaf,
  markTaskDone as sdkMarkTaskDone,
  planningPacket as sdkPlanningPacket,
  normalizeStringArray,
  pruneMissingChildren,
  readTask,
  readTaskTree,
  repairTaskTreeRollups as sdkRepairTaskTreeRollups,
  rollupParent as sdkRollupParent,
  saveTaskTreeWithKanbanSnapshot,
  withTreeLock,
  type RollupParentInput,
  type TaskNode,
  type TaskPlanningPacket,
  type TaskTree,
  type TaskTreeConfig,
  type TaskTreeCompactResult,
} from "@may-agent/sdk";
import { compactDoneLeaves as sdkCompactDoneLeaves } from "@may-agent/sdk";
import {
  exactBlockedWaitStewardshipProgress,
  runnableDurableLoopProgress,
} from "./durable-loop-wait-stewardship.ts";
import {
  defaultSpecLoopStatePath,
  type SpecLoopSpecState,
  type SpecLoopState,
} from "./spec-loop-store.ts";
import {
  specLoopSpecHasStructuredSuccessor,
  specStateSelfRepresentsExactFrontier,
} from "./spec-loop-frontier.ts";

export {
  appendPlannerRun,
  appendToolJournal,
  assignRunnableBacklogTasks,
  assignTask,
  confirmRunnableBacklogLeaves,
  createTask,
  drainTaskAssignments,
  kanbanTaskTreeState,
  listRunnableBacklogTaskIds,
  peekTaskAssignments,
  pruneMissingChildren,
  readTask,
  rejectTaskReview,
  requeueStaleActiveTasks,
  updateTaskOutputs,
  updateTaskText,
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  taskKanbanColumn,
  taskTreeConfig,
  unblockTask,
  writeKanbanSnapshot,
  waitingBacklogTaskSnapshots,
} from "@may-agent/sdk";
export type {
  CreateTaskInput,
  RunnableBacklogAssignmentResult,
  TaskAssignment,
  TaskCompletionClaim,
  TaskKanbanColumn,
  TaskKanbanProjection,
  TaskKanbanSnapshot,
  TaskKanbanState,
  RejectTaskReviewInput,
  RollupParentInput,
  TaskPlanningPacket,
  TaskTreePruneMissingChildrenResult,
  TaskPlanningSnapshot,
  TaskTreeCompactionCandidate,
  TaskTreeHygieneSummary,
  TaskTreeConfig,
  TaskTreeCompactResult,
  TaskTreeRepairResult,
  TaskTreeSummary,
  TaskTreeToolConfig,
  UnblockTaskInput,
  UpdateTaskOutputsInput,
  UpdateTaskTextInput,
} from "@may-agent/sdk";

export const completeTask = sdkCompleteTask;

function taskContext(task: TaskNode): Record<string, unknown> {
  return task.context &&
    typeof task.context === "object" &&
    !Array.isArray(task.context)
    ? (task.context as Record<string, unknown>)
    : {};
}

function workflowProgress(task: TaskNode): Record<string, unknown> | null {
  const progress = taskContext(task).workflowProgress;
  return progress && typeof progress === "object" && !Array.isArray(progress)
    ? (progress as Record<string, unknown>)
    : null;
}

function pausedDurableLoopWaitStewardship(task: TaskNode): boolean {
  if (!durableLoopTaskIds.has(task.id)) return false;
  return exactBlockedWaitStewardshipProgress(workflowProgress(task));
}

function workflowProgressBlocksCompletion(task: TaskNode): string | null {
  const progress = workflowProgress(task);
  if (!progress || progress.completionReady !== false) return null;
  if (pausedDurableLoopWaitStewardship(task)) return null;
  const reason =
    typeof progress.reason === "string" && progress.reason.trim()
      ? progress.reason.trim()
      : "workflow progress reports that task acceptance is not complete";
  const pending =
    typeof progress.pending === "number" ? ` pending=${progress.pending}` : "";
  const running =
    typeof progress.running === "number" ? ` running=${progress.running}` : "";
  const blocked =
    typeof progress.blocked === "number" ? ` blocked=${progress.blocked}` : "";
  return `${reason}.${pending}${running}${blocked}`.trim();
}

function stringValue(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function representedSpecIdsForTask(task: TaskNode): string[] {
  const ids = new Set<string>();
  const context = taskContext(task);
  for (const key of ["representedSpecIds", "sampledSpecIds", "specIds"]) {
    for (const value of normalizeStringArray(context[key])) ids.add(value);
  }
  const specId = stringValue(context.specId);
  if (specId) ids.add(specId);
  for (const input of normalizeStringArray(task.inputs)) {
    if (input.startsWith("spec:")) {
      const scopedSpecId = input.slice("spec:".length).trim();
      if (scopedSpecId) ids.add(scopedSpecId);
    }
  }
  for (const scope of normalizeStringArray(task.conflict_scope)) {
    if (scope.startsWith("spec:")) {
      const scopedSpecId = scope.slice("spec:".length).trim();
      if (scopedSpecId) ids.add(scopedSpecId);
    }
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

function specFamily(specId: string): string {
  return (
    specId
      .replace(/^spec\./, "")
      .split(".")[0]
      ?.trim() || "unknown"
  );
}

function specLoopMaxDirectAttempts(
  tree: ReturnType<typeof readTaskTree>,
  state: SpecLoopState,
): number {
  const loopTask = tree.tasks[state.loopTaskId || "aks-spec-verification-loop"];
  const value = loopTask
    ? taskContext(loopTask).maxDirectAttemptsPerSpec
    : null;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 3;
}

function canDirectlyRunSpec(
  state: SpecLoopState,
  specId: string,
  maxDirectAttemptsPerSpec: number,
): boolean {
  const spec = state.specs?.[specId];
  if (!spec) return false;
  if (spec.status === "pending" || spec.status === "done") {
    return !spec.lastRunUrl || (spec.attempts ?? 0) < maxDirectAttemptsPerSpec;
  }
  if (spec.status !== "error" && spec.status !== "fail") return false;
  return (spec.attempts ?? 0) < maxDirectAttemptsPerSpec;
}

function isRetryExhaustedSpec(
  state: SpecLoopState,
  specId: string,
  maxDirectAttemptsPerSpec: number,
): boolean {
  const spec = state.specs?.[specId];
  if (!spec) return false;
  const status = spec.status || "pending";
  if (status === "pending") {
    return !canDirectlyRunSpec(state, specId, maxDirectAttemptsPerSpec);
  }
  if (status !== "error" && status !== "fail") return false;
  return (spec.attempts ?? 0) >= maxDirectAttemptsPerSpec;
}

function specLoopFollowupGroupKeys(task: TaskNode | undefined): Set<string> {
  const keys = new Set<string>();
  if (!task) return keys;
  const context = taskContext(task);
  if (context.specLoopFollowup === true) {
    const status = context.status;
    const family = context.featureFamily;
    if (typeof status === "string" && typeof family === "string") {
      keys.add(`${status}:${family}`);
    }
  }
  for (const scope of normalizeStringArray(task.conflict_scope)) {
    const trimmed = scope.trim();
    if (!trimmed.startsWith("spec-loop-followup:")) continue;
    const [, statusPart, familyPart] = trimmed.split(":");
    if (statusPart?.trim() && familyPart?.trim()) {
      keys.add(`${statusPart.trim()}:${familyPart.trim()}`);
    }
  }
  return keys;
}

function taskHasStructuredBlocker(task: TaskNode | undefined): boolean {
  return !!task?.blocker && typeof task.blocker === "object";
}

function taskTextMentionsSpecId(
  task: TaskNode | undefined,
  specId: string,
): boolean {
  if (!task) return false;
  const haystack = JSON.stringify({
    goal: task.goal,
    acceptance: task.acceptance,
    inputs: task.inputs,
    context: task.context,
    blocker: task.blocker,
  }).toLowerCase();
  return haystack.includes(specId.toLowerCase());
}

function taskTextMentionCountsAsSpecOwner(
  task: TaskNode | undefined,
  specId: string,
): boolean {
  if (!taskTextMentionsSpecId(task, specId)) return false;
  return nodeState(task) !== "blocked" || taskHasStructuredBlocker(task);
}

function exactSpecLoopOwnerTaskId(input: {
  tree: ReturnType<typeof readTaskTree>;
  state: SpecLoopState;
  specId: string;
  excludeTaskId: string;
}): string | null {
  const spec = input.state.specs?.[input.specId];
  const representingStates = new Set([
    "active",
    "backlog",
    "review",
    "waiting",
    "blocked",
  ]);
  const isRepresenting = (task: TaskNode | undefined): task is TaskNode =>
    !!task &&
    task.id !== input.excludeTaskId &&
    representingStates.has(nodeState(task));

  const taskIds = new Set<string>();
  if (typeof spec?.taskId === "string" && spec.taskId.trim()) {
    taskIds.add(spec.taskId.trim());
  }
  for (const task of Object.values(input.tree.tasks ?? {})) {
    if (!isRepresenting(task)) continue;
    if (
      normalizeStringArray(task.conflict_scope).includes(`spec:${input.specId}`)
    ) {
      taskIds.add(task.id);
      continue;
    }
    if (taskTextMentionCountsAsSpecOwner(task, input.specId)) {
      taskIds.add(task.id);
    }
  }

  for (const taskId of taskIds) {
    const task = input.tree.tasks?.[taskId];
    if (!isRepresenting(task)) continue;
    if (
      normalizeStringArray(task.conflict_scope).includes(`spec:${input.specId}`)
    ) {
      return taskId;
    }
    if (taskTextMentionCountsAsSpecOwner(task, input.specId)) {
      return taskId;
    }
    if (specLoopFollowupGroupKeys(task).size > 0) return taskId;
    if (
      spec?.taskId === taskId &&
      specLoopSpecHasStructuredSuccessor(spec) &&
      taskHasStructuredBlocker(task)
    ) {
      return taskId;
    }
  }

  if (specStateSelfRepresentsExactFrontier(spec)) {
    return `state:${input.specId}`;
  }

  return null;
}

function representedSpecLoopFollowupGroups(input: {
  tree: ReturnType<typeof readTaskTree>;
  excludeTaskId: string;
}): Set<string> {
  const represented = new Set<string>();
  const representingStates = new Set([
    "active",
    "backlog",
    "review",
    "waiting",
    "blocked",
  ]);
  for (const task of Object.values(input.tree.tasks ?? {})) {
    if (task.id === input.excludeTaskId) continue;
    if (!representingStates.has(nodeState(task))) continue;
    for (const key of specLoopFollowupGroupKeys(task)) represented.add(key);
  }
  return represented;
}

function specLoopCompletionStructuralGaps(input: {
  config: TaskTreeConfig;
  task: TaskNode;
}): string[] {
  if (taskContext(input.task).specLoopFollowup !== true) return [];
  const statePath = defaultSpecLoopStatePath(input.config.appDir);
  if (!existsSync(statePath)) return [];
  const state = readJsonFile<SpecLoopState | null>(statePath, null);
  if (!state?.specs) return [];
  const representedSpecIds = representedSpecIdsForTask(input.task).filter(
    (specId) => !!state.specs?.[specId],
  );
  if (representedSpecIds.length === 0) return [];

  const tree = readTaskTree(input.config);
  const maxDirectAttempts = specLoopMaxDirectAttempts(tree, state);
  const representedGroups = representedSpecLoopFollowupGroups({
    tree,
    excludeTaskId: input.task.id,
  });
  const unowned: string[] = [];
  for (const specId of representedSpecIds) {
    if (!isRetryExhaustedSpec(state, specId, maxDirectAttempts)) continue;
    const status = state.specs[specId]?.status || "pending";
    const groupStatus = status === "pending" ? "pending" : status;
    if (representedGroups.has(`${groupStatus}:${specFamily(specId)}`)) {
      continue;
    }
    if (
      exactSpecLoopOwnerTaskId({
        tree,
        state,
        specId,
        excludeTaskId: input.task.id,
      })
    ) {
      continue;
    }
    unowned.push(specId);
  }
  return unowned;
}

const durableLoopTaskIds = new Set([
  "aks-spec-verification-loop",
  "aks-feature-reference-loop",
  "aks-feature-compact-loop",
]);

function nodeState(task: TaskNode | undefined): string {
  return String(task?.status ?? task?.state ?? "");
}

function numberProgressField(
  progress: Record<string, unknown> | null,
  key: string,
): number | null {
  const value = progress?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function durableLoopChildBlockedOnlyStewardship(
  task: TaskNode,
  tree: TaskTree,
): boolean {
  if (!durableLoopTaskIds.has(task.id)) return false;
  if (nodeState(task) !== "blocked") return false;
  const progress = workflowProgress(task);
  if (!progress || progress.completionReady !== false) return false;
  if ((numberProgressField(progress, "running") ?? 0) > 0) return false;
  const unrepresentedNonTerminalCount = numberProgressField(
    progress,
    "unrepresentedNonTerminalCount",
  );
  if (unrepresentedNonTerminalCount !== 0) {
    return false;
  }
  const childStates = normalizeStringArray(task.children)
    .map((childId) => nodeState(tree.tasks[childId]))
    .filter(Boolean);
  if (!childStates.includes("blocked")) return false;
  return childStates.every((state) => state === "done" || state === "blocked");
}

function blockerRecord(task: TaskNode): Record<string, unknown> | null {
  return task.blocker &&
    typeof task.blocker === "object" &&
    !Array.isArray(task.blocker)
    ? (task.blocker as Record<string, unknown>)
    : null;
}

function childBlockedResultText(childIds: string[]): string {
  return `Blocked on child task(s): ${childIds.join(", ")}.`;
}

function repairChildBlockedParentResults(config: TaskTreeConfig): string[] {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const repaired: string[] = [];

    for (const task of Object.values(tree.tasks)) {
      if (nodeState(task) !== "blocked") continue;
      const blocker = blockerRecord(task);
      if (blocker?.category !== "child-blocked") continue;

      const blockedChildIds = normalizeStringArray(task.children).filter(
        (childId) => nodeState(tree.tasks[childId]) === "blocked",
      );
      if (blockedChildIds.length === 0) continue;

      const expected = childBlockedResultText(blockedChildIds);
      if (task.result === expected) continue;
      task.result = expected;
      repaired.push(task.id);
    }

    if (repaired.length > 0) {
      saveTaskTreeWithKanbanSnapshot(config, tree);
      appendToolJournal(config, {
        kind: "child_blocked_parent_results_repaired",
        task_ids: repaired,
        reason:
          "blocked parent result text refreshed from current blocked children",
      });
    }

    return repaired;
  });
}

function traceRecord(task: TaskNode): Record<string, unknown> {
  return task.trace &&
    typeof task.trace === "object" &&
    !Array.isArray(task.trace)
    ? (task.trace as Record<string, unknown>)
    : {};
}

function traceString(task: TaskNode, key: string): string {
  const value = traceRecord(task)[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function activeStartedAttempt(task: TaskNode): string | null {
  if (nodeState(task) !== "active") return null;
  const currentAttemptId = traceString(task, "current_attempt_id");
  const startedAttemptId = traceString(task, "worker_started_attempt_id");
  if (!currentAttemptId || currentAttemptId !== startedAttemptId) return null;
  return currentAttemptId;
}

function dependencyReferences(tree: TaskTree): Set<string> {
  const refs = new Set<string>();
  for (const task of Object.values(tree.tasks)) {
    for (const dependencyId of normalizeStringArray(task.depends_on)) {
      refs.add(dependencyId);
    }
  }
  return refs;
}

function taskDepth(tree: TaskTree, task: TaskNode): number {
  let depth = 0;
  let cursor = task;
  const seen = new Set<string>();
  while (cursor.parent_id && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    const parent = tree.tasks[cursor.parent_id];
    if (!parent) break;
    depth++;
    cursor = parent;
  }
  return depth;
}

function doneLeafCompactionCandidates(tree: TaskTree): TaskNode[] {
  const dependencyRefs = dependencyReferences(tree);
  return Object.values(tree.tasks)
    .filter((task) => {
      if (task.id === tree.root_task_id) return false;
      if (durableLoopTaskIds.has(task.id)) return false;
      if (!isLeaf(task)) return false;
      if (nodeState(task) !== "done") return false;
      if (dependencyRefs.has(task.id)) return false;
      return !workflowProgressBlocksCompletion(task);
    })
    .sort(
      (a, b) =>
        taskDepth(tree, b) - taskDepth(tree, a) || a.id.localeCompare(b.id),
    );
}

function doneLeafCompactionProtectedCount(tree: TaskTree): number {
  const dependencyRefs = dependencyReferences(tree);
  return Object.values(tree.tasks).filter((task) => {
    if (task.id === tree.root_task_id) return false;
    if (!isLeaf(task)) return false;
    if (nodeState(task) !== "done") return false;
    return dependencyRefs.has(task.id) || durableLoopTaskIds.has(task.id);
  }).length;
}

function reopenIncompleteDurableLoopRoots(config: TaskTreeConfig): string[] {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const reopened: string[] = [];
    const now = new Date().toISOString();

    for (const taskId of durableLoopTaskIds) {
      const task = tree.tasks[taskId];
      if (!task) continue;
      const childStates = normalizeStringArray(task.children).map((childId) =>
        nodeState(tree.tasks[childId]),
      );
      const childBlockedOnlyStewardship =
        durableLoopChildBlockedOnlyStewardship(task, tree);
      const blocked = childBlockedOnlyStewardship
        ? null
        : (workflowProgressBlocksCompletion(task) ??
          (nodeState(task) === "blocked" &&
          childStates.some((state) =>
            ["active", "review", "backlog"].includes(state),
          )
            ? `Durable loop root is blocked while child rollup is ${childStates.includes("active") ? "active" : childStates.includes("review") ? "review" : "backlog"}`
            : null));
      if (!blocked) continue;
      const status = nodeState(task);
      if (status === "backlog" || status === "active") continue;

      task.status = "backlog";
      task.state = "backlog";
      task.blocker = undefined;
      task.resolution = undefined;
      task.done_at = undefined;
      task.done_by = undefined;
      const context = taskContext(task);
      const progress = workflowProgress(task);
      task.context = progress
        ? {
            ...context,
            workflowProgress: runnableDurableLoopProgress(progress),
          }
        : context;
      task.trace = {
        ...(task.trace ?? {}),
        reopened_at: now,
        reopened_by: "task-tree-repair",
        reopen_reason: `Durable loop root had incomplete workflow progress while state=${status || "unknown"}: ${blocked}`,
        previous_nonterminal_status: status || undefined,
        current_attempt_id: undefined,
        worker_started_attempt_id: undefined,
      };
      reopened.push(task.id);
    }

    if (reopened.length > 0) {
      saveTaskTreeWithKanbanSnapshot(config, tree);
      appendToolJournal(config, {
        kind: "durable_loop_roots_reopened",
        task_ids: reopened,
        reason:
          "repair-rollups found durable loop roots with incomplete workflow progress",
      });
    }

    return reopened;
  });
}

export function repairTaskTreeRollups(config: TaskTreeConfig): ReturnType<
  typeof sdkRepairTaskTreeRollups
> & {
  reopenedDurableLoopRoots: string[];
  repairedChildBlockedParentResults: string[];
} {
  const initialResult = sdkRepairTaskTreeRollups(config);
  const reopenedDurableLoopRoots = reopenIncompleteDurableLoopRoots(config);
  const finalResult = reopenedDurableLoopRoots.length
    ? sdkRepairTaskTreeRollups(config)
    : initialResult;
  const repairedChildBlockedParentResults =
    repairChildBlockedParentResults(config);
  return {
    ...finalResult,
    changed:
      initialResult.changed ||
      finalResult.changed ||
      reopenedDurableLoopRoots.length > 0 ||
      repairedChildBlockedParentResults.length > 0,
    repaired: [
      ...new Set([
        ...(initialResult.repaired ?? []),
        ...(finalResult.repaired ?? []),
        ...repairedChildBlockedParentResults.map((taskId) => ({
          taskId,
          from: "child-blocked",
          to: "backlog",
        })),
      ]),
    ],
    reopenedDurableLoopRoots,
    repairedChildBlockedParentResults,
  };
}

export function compactDoneLeaves(
  config: TaskTreeConfig,
  input: { limit?: number; reason?: string } = {},
): TaskTreeCompactResult {
  const limit = Math.max(0, input.limit ?? 200);
  if (limit === 0) return sdkCompactDoneLeaves(config, { ...input, limit });

  const archivedTaskIds: string[] = [];
  const archivePaths: string[] = [];
  let latestTree = readTaskTree(config);
  let remainingTotal = Object.keys(latestTree.tasks).length;
  let protectedCount = doneLeafCompactionProtectedCount(latestTree);

  while (archivedTaskIds.length < limit) {
    const tree = readTaskTree(config);
    protectedCount = doneLeafCompactionProtectedCount(tree);
    const candidates = doneLeafCompactionCandidates(tree);
    if (candidates.length === 0) break;

    const chosen = candidates[0];
    if (!chosen.parent_id) break;
    const chosenDepth = taskDepth(tree, chosen);
    const selectedIds = candidates
      .filter(
        (task) =>
          task.parent_id === chosen.parent_id &&
          taskDepth(tree, task) === chosenDepth,
      )
      .slice(0, limit - archivedTaskIds.length)
      .map((task) => task.id);

    const result = rollupParent(config, {
      parentId: chosen.parent_id,
      taskIds: selectedIds,
      summary:
        "Compact accepted done leaves; preserve durable loop controllers even when their current frontier is complete or held.",
      reason: input.reason ?? "compact done task leaves",
      limit: selectedIds.length,
    });
    if (!result.archivedTaskIds?.length) break;
    archivedTaskIds.push(...result.archivedTaskIds);
    if (result.archivePath) archivePaths.push(result.archivePath);
    remainingTotal = result.remainingTotal;
  }

  latestTree = readTaskTree(config);
  protectedCount = doneLeafCompactionProtectedCount(latestTree);

  return {
    changed: archivedTaskIds.length > 0,
    archived: archivedTaskIds.length,
    protected: protectedCount,
    archivedTaskIds,
    archivePath: archivePaths[archivePaths.length - 1],
    archivePaths,
    remainingTotal,
  };
}

export function markTaskDone(
  config: TaskTreeConfig,
  input: { taskId: string; summary: string; resolution?: string },
): TaskNode {
  const task = readTask(config, input.taskId);
  if (!task) throw new Error(`Task not found: ${input.taskId}`);
  const activeAttemptId = activeStartedAttempt(task);
  if (activeAttemptId) {
    throw new Error(
      `Task ${task.id} is active with current started attempt ${activeAttemptId}; do not mark it done/replaced/cancelled from owner cleanup. Wait for worker completion, use requeue-active for a stale attempt, or create separate follow-up work without closing the active assignment.`,
    );
  }
  if (durableLoopTaskIds.has(task.id)) {
    const blocked = workflowProgressBlocksCompletion(task);
    if (blocked) {
      throw new Error(
        `Durable loop task ${task.id} cannot be marked done while workflow progress is incomplete: ${blocked}`,
      );
    }
  }
  const resolution = input.resolution ?? task.resolution ?? "completed";
  if (resolution !== "replaced" && resolution !== "cancelled") {
    const blocked = workflowProgressBlocksCompletion(task);
    if (blocked) {
      throw new Error(
        `Task ${task.id} cannot be marked done because ${blocked}. Use --resolution replaced/cancelled only when intentionally closing or replacing the task.`,
      );
    }
    const unownedSpecIds = specLoopCompletionStructuralGaps({ config, task });
    if (unownedSpecIds.length > 0) {
      throw new Error(
        `Spec-loop follow-up ${task.id} cannot be marked done while represented retry-drained spec(s) lack an open structural owner: ${unownedSpecIds
          .slice(0, 8)
          .join(
            ", ",
          )}. Create or link an exact open holder, escalation, rerun, or terminal disposition first.`,
      );
    }
  }
  return sdkMarkTaskDone(config, input);
}

export function rollupParent(
  config: TaskTreeConfig,
  input: RollupParentInput,
): TaskTreeCompactResult {
  const tree = readTaskTree(config);
  const parent = tree.tasks[input.parentId];
  if (!parent) throw new Error(`Parent task not found: ${input.parentId}`);

  const childIds = normalizeStringArray(parent.children);
  const requestedIds = [...new Set(input.taskIds ?? [])];
  const selectedIds = requestedIds.length
    ? requestedIds
    : childIds
        .filter((childId) => {
          const task = tree.tasks[childId];
          return task && isLeaf(task) && task.status === "done";
        })
        .slice(0, Math.max(0, input.limit ?? 200));

  for (const taskId of selectedIds) {
    const task = tree.tasks[taskId];
    if (!task) continue;
    if (durableLoopTaskIds.has(task.id)) {
      throw new Error(
        `Task ${task.id} is a durable loop root and cannot be archived by parent rollup. Keep it in the task tree until an explicit retirement operation is implemented.`,
      );
    }
    const blocked = workflowProgressBlocksCompletion(task);
    if (blocked) {
      throw new Error(
        `Task ${task.id} cannot be archived by parent rollup because ${blocked}. Use an intentional replacement/cancellation task instead of archiving an incomplete workflow controller.`,
      );
    }
  }

  return sdkRollupParent(config, input);
}

export type UpdateAcceptedReviewMetadataInput = {
  taskId: string;
  reviewSummary?: string;
  acceptanceNote?: string;
};

export type UpdateArchivedTaskOutputsInput = {
  taskId: string;
  outputs: string[];
  archiveFile?: string;
};

export type UpdateArchivedTaskOutputsResult = {
  taskId: string;
  archiveFile: string;
  beforeOutputs: string[];
  afterOutputs: string[];
  changed: boolean;
  task: TaskNode;
};

export type UpdateArchivedTaskEvidenceInput = {
  taskId: string;
  evidence: string[];
  archiveFile?: string;
};

export type UpdateArchivedTaskEvidenceResult = {
  taskId: string;
  archiveFile: string;
  beforeEvidence: string[];
  afterEvidence: string[];
  beforeLastWorkerEvidence: string[];
  afterLastWorkerEvidence: string[];
  changed: boolean;
  task: TaskNode;
};

export type ModelGapBacklogSeedResult = {
  created: string[];
  skipped: Array<{ pathId: string; reason: string }>;
  gapCount: number;
};

type KnowledgeFeaturePath = {
  id?: string;
  featureId?: string;
  status?: string;
  terminal?: boolean;
  verdictFinal?: boolean;
  retestCondition?: string;
  resumeCondition?: string;
  rootCauseClass?: string;
  remediationStatus?: string;
  variantOfSpecId?: string;
  executionVariantId?: string;
  specCoverage?: {
    type?: string;
    specId?: string;
    variantId?: string;
    reason?: string;
  };
};

export type ProjectHygieneWarning = {
  kind: "stale-terminal-retry";
  taskId: string;
  taskState: string;
  pathId: string;
  pathStatus?: string;
  terminal?: boolean;
  verdictFinal?: boolean;
  message: string;
};

export type BlockedActionWarning = {
  kind:
    | "response-await-without-send-proof"
    | "source-exactness-overblock"
    | "environment-overblock";
  taskId: string;
  parentId?: string | null;
  message: string;
  suggestedAction: string;
  blocker?: string;
};

export type AksTaskPlanningPacket = TaskPlanningPacket & {
  project_hygiene_warnings?: ProjectHygieneWarning[];
  blocked_action_warnings?: BlockedActionWarning[];
};

function readJsonFile<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function boolValue(value: unknown): boolean {
  return value === true;
}

function normalizeTextValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeModelPath(entry: Record<string, unknown>): {
  id: string;
  status?: string;
  terminal?: boolean;
  verdictFinal?: boolean;
  retestCondition?: string;
  resumeCondition?: string;
} | null {
  const id = typeof entry.id === "string" ? entry.id.trim() : "";
  if (!id) return null;
  return {
    id,
    status: typeof entry.status === "string" ? entry.status : undefined,
    terminal: boolValue(entry.terminal) || undefined,
    verdictFinal: boolValue(entry.verdictFinal) || undefined,
    retestCondition: normalizeTextValue(entry.retestCondition),
    resumeCondition: normalizeTextValue(entry.resumeCondition),
  };
}

function loadModelPaths(config: TaskTreeConfig): Array<{
  id: string;
  status?: string;
  terminal?: boolean;
  verdictFinal?: boolean;
  retestCondition?: string;
  resumeCondition?: string;
}> {
  const model = readJsonFile<Record<string, unknown>>(
    join(config.projectDir, "model", "knowledge-map", "model.json"),
    {},
  );
  const featurePaths = Array.isArray(model.featurePaths)
    ? (model.featurePaths as Record<string, unknown>[])
    : [];
  const mirrorPaths = Array.isArray(model.paths)
    ? (model.paths as Record<string, unknown>[])
    : [];
  const byId = new Map<
    string,
    { id: string; status?: string; terminal?: boolean; verdictFinal?: boolean }
  >();
  for (const entry of [...featurePaths, ...mirrorPaths]) {
    const path = normalizeModelPath(entry);
    if (!path) continue;
    byId.set(path.id, { ...byId.get(path.id), ...path });
  }
  return [...byId.values()];
}

function taskSearchText(task: TaskNode): string {
  return JSON.stringify({
    id: task.id,
    goal: task.goal,
    inputs: task.inputs,
    outputs: task.outputs,
    acceptance: task.acceptance,
    conflict_scope: task.conflict_scope,
    depends_on: task.depends_on,
    context: task.context,
    blocker: task.blocker,
    trace: task.trace,
  }).toLowerCase();
}

function hasRetryIntent(text: string): boolean {
  return /\b(retry|rerun|re-run|reopen|re-open|reverify|re-verify|resume|unblock|execute|execution|verify|verification)\b/i.test(
    text,
  );
}

function normalizeComparableText(value: string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function holderTextMatchesResumeContract(
  text: string,
  path: Pick<KnowledgeFeaturePath, "retestCondition" | "resumeCondition">,
): boolean {
  const normalizedTaskText = normalizeComparableText(text);
  if (!normalizedTaskText) return false;

  const contractTexts = [path.resumeCondition, path.retestCondition]
    .map((value) => normalizeComparableText(value))
    .filter(Boolean);
  if (contractTexts.length === 0) return false;

  const tokenize = (value: string): string[] =>
    value
      .split(" ")
      .map((part) => part.trim())
      .filter(
        (part) =>
          part.length >= 4 &&
          ![
            "when",
            "only",
            "then",
            "that",
            "this",
            "with",
            "from",
            "into",
            "after",
            "before",
            "until",
            "exact",
            "blocked",
            "resume",
            "rerun",
            "replay",
            "path",
            "host",
            "gate",
            "open",
            "valid",
            "will",
            "must",
            "should",
            "project",
            "staging",
          ].includes(part),
      );

  const taskTokens = new Set(tokenize(normalizedTaskText));

  return contractTexts.some((contract) => {
    if (contract.length >= 24 && normalizedTaskText.includes(contract)) {
      return true;
    }
    const contractTokens = [...new Set(tokenize(contract))];
    if (contractTokens.length === 0) return false;
    const overlap = contractTokens.filter((token) => taskTokens.has(token));
    return overlap.length >= 3;
  });
}

function isExactBlockedPrerequisiteHolder(
  task: TaskNode,
  text: string,
  path: KnowledgeFeaturePath,
): boolean {
  const state = task.status ?? task.state ?? "backlog";
  if (state !== "blocked") return false;

  const holderSignals = [
    "exact environment blocker",
    "exact external prerequisite holder",
    "exact prerequisite holder",
    "remains only as the exact environment prerequisite holder",
    "resume only when",
    "blocked until",
    "external unblock required",
  ];
  const hasHolderSignal = holderSignals.some((signal) => text.includes(signal));
  if (!hasHolderSignal) return false;

  return holderTextMatchesResumeContract(text, path);
}

function isExplicitSubpathRefinementTask(
  text: string,
  terminalPathId: string,
  allPaths: KnowledgeFeaturePath[],
): boolean {
  const lowerTerminalPathId = terminalPathId.toLowerCase();
  const hasRefinementSignal =
    (text.includes("sibling") && /\bpreserv(?:e|ed|ing)\b/i.test(text)) ||
    text.includes("distinct subpath") ||
    text.includes("narrower subpath") ||
    text.includes("narrower lifecycle") ||
    text.includes("exact subpath refinement") ||
    text.includes("preservedsiblingpath");
  if (!hasRefinementSignal) return false;

  return allPaths.some((path) => {
    const candidateId = path.id?.toLowerCase();
    if (!candidateId || candidateId === lowerTerminalPathId) return false;
    if (!candidateId.startsWith(`${lowerTerminalPathId}-`)) return false;
    return text.includes(candidateId);
  });
}

function projectHygieneWarnings(
  config: TaskTreeConfig,
): ProjectHygieneWarning[] {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const modelPaths = loadModelPaths(config);
    const terminalPaths = modelPaths.filter(
      (path) => path.terminal === true || path.verdictFinal === true,
    );
    const warnings: ProjectHygieneWarning[] = [];
    for (const task of Object.values(tree.tasks ?? {})) {
      const state = task.status ?? task.state ?? "backlog";
      if (!isLeaf(task)) continue;
      if (state === "done") continue;
      const text = taskSearchText(task);
      if (!hasRetryIntent(text)) continue;
      for (const path of terminalPaths) {
        if (!text.includes(path.id.toLowerCase())) continue;
        if (isExactBlockedPrerequisiteHolder(task, text, path)) continue;
        if (isExplicitSubpathRefinementTask(text, path.id, modelPaths))
          continue;
        warnings.push({
          kind: "stale-terminal-retry",
          taskId: task.id,
          taskState: state,
          pathId: path.id,
          pathStatus: path.status,
          terminal: path.terminal,
          verdictFinal: path.verdictFinal,
          message:
            "model verdict may be stale; owner should reconcile the model path before retry planning",
        });
      }
    }
    return warnings
      .sort(
        (a, b) =>
          a.taskId.localeCompare(b.taskId) || a.pathId.localeCompare(b.pathId),
      )
      .slice(0, 20);
  });
}

function includesAny(text: string, signals: string[]): boolean {
  return signals.some((signal) => text.includes(signal));
}

function isHumanOwnedExternalWait(task: TaskNode): boolean {
  const blocker = task.blocker;
  if (!blocker || typeof blocker !== "object" || Array.isArray(blocker)) {
    return false;
  }
  const category =
    typeof blocker.category === "string"
      ? blocker.category.trim().toLowerCase()
      : "";
  const owner =
    typeof blocker.owner === "string" ? blocker.owner.trim().toLowerCase() : "";
  return category === "external-wait" && owner === "human";
}

function blockerWaitingForType(task: TaskNode): string {
  const blocker = task.blocker;
  if (!blocker || typeof blocker !== "object" || Array.isArray(blocker)) {
    return "";
  }
  const waitingFor = (blocker as Record<string, unknown>).waiting_for;
  if (!waitingFor || typeof waitingFor !== "object" || Array.isArray(waitingFor)) {
    return "";
  }
  const type = (waitingFor as Record<string, unknown>).type;
  return typeof type === "string" ? type.trim().toLowerCase() : "";
}

function isFeatureCompactNonEnvironmentFrontier(task: TaskNode): boolean {
  if (taskContext(task).featureCompactExactWait !== true) return false;
  return [
    "owner.decision",
    "pipeline.result.or.artifact.available",
    "publish.auth.ready",
    "compact.frontier.changed",
    "evidence.available",
  ].includes(blockerWaitingForType(task));
}

function isRepresentedBlockedFrontier(task: TaskNode): boolean {
  const text = taskSearchText(task);
  const representedSignals = [
    "split-frontier",
    "split mixed-family holder",
    "represented by",
    "exact represented blockers",
    "exact represented blocker",
    "exact represented carriers",
    "exact represented carrier",
  ];
  if (!includesAny(text, representedSignals)) {
    return false;
  }
  return (
    includesAny(text, [
      "materially changes",
      "remains the exact",
      "still controls",
      "represented by ",
    ]) && includesAny(text, ["frontier", "carrier", "represented blocker"])
  );
}

function blockedActionWarnings(config: TaskTreeConfig): BlockedActionWarning[] {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const warnings: BlockedActionWarning[] = [];
    for (const task of Object.values(tree.tasks ?? {})) {
      const state = task.status ?? task.state ?? "backlog";
      if (!isLeaf(task) || state !== "blocked") continue;
      const text = taskSearchText(task);
      const blocker =
        typeof task.blocker === "string" && task.blocker.trim()
          ? task.blocker.trim()
          : undefined;

      const responseAwaitWithoutSendProof =
        (task.id.includes("response-await") ||
          includesAny(text, [
            "response wait",
            "response-await",
            "source-holder response",
            "owner/operator reply",
            "operator input required",
          ])) &&
        includesAny(text, [
          "no durable proof-of-send",
          "no durable proof that",
          "no proof-of-send",
          "proof-of-send/handoff",
          "no accepted send",
          "0 / 34",
          "send-ready-only",
        ]);
      if (responseAwaitWithoutSendProof) {
        warnings.push({
          kind: "response-await-without-send-proof",
          taskId: task.id,
          parentId: task.parent_id,
          message:
            "task is blocked waiting for a reply, but the tree text says the ask is not yet proven sent or handed off",
          suggestedAction:
            "create/assign an owner send-handoff or escalation task, or mark this wait replaced by an existing sent/escalated ask; do not preserve it as passive response-await",
          ...(blocker ? { blocker: blocker.slice(0, 500) } : {}),
        });
        continue;
      }

      const sourceExactnessSignals = [
        "exact handwritten",
        "handwritten/native",
        "authoritative source",
        "authoritative-equivalent",
        "source-equivalent",
        "source-holder proof",
        "source-body excerpt",
        "exact source excerpt",
        "source semantics",
      ];
      const sourceExactnessBlocked =
        includesAny(text, sourceExactnessSignals) &&
        includesAny(text, [
          "blocked",
          "external/source",
          "external unblock required",
          "resume only when",
          "provide ",
          "pending authoritative",
        ]);
      if (sourceExactnessBlocked) {
        if (
          isRepresentedBlockedFrontier(task) ||
          isFeatureCompactNonEnvironmentFrontier(task)
        ) {
          continue;
        }
        warnings.push({
          kind: "source-exactness-overblock",
          taskId: task.id,
          parentId: task.parent_id,
          message:
            "task is blocked on exact source proof; owner should verify whether bounded/source-equivalent spec or replay work can proceed instead",
          suggestedAction:
            "if the missing source only limits confidence, create bounded draft/spec/replay or evidence-ceiling work; keep blocked only when no truthful bounded progress is possible and the external ask/escalation is explicit",
          ...(blocker ? { blocker: blocker.slice(0, 500) } : {}),
        });
        continue;
      }

      const environmentSignals = [
        "environment blocker",
        "environment block",
        "environment capability",
        "feature flag",
        "notregistered",
        "not registered",
        "quota",
        "capacity",
        "rbac",
        "accessdenied",
        "access denied",
        "azure auth",
        "credential",
        "subscription",
        "staging",
      ];
      const environmentBlocked =
        includesAny(text, environmentSignals) &&
        includesAny(text, [
          "blocked",
          "external",
          "resume only",
          "retry only",
          "after ",
          "provide ",
          "required",
        ]);
      if (environmentBlocked) {
        if (
          isHumanOwnedExternalWait(task) ||
          isRepresentedBlockedFrontier(task) ||
          isFeatureCompactNonEnvironmentFrontier(task)
        ) {
          continue;
        }
        warnings.push({
          kind: "environment-overblock",
          taskId: task.id,
          parentId: task.parent_id,
          message:
            "task is blocked on environment/capability; owner should verify whether setup, diagnosis, alternate environment, or a shared escalation can move it",
          suggestedAction:
            "create active environment setup/diagnosis/retry work, or replace duplicates with one exact owner escalation/wait; do not leave many passive environment blockers",
          ...(blocker ? { blocker: blocker.slice(0, 500) } : {}),
        });
      }
    }
    return warnings
      .sort((a, b) => a.taskId.localeCompare(b.taskId))
      .slice(0, 25);
  });
}

export function planningPacket(config: TaskTreeConfig): AksTaskPlanningPacket {
  const packet = sdkPlanningPacket(config) as AksTaskPlanningPacket;
  const warnings = projectHygieneWarnings(config);
  if (warnings.length > 0) packet.project_hygiene_warnings = warnings;
  const blockedWarnings = blockedActionWarnings(config);
  if (blockedWarnings.length > 0)
    packet.blocked_action_warnings = blockedWarnings;
  return packet;
}

function listArtifactStems(root: string, extension: string): Set<string> {
  const stems = new Set<string>();
  const visit = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith(".") || entry === "node_modules") continue;
      const path = join(dir, entry);
      let stat;
      try {
        stat = statSync(path);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        visit(path);
      } else if (stat.isFile() && extname(path) === extension) {
        const name = entry.slice(0, -extension.length);
        if (name !== "index") stems.add(name);
      }
    }
  };
  visit(root);
  return stems;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/^path[.-]/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function artifactStemCandidates(path: KnowledgeFeaturePath): string[] {
  const candidates = [
    slugify(path.id ?? ""),
    slugify(path.featureId ?? ""),
  ].filter(Boolean);
  const expanded = candidates.flatMap((candidate) => [
    candidate,
    candidate.replace(/^managedsystem-pool-/, "managedsystem-"),
    candidate.replace(/^virtualmachines-agentpool-/, "virtualmachines-"),
    candidate.replace(/^machines-agentpool-/, "machines-"),
  ]);
  return [...new Set(expanded.filter(Boolean))];
}

function findArtifactStem(
  path: KnowledgeFeaturePath,
  specs: Set<string>,
  replays: Set<string>,
): string | null {
  for (const candidate of artifactStemCandidates(path)) {
    if (specs.has(candidate) || replays.has(candidate)) return candidate;
  }
  return null;
}

function openTaskAlreadyCoversPath(
  tree: TaskTree,
  path: KnowledgeFeaturePath,
  stem: string | null,
): boolean {
  const signals = [path.id, path.featureId, stem]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  if (signals.length === 0) return false;
  return Object.values(tree.tasks).some((task) => {
    if (task.status === "done") return false;
    const haystack = JSON.stringify({
      id: task.id,
      goal: task.goal,
      inputs: task.inputs,
      outputs: task.outputs,
      conflict_scope: task.conflict_scope,
      context: task.context,
      blocker: task.blocker,
    }).toLowerCase();
    return signals.some((signal) => haystack.includes(signal));
  });
}

function nextAvailableTaskId(tree: TaskTree, baseId: string): string {
  let id = baseId;
  let suffix = 2;
  while (tree.tasks[id]) {
    id = `${baseId}-${suffix}`;
    suffix++;
  }
  return id;
}

function statusPriority(status: string | undefined): number {
  if (status === "unknown" || status === "source-enumerated") return 0;
  if (status === "fail") return 1;
  if (status === "blocked-infra") return 2;
  if (status === "blocked") return 3;
  return 4;
}

function appendSeededTask(
  tree: TaskTree,
  parent: TaskNode,
  task: TaskNode,
): void {
  tree.tasks[task.id] = task;
  parent.children = [
    ...new Set([...normalizeStringArray(parent.children), task.id]),
  ];
}

export function updateAcceptedReviewMetadata(
  config: TaskTreeConfig,
  input: UpdateAcceptedReviewMetadataInput,
): TaskNode {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId];
    if (!task) throw new Error(`Task not found: ${input.taskId}`);

    const hasReviewSummary = typeof input.reviewSummary === "string";
    const hasAcceptanceNote = typeof input.acceptanceNote === "string";
    if (!hasReviewSummary && !hasAcceptanceNote) {
      throw new Error(
        "Provide at least one of reviewSummary or acceptanceNote",
      );
    }

    if (hasReviewSummary) {
      const reviewSummary = input.reviewSummary?.trim() ?? "";
      if (!reviewSummary) throw new Error("reviewSummary cannot be empty");
      task.trace = {
        ...(task.trace ?? {}),
        review_summary: reviewSummary,
      };
    }

    if (hasAcceptanceNote) {
      const acceptanceNote = input.acceptanceNote?.trim() ?? "";
      if (!acceptanceNote) throw new Error("acceptanceNote cannot be empty");
      const context =
        task.context &&
        typeof task.context === "object" &&
        !Array.isArray(task.context)
          ? task.context
          : {};
      task.context = {
        ...context,
        acceptance_note: acceptanceNote,
      };
    }

    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_accepted_review_metadata_updated",
      task_id: task.id,
      review_summary_updated: hasReviewSummary,
      acceptance_note_updated: hasAcceptanceNote,
    });
    return task;
  });
}

function archivedDoneLeafFiles(config: TaskTreeConfig): string[] {
  const archiveDir = join(config.appDir, "tasks", "archive");
  if (!existsSync(archiveDir)) return [];
  return readdirSync(archiveDir)
    .filter((name) => name.startsWith("done-leaves-") && name.endsWith(".json"))
    .sort()
    .map((name) => join(archiveDir, name));
}

function archiveTaskBundlePath(
  taskId: string,
  config: TaskTreeConfig,
  archiveFile?: string,
): {
  path: string;
  bundle: { [key: string]: unknown; tasks?: TaskNode[] };
  task: TaskNode;
} {
  const requestedArchivePath = archiveFile
    ? resolve(config.appDir, archiveFile)
    : null;
  const archiveFiles = requestedArchivePath
    ? [requestedArchivePath]
    : archivedDoneLeafFiles(config);
  const matches: Array<{
    path: string;
    bundle: { [key: string]: unknown; tasks?: TaskNode[] };
    task: TaskNode;
  }> = [];
  for (const path of archiveFiles) {
    if (!existsSync(path)) {
      if (requestedArchivePath) {
        throw new Error(`Archive bundle not found: ${archiveFile}`);
      }
      continue;
    }
    const bundle = readJsonFile<{ [key: string]: unknown; tasks?: TaskNode[] }>(
      path,
      {},
    );
    const tasks = Array.isArray(bundle.tasks) ? bundle.tasks : [];
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (task) matches.push({ path, bundle, task });
  }
  if (matches.length === 0) {
    if (requestedArchivePath) {
      throw new Error(
        `Archived task not found in requested archive bundle: ${taskId} (${archiveFile})`,
      );
    }
    throw new Error(`Archived task not found: ${taskId}`);
  }
  if (matches.length > 1) {
    throw new Error(
      `Archived task appears in more than one archive bundle: ${taskId} (${matches
        .map((match) => match.path)
        .join(", ")})`,
    );
  }
  return matches[0];
}

export function updateArchivedTaskOutputs(
  config: TaskTreeConfig,
  input: UpdateArchivedTaskOutputsInput,
): UpdateArchivedTaskOutputsResult {
  return withTreeLock(config, () => {
    const outputs = input.outputs.map((value) => value.trim()).filter(Boolean);
    if (outputs.length === 0) throw new Error("Provide at least one output");

    const { path, bundle, task } = archiveTaskBundlePath(
      input.taskId,
      config,
      input.archiveFile,
    );
    if (task.state !== "done" && task.status !== "done") {
      throw new Error(`Archived task is not done: ${input.taskId}`);
    }
    const tasks = Array.isArray(bundle.tasks) ? bundle.tasks : [];
    const index = tasks.findIndex((candidate) => candidate.id === input.taskId);
    if (index < 0) throw new Error(`Archived task not found: ${input.taskId}`);

    const beforeOutputs = normalizeStringArray(task.outputs);
    const afterOutputs = outputs;
    const changed =
      JSON.stringify(beforeOutputs) !== JSON.stringify(afterOutputs);
    task.outputs = afterOutputs;
    tasks[index] = task;
    bundle.tasks = tasks;
    writeFileSync(path, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");

    appendToolJournal(config, {
      kind: "archived_task_outputs_updated",
      task_id: task.id,
      archive_file: path,
      before_outputs: beforeOutputs,
      outputs: afterOutputs,
      changed,
    });
    return {
      taskId: task.id,
      archiveFile: path,
      beforeOutputs,
      afterOutputs,
      changed,
      task,
    };
  });
}

export function updateArchivedTaskEvidence(
  config: TaskTreeConfig,
  input: UpdateArchivedTaskEvidenceInput,
): UpdateArchivedTaskEvidenceResult {
  return withTreeLock(config, () => {
    const evidence = input.evidence
      .map((value) => value.trim())
      .filter(Boolean);
    if (evidence.length === 0) throw new Error("Provide at least one evidence path");

    const { path, bundle, task } = archiveTaskBundlePath(
      input.taskId,
      config,
      input.archiveFile,
    );
    if (task.state !== "done" && task.status !== "done") {
      throw new Error(`Archived task is not done: ${input.taskId}`);
    }
    const tasks = Array.isArray(bundle.tasks) ? bundle.tasks : [];
    const index = tasks.findIndex((candidate) => candidate.id === input.taskId);
    if (index < 0) throw new Error(`Archived task not found: ${input.taskId}`);

    const trace = traceRecord(task);
    const beforeEvidence = normalizeStringArray(task.evidence);
    const beforeLastWorkerEvidence = normalizeStringArray(
      trace.last_worker_evidence,
    );
    const afterEvidence = evidence;
    const afterLastWorkerEvidence = evidence;
    const changed =
      JSON.stringify(beforeEvidence) !== JSON.stringify(afterEvidence) ||
      JSON.stringify(beforeLastWorkerEvidence) !==
        JSON.stringify(afterLastWorkerEvidence);

    task.evidence = afterEvidence;
    task.trace = {
      ...trace,
      last_worker_evidence: afterLastWorkerEvidence,
    };
    tasks[index] = task;
    bundle.tasks = tasks;
    writeFileSync(path, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");

    appendToolJournal(config, {
      kind: "archived_task_evidence_updated",
      task_id: task.id,
      archive_file: path,
      before_evidence: beforeEvidence,
      evidence: afterEvidence,
      before_last_worker_evidence: beforeLastWorkerEvidence,
      last_worker_evidence: afterLastWorkerEvidence,
      changed,
    });
    return {
      taskId: task.id,
      archiveFile: path,
      beforeEvidence,
      afterEvidence,
      beforeLastWorkerEvidence,
      afterLastWorkerEvidence,
      changed,
      task,
    };
  });
}

export function seedModelGapBacklog(
  config: TaskTreeConfig,
  input: {
    limit?: number;
    reason?: string;
    prefer?: "execution" | "source-spec";
  } = {},
): ModelGapBacklogSeedResult {
  const model = readJsonFile<{ featurePaths?: KnowledgeFeaturePath[] }>(
    join(config.projectDir, "model", "knowledge-map", "model.json"),
    {},
  );
  const paths = Array.isArray(model.featurePaths) ? model.featurePaths : [];
  const gaps = paths
    .filter(
      (path) =>
        path.id &&
        path.featureId &&
        !["pass", "staging-pass"].includes(path.status ?? "unknown"),
    )
    .sort(
      (a, b) =>
        statusPriority(a.status) - statusPriority(b.status) ||
        (a.id ?? "").localeCompare(b.id ?? ""),
    );
  const specs = listArtifactStems(join(config.projectDir, "specs"), ".json");
  const replays = listArtifactStems(join(config.projectDir, "replays"), ".ts");
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const limit = Math.max(0, input.limit ?? 2);
  if (limit === 0) return { created: [], skipped: [], gapCount: gaps.length };

  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const created: string[] = [];
    const skipped: ModelGapBacklogSeedResult["skipped"] = [];
    const runnerParent = tree.tasks["spec-runner-and-replays"];
    const sourceParent =
      tree.tasks["go-e2ev3-source-discovery"] ??
      tree.tasks["feature-knowledge-and-specs"];
    if (!runnerParent && !sourceParent)
      return {
        created,
        skipped: gaps.map((path) => ({
          pathId: path.id ?? "(unknown)",
          reason: "no-parent-task",
        })),
        gapCount: gaps.length,
      };

    const now = new Date().toISOString();
    for (const path of gaps) {
      if (created.length >= limit) break;
      const pathId = path.id ?? "";
      const featureId = path.featureId ?? "";
      const stem = findArtifactStem(path, specs, replays);
      if (path.status === "blocked" || path.status === "blocked-infra") {
        skipped.push({ pathId, reason: "blocked-status" });
        continue;
      }
      if (
        path.specCoverage?.type === "execution-variant" ||
        path.variantOfSpecId ||
        path.executionVariantId
      ) {
        skipped.push({ pathId, reason: "execution-variant-metadata" });
        continue;
      }
      if (path.terminal === true || path.verdictFinal === true) {
        skipped.push({ pathId, reason: "terminal-path" });
        continue;
      }
      const terminalRootCauses = [
        "cli-bug",
        "product-bug",
        "product-gap",
        "product_constraint",
      ];
      const terminalRemediationStatuses = ["awaiting-", "terminal-"];
      if (
        path.status === "fail" &&
        path.rootCauseClass &&
        terminalRootCauses.includes(path.rootCauseClass) &&
        path.remediationStatus &&
        terminalRemediationStatuses.some((p) =>
          (path.remediationStatus ?? "").startsWith(p),
        )
      ) {
        skipped.push({ pathId, reason: "terminal-known-product-bug" });
        continue;
      }
      if (openTaskAlreadyCoversPath(tree, path, stem)) {
        skipped.push({ pathId, reason: "already-covered-by-open-task" });
        continue;
      }

      const hasReplay = Boolean(stem && replays.has(stem));
      const hasSpec = Boolean(stem && specs.has(stem));
      const preferSourceSpec = input.prefer === "source-spec";
      const parent =
        !preferSourceSpec && (hasReplay || hasSpec)
          ? runnerParent
          : sourceParent;
      if (!parent) {
        skipped.push({ pathId, reason: "no-parent-task" });
        continue;
      }

      const baseSlug = slugify(featureId || pathId).slice(0, 70) || "model-gap";
      const taskId = nextAvailableTaskId(
        tree,
        !preferSourceSpec && (hasReplay || hasSpec)
          ? `${baseSlug}-staging-frontier-${today}`
          : `${baseSlug}-source-spec-frontier-${today}`,
      );
      const artifactInputs = [
        hasSpec ? `specs/${stem}.json` : undefined,
        hasReplay ? `replays/${stem}.ts` : undefined,
      ].filter((value): value is string => Boolean(value));
      const executionTask = !preferSourceSpec && (hasReplay || hasSpec);
      const task: TaskNode = {
        id: taskId,
        parent_id: parent.id,
        state: "backlog",
        status: "backlog",
        kind: "domain_leaf",
        priority: path.status === "unknown" ? "P1" : "P2",
        owner: config.worker,
        children: [],
        goal: executionTask
          ? [
              `Close the knowledge-model gap for ${pathId} by running or repairing the existing staging REST test path.`,
              artifactInputs.length
                ? `Use ${artifactInputs.join(" and ")} through the project runner.`
                : "Use the project runner and existing domain artifacts.",
              "Produce real execution feedback, not a dry-run-only conclusion.",
            ].join(" ")
          : [
              `Explore source/material for ${pathId} and build up the source-grounded spec/replay frontier before scheduling more slow staging execution.`,
              artifactInputs.length
                ? `Use existing artifacts as starting context: ${artifactInputs.join(" and ")}.`
                : "Create missing feature/spec/replay artifacts from source material.",
              "Feed the result into the runner lane for later high-value verification.",
            ].join(" "),
        inputs: artifactInputs,
        outputs: executionTask
          ? [
              "runs/executions/",
              "evidence/archive/",
              "model/knowledge-map/model.json",
            ]
          : ["features/", "specs/", "replays/", "evidence/archive/"],
        acceptance: executionTask
          ? [
              "A live staging REST run result or precise runner-fix result is recorded under runs/executions/.",
              "Failure is classified as product, test, runner, or environment with evidence and cleanup state.",
              "The knowledge model or a model-update proposal reflects the path verdict.",
            ]
          : [
              "Feature/source packet identifies the source scenario and expected behavior.",
              "A runnable spec and replay script are created or an exact external blocker is recorded.",
              "The new work is linked to the knowledge-model path and ready for runner verification.",
            ],
        forbidden: [
          "Do not treat dry-run output as live verification.",
          "Do not hard-code credentials, subscription IDs, or tenant-specific secrets.",
          "Do not bypass project runner artifacts when executing live staging work.",
        ],
        conflict_scope: [
          `feature:${featureId}`,
          `path:${pathId}`,
          ...(stem ? [`artifact:${stem}`] : []),
        ],
        context: {
          seeded_by: "model-gap-frontier",
          seed_reason: input.reason ?? "capacity-underfilled-with-gaps",
          model_path_id: pathId,
          feature_id: featureId,
          model_status: path.status ?? "unknown",
          spec: hasSpec ? `specs/${stem}.json` : undefined,
          replay: hasReplay ? `replays/${stem}.ts` : undefined,
          seed_preference: input.prefer ?? "execution",
        },
        trace: {
          created_at: now,
          created_by: "model-gap-frontier-seeder",
        },
      };
      appendSeededTask(tree, parent, task);
      created.push(task.id);
    }

    if (created.length > 0) {
      saveTaskTreeWithKanbanSnapshot(config, tree);
      appendToolJournal(config, {
        kind: "model_gap_backlog_seeded",
        task_ids: created,
        reason: input.reason ?? "capacity-underfilled-with-gaps",
      });
    }

    return { created, skipped, gapCount: gaps.length };
  });
}
