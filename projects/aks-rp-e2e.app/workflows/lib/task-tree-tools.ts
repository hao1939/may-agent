import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import {
  appendToolJournal,
  assignTask as sdkAssignTask,
  completeTask as sdkCompleteTask,
  isLeaf,
  kanbanTaskTreeState as sdkKanbanTaskTreeState,
  markTaskDone as sdkMarkTaskDone,
  planningPacket as sdkPlanningPacket,
  normalizeStringArray,
  pruneMissingChildren,
  readTask,
  readTaskTree,
  rejectTaskReview as sdkRejectTaskReview,
  projectRuntimePaths,
  taskState,
  repairTaskTreeRollups as sdkRepairTaskTreeRollups,
  rollupParent as sdkRollupParent,
  saveTaskTreeWithKanbanSnapshot as sdkSaveTaskTreeWithKanbanSnapshot,
  summarizeBlockedFrontier,
  taskKanbanColumn as sdkTaskKanbanColumn,
  taskTreeConfig as sdkTaskTreeConfig,
  taskRevision,
  unblockTask as sdkUnblockTask,
  updateTaskOutputs as sdkUpdateTaskOutputs,
  updateTaskText as sdkUpdateTaskText,
  summarizeTaskTree as sdkSummarizeTaskTree,
  withTreeLock,
  type RollupParentInput,
  type TaskKanbanColumn,
  type TaskKanbanProjection,
  type TaskKanbanSnapshot,
  type TaskKanbanState,
  type TaskNode,
  type TaskPlanningPacket,
  type TaskPlanningSnapshot,
  type TaskTree,
  type TaskTreeConfig,
  type TaskTreeCompactResult,
  type TaskTreeHygieneSummary,
  type TaskTreeSummary,
  type TaskTreeToolConfig,
} from "@may-agent/sdk";
import { compactDoneLeaves as sdkCompactDoneLeaves } from "@may-agent/sdk";
import {
  exactBlockedWaitStewardshipProgress,
  heldDispatchRepresentedFrontierProgress,
  runnableDurableLoopProgress,
} from "./durable-loop-wait-stewardship.ts";
import {
  defaultFeatureCompactLoopStatePath,
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
} from "./feature-compact-loop-store.ts";
import {
  defaultSpecLoopStatePath,
  type SpecLoopSpecState,
  type SpecLoopState,
} from "./spec-loop-store.ts";
import {
  specLoopSpecHasStructuredSuccessor,
  specStateSelfRepresentsExactFrontier,
} from "./spec-loop-frontier.ts";
import { buildProjectSnapshotV2 } from "./project-snapshot-v2.ts";

export {
  acknowledgeTaskAssignments,
  appendPlannerRun,
  appendToolJournal,
  assignRunnableBacklogTasks,
  createTask,
  drainTaskAssignments,
  peekTaskAssignments,
  pruneMissingChildren,
  readTask,
  taskKanbanColumn,
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

export const PROJECT_CONDITION_MUTATION_ACTIONS_V2 = [
  "observe",
  "resolve",
  "fallback-claim",
  "fallback-dispatch",
  "fallback-acknowledge",
] as const;

export type ProjectConditionMutationActionV2 =
  (typeof PROJECT_CONDITION_MUTATION_ACTIONS_V2)[number];

export type ProjectConditionMutationAuthorityV2 = {
  kind: "project-condition-v2";
  conditionId: string;
  taskId: string;
  taskRevision: number;
  action: ProjectConditionMutationActionV2;
};

type ConditionSubjectV2 = {
  kind?: unknown;
  id?: unknown;
  revision?: unknown;
};

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function openConditionSubjectV2(
  conditionId: string,
  value: unknown,
): {
  conditionId: string;
  taskId: string;
  taskRevision: number;
} | null {
  const condition = recordValue(value);
  if (!condition || condition.status !== "open") return null;
  const subject = recordValue(condition.subject) as ConditionSubjectV2 | null;
  if (
    subject?.kind !== "task" ||
    typeof subject.id !== "string" ||
    typeof subject.revision !== "number" ||
    !Number.isInteger(subject.revision) ||
    subject.revision < 0
  ) {
    return null;
  }
  return {
    conditionId,
    taskId: subject.id,
    taskRevision: subject.revision,
  };
}

function sameStoredValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function conditionAuthorityMatches(
  authority: unknown,
  ownership: NonNullable<ReturnType<typeof openConditionSubjectV2>>,
): boolean {
  const candidate = recordValue(authority);
  const action = candidate?.action;
  return Boolean(
    candidate?.kind === "project-condition-v2" &&
    candidate.conditionId === ownership.conditionId &&
    candidate.taskId === ownership.taskId &&
    candidate.taskRevision === ownership.taskRevision &&
    typeof action === "string" &&
    PROJECT_CONDITION_MUTATION_ACTIONS_V2.includes(
      action as ProjectConditionMutationActionV2,
    ),
  );
}

export function validateProjectTaskTreeMutationV2(input: {
  current: TaskTree;
  next: TaskTree;
  authority?: unknown;
}): void {
  for (const [conditionId, rawCondition] of Object.entries(
    input.current.conditions ?? {},
  )) {
    const ownership = openConditionSubjectV2(conditionId, rawCondition);
    if (!ownership) continue;
    const currentTask = input.current.tasks[ownership.taskId];
    if (!currentTask || taskRevision(currentTask) !== ownership.taskRevision) {
      continue;
    }
    const conditionChanged = !sameStoredValue(
      rawCondition,
      input.next.conditions?.[conditionId],
    );
    const taskChanged = !sameStoredValue(
      currentTask,
      input.next.tasks[ownership.taskId],
    );
    if (!conditionChanged && !taskChanged) continue;
    if (conditionAuthorityMatches(input.authority, ownership)) continue;
    throw new Error(
      `Task ${ownership.taskId} revision ${ownership.taskRevision} is owned by open Condition ${conditionId}; only the correlated Condition observe, resolve, fallback, or continuation command may mutate it`,
    );
  }
}

export function withProjectTaskTreeMutationGuard(
  config: TaskTreeConfig,
  authority?: ProjectConditionMutationAuthorityV2,
): TaskTreeConfig {
  const priorValidator = config.validateMutation;
  return {
    ...config,
    mutationAuthority: authority,
    validateMutation: (input) => {
      if (
        priorValidator &&
        priorValidator !== validateProjectTaskTreeMutationV2
      ) {
        priorValidator(input);
      }
      validateProjectTaskTreeMutationV2(input);
    },
  };
}

export function taskTreeConfig(input: TaskTreeToolConfig): TaskTreeConfig {
  return withProjectTaskTreeMutationGuard(sdkTaskTreeConfig(input));
}

export function assignTask(
  config: TaskTreeConfig,
  input: Parameters<typeof sdkAssignTask>[1],
): ReturnType<typeof sdkAssignTask> {
  return sdkAssignTask(withProjectTaskTreeMutationGuard(config), input);
}

export function completeTask(
  config: TaskTreeConfig,
  input: Parameters<typeof sdkCompleteTask>[1],
): ReturnType<typeof sdkCompleteTask> {
  return sdkCompleteTask(withProjectTaskTreeMutationGuard(config), input);
}

export function rejectTaskReview(
  config: TaskTreeConfig,
  input: Parameters<typeof sdkRejectTaskReview>[1],
): ReturnType<typeof sdkRejectTaskReview> {
  return sdkRejectTaskReview(withProjectTaskTreeMutationGuard(config), input);
}

export function requeueStaleActiveTasks(
  config: TaskTreeConfig,
  input: {
    taskIds: string[];
    reason?: string;
    freshSession?: boolean;
  },
): string[] {
  const uniqueIds = [...new Set(input.taskIds.filter(Boolean))];
  if (uniqueIds.length === 0) return [];
  const guardedConfig = withProjectTaskTreeMutationGuard(config);
  return withTreeLock(guardedConfig, () => {
    const tree = readTaskTree(guardedConfig);
    const requeued: string[] = [];
    const now = new Date().toISOString();
    for (const taskId of uniqueIds) {
      const task = tree.tasks[taskId];
      if (!task || !isLeaf(task) || taskState(task) !== "active") continue;
      const priorSessionId =
        typeof task.session_id === "string" && task.session_id.trim()
          ? task.session_id.trim()
          : undefined;
      const priorAttemptId = traceString(task, "current_attempt_id");
      task.status = "backlog";
      task.state = "backlog";
      if (input.freshSession) task.session_id = undefined;
      task.trace = {
        ...(task.trace ?? {}),
        stale_active_requeued_at: now,
        stale_active_requeue_reason: input.reason ?? "session-not-running",
        stale_active_fresh_session: input.freshSession === true,
        previous_attempt_id: priorAttemptId || undefined,
        previous_session_id: priorSessionId,
        current_attempt_id: undefined,
        worker_started_attempt_id: undefined,
        worker_started_at: undefined,
      };
      requeued.push(task.id);
    }
    if (requeued.length > 0) {
      tree.active_task_ids = Object.values(tree.tasks)
        .filter((task) => isLeaf(task) && taskState(task) === "active")
        .map((task) => task.id)
        .sort((a, b) => a.localeCompare(b));
      tree.active_task_id = tree.active_task_ids[0] ?? null;
      saveTaskTreeWithKanbanSnapshot(guardedConfig, tree);
      appendToolJournal(guardedConfig, {
        kind: "stale_active_tasks_requeued",
        task_ids: requeued,
        reason: input.reason ?? "session-not-running",
      });
    }
    return requeued;
  });
}

export function updateTaskOutputs(
  config: TaskTreeConfig,
  input: Parameters<typeof sdkUpdateTaskOutputs>[1],
): ReturnType<typeof sdkUpdateTaskOutputs> {
  return sdkUpdateTaskOutputs(withProjectTaskTreeMutationGuard(config), input);
}

export function unblockTask(
  config: TaskTreeConfig,
  input: Parameters<typeof sdkUnblockTask>[1],
): ReturnType<typeof sdkUnblockTask> {
  return sdkUnblockTask(withProjectTaskTreeMutationGuard(config), input);
}

const MIN_BLOCKED_WAIT_FALLBACK_WINDOW_MS = 10 * 60_000;

function projectSnapshotKanban(
  tree: TaskTree,
  legacy: TaskKanbanProjection,
): TaskKanbanProjection {
  const snapshot = buildProjectSnapshotV2({
    projectId: "aks-rp-e2e",
    tree,
  });
  const columns: Record<TaskKanbanColumn, string[]> = {
    backlog: [...snapshot.frontier.runnable, ...snapshot.frontier.waiting],
    "in-progress": [...snapshot.frontier.active],
    review: [...snapshot.frontier.review],
    blocked: [],
    done: [...snapshot.frontier.done],
  };
  for (const taskId of snapshot.frontier.blocked) {
    const task =
      tree.tasks[taskId] ??
      Object.values(tree.tasks).find((candidate) => candidate.id === taskId);
    const column = task ? sdkTaskKanbanColumn(task) : "blocked";
    if (column === "review") columns.review.push(taskId);
    else columns.blocked.push(taskId);
  }
  for (const ids of Object.values(columns))
    ids.sort((a, b) => a.localeCompare(b));
  const columnCounts = Object.fromEntries(
    Object.entries(columns).map(([column, ids]) => [column, ids.length]),
  ) as Record<TaskKanbanColumn, number>;
  const statusCounts = {
    backlog: columns.backlog.length,
    active: columns["in-progress"].length,
    review: snapshot.frontier.review.length,
    blocked: snapshot.frontier.blocked.length,
    done: columns.done.length,
  };
  const totalCards = Object.values(columnCounts).reduce(
    (total, count) => total + count,
    0,
  );
  const settled = columnCounts.done + columnCounts.blocked;
  return {
    ...legacy,
    total_cards: totalCards,
    tree_total: snapshot.frontier.counts.total,
    status_counts: statusCounts,
    column_counts: columnCounts,
    card_ids_by_column: columns,
    settled_pct: totalCards ? Math.round((settled / totalCards) * 100) : 0,
  };
}

function writeProjectSnapshotKanban(
  config: TaskTreeConfig,
  tree: TaskTree,
  legacy: TaskKanbanProjection,
): TaskKanbanSnapshot {
  const snapshot: TaskKanbanSnapshot = {
    version: 1,
    generated_at: new Date().toISOString(),
    tree_updated_at: tree.updated_at,
    kanban: projectSnapshotKanban(tree, legacy),
  };
  const path = projectRuntimePaths(config.appDir).kanbanPath;
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  renameSync(tempPath, path);
  return snapshot;
}

export function saveTaskTreeWithKanbanSnapshot(
  config: TaskTreeConfig,
  tree: TaskTree,
  authority?: ProjectConditionMutationAuthorityV2,
): TaskKanbanSnapshot {
  const guardedConfig = withProjectTaskTreeMutationGuard(config, authority);
  const legacy = sdkSaveTaskTreeWithKanbanSnapshot(guardedConfig, tree);
  return writeProjectSnapshotKanban(guardedConfig, tree, legacy.kanban);
}

export function kanbanTaskTreeState(config: TaskTreeConfig): TaskKanbanState {
  const legacy = sdkKanbanTaskTreeState(config);
  return {
    tree: legacy.tree,
    kanban: projectSnapshotKanban(legacy.tree, legacy.kanban),
  };
}

export function writeKanbanSnapshot(
  config: TaskTreeConfig,
): TaskKanbanSnapshot {
  const state = sdkKanbanTaskTreeState(config);
  return writeProjectSnapshotKanban(config, state.tree, state.kanban);
}

function configuredProjectGoal(config: TaskTreeConfig): string | null {
  const definition = readJsonFile<{ goal?: unknown }>(
    join(config.appDir, "project.json"),
    {},
  );
  return typeof definition.goal === "string" && definition.goal.trim()
    ? definition.goal.trim()
    : null;
}

export function updateTaskText(
  config: TaskTreeConfig,
  input: Parameters<typeof sdkUpdateTaskText>[1],
): ReturnType<typeof sdkUpdateTaskText> {
  if (typeof input.goal === "string") {
    const tree = readTaskTree(config);
    const configuredGoal = configuredProjectGoal(config);
    if (
      configuredGoal &&
      input.taskId === tree.root_task_id &&
      input.goal.trim() !== configuredGoal
    ) {
      throw new Error(
        `Project root goal is immutable; update project.json first or use an ops/* or focus task for temporary operating work`,
      );
    }
  }
  return sdkUpdateTaskText(withProjectTaskTreeMutationGuard(config), input);
}

export type StructuralTaskReadout = {
  id: string;
  owner: string | null;
  state: string;
  kind: string | null;
  parent_id: string | null;
};

export type AppTaskTreeSummary = TaskTreeSummary & {
  active_structural_task_ids: string[];
  active_structural_tasks: StructuralTaskReadout[];
  active_count_explanation: string;
  backlog_structural_task_ids: string[];
  backlog_count_explanation: string;
  blocked_structural_task_ids: string[];
  blocked_count_explanation: string;
};

export type RefreshBlockedWaitInput = {
  taskId: string;
  condition: string;
  resumeCondition: string;
  summary: string;
  category?: string;
  owner?: string;
  waitingFor?: Record<string, unknown>;
  observedBy?: Record<string, unknown>;
  observationMethod?: string;
  nextCheckAt?: string;
  fallbackAt?: string;
  fallbackAction?: string;
};

type MarkDoneInput = {
  taskId: string;
  taskRevision?: number;
  attemptId?: string;
  summary: string;
  resolution?: string;
  reviewDecision?: string;
};

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

function scrubTerminalWaitContext(
  context: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...context };
  delete next.terminalPipelineWaitReview;
  delete next.terminalGitHubWaitReview;
  return next;
}

function scrubTerminalWaitTrace(
  trace: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...trace };
  for (const key of [
    "terminal_pipeline_wait_observed_at",
    "terminal_pipeline_wait_run_id",
    "terminal_pipeline_wait_run_status",
    "terminal_pipeline_wait_run_conclusion",
    "terminal_pipeline_wait_run_url",
    "terminal_github_wait_observed_at",
    "terminal_github_wait_run_id",
    "terminal_github_wait_run_status",
    "terminal_github_wait_run_conclusion",
    "terminal_github_wait_run_url",
    "previous_blocker_before_terminal_pipeline_wait_review",
    "previous_blocker_before_terminal_github_wait_review",
  ]) {
    delete next[key];
  }
  return next;
}

function pausedDurableLoopWaitStewardship(task: TaskNode): boolean {
  if (!durableLoopTaskIds.has(task.id)) return false;
  return exactBlockedWaitStewardshipProgress(workflowProgress(task));
}

function heldDurableLoopRepresentedFrontier(task: TaskNode): boolean {
  if (!durableLoopTaskIds.has(task.id)) return false;
  return heldDispatchRepresentedFrontierProgress(workflowProgress(task));
}

function runnableDurableLoopAlreadyHasOpenChildFrontier(
  task: TaskNode,
): boolean {
  if (!durableLoopTaskIds.has(task.id)) return false;
  const progress = workflowProgress(task);
  if (!progress || progress.completionReady !== false) return false;
  return (
    (numberProgressField(progress, "activeChildren") ?? 0) > 0 ||
    (numberProgressField(progress, "reviewChildren") ?? 0) > 0 ||
    (numberProgressField(progress, "waitingChildren") ?? 0) > 0 ||
    (numberProgressField(progress, "backlogChildren") ?? 0) > 0 ||
    (numberProgressField(progress, "openSupportChildren") ?? 0) > 0 ||
    (numberProgressField(progress, "openFollowups") ?? 0) > 0 ||
    (numberProgressField(progress, "openSpecVerifierChildren") ?? 0) > 0
  );
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

function hasActiveFrontierDescendant(
  tree: TaskTree,
  ancestorTaskId: string,
  frontierActiveIds: Set<string>,
): boolean {
  for (const taskId of frontierActiveIds) {
    if (taskId === ancestorTaskId) continue;
    let cursor = tree.tasks[taskId];
    const seen = new Set<string>();
    while (cursor?.parent_id && !seen.has(cursor.id)) {
      if (cursor.parent_id === ancestorTaskId) return true;
      seen.add(cursor.id);
      cursor = tree.tasks[cursor.parent_id];
    }
  }
  return false;
}

function suppressedActiveDurableLoopRoots(
  tree: TaskTree,
  frontierActiveIds: string[],
): Set<string> {
  const activeSet = new Set(frontierActiveIds);
  return new Set(
    frontierActiveIds.filter(
      (taskId) =>
        durableLoopTaskIds.has(taskId) &&
        hasActiveFrontierDescendant(tree, taskId, activeSet),
    ),
  );
}

type AppFrontierSuppression = {
  nonReviewableDurableLoops: Set<string>;
  suppressedRunnableDurableLoops: Set<string>;
  suppressedActiveDurableLoops: Set<string>;
};

function appFrontierSuppression(
  tree: TaskTree,
  frontier: Pick<TaskTreeSummary["frontier"], "runnable" | "active" | "review">,
): AppFrontierSuppression {
  return {
    nonReviewableDurableLoops: new Set(
      [...durableLoopTaskIds].filter((taskId) => {
        const task = tree.tasks[taskId];
        if (!task) return false;
        return workflowProgressBlocksCompletion(task) !== null;
      }),
    ),
    suppressedRunnableDurableLoops: new Set(
      frontier.runnable.filter((taskId) => {
        const task = tree.tasks[taskId];
        return (
          !!task &&
          (heldDurableLoopRepresentedFrontier(task) ||
            runnableDurableLoopAlreadyHasOpenChildFrontier(task))
        );
      }),
    ),
    suppressedActiveDurableLoops: suppressedActiveDurableLoopRoots(
      tree,
      frontier.active,
    ),
  };
}

function hasAppFrontierSuppression(
  suppression: AppFrontierSuppression,
): boolean {
  return (
    suppression.nonReviewableDurableLoops.size > 0 ||
    suppression.suppressedRunnableDurableLoops.size > 0 ||
    suppression.suppressedActiveDurableLoops.size > 0
  );
}

function structuralTasksByState(
  tree: TaskTree,
  state: string,
  frontierIds: string[],
): TaskNode[] {
  const frontierSet = new Set(frontierIds);
  return Object.values(tree.tasks)
    .filter((task) => taskState(task) === state)
    .filter((task) => !isLeaf(task))
    .filter((task) => !frontierSet.has(task.id))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function structuralTaskIdsByState(
  tree: TaskTree,
  state: string,
  frontierIds: string[],
): string[] {
  return structuralTasksByState(tree, state, frontierIds).map(
    (task) => task.id,
  );
}

function structuralTaskReadouts(tasks: TaskNode[]): StructuralTaskReadout[] {
  return tasks.map((task) => ({
    id: task.id,
    owner:
      typeof task.owner === "string" && task.owner.trim().length > 0
        ? task.owner.trim()
        : null,
    state: taskState(task),
    kind:
      typeof task.kind === "string" && task.kind.trim().length > 0
        ? task.kind.trim()
        : null,
    parent_id:
      typeof task.parent_id === "string" && task.parent_id.trim().length > 0
        ? task.parent_id.trim()
        : null,
  }));
}

export function summarizeTaskTree(config: TaskTreeConfig): AppTaskTreeSummary {
  let summary = sdkSummarizeTaskTree(config);
  let tree = withTreeLock(config, () => readTaskTree(config));
  if (summary.updated_at !== tree.updated_at) {
    summary = sdkSummarizeTaskTree(config);
    tree = withTreeLock(config, () => readTaskTree(config));
  }

  const snapshot = buildProjectSnapshotV2({
    projectId: "aks-rp-e2e",
    tree,
  });
  const suppression = appFrontierSuppression(tree, snapshot.frontier);
  const frontierRunnable = snapshot.frontier.runnable.filter(
    (taskId) => !suppression.suppressedRunnableDurableLoops.has(taskId),
  );
  const frontierActive = snapshot.frontier.active.filter(
    (taskId) => !suppression.suppressedActiveDurableLoops.has(taskId),
  );
  const frontierReview = snapshot.frontier.review.filter(
    (taskId) => !suppression.nonReviewableDurableLoops.has(taskId),
  );
  const frontierBlocked = snapshot.frontier.blocked;
  const structuralActiveTasks = structuralTasksByState(
    tree,
    "active",
    frontierActive,
  );
  const structuralActiveTaskIds = structuralActiveTasks.map((task) => task.id);
  const structuralBacklogTaskIds = structuralTaskIdsByState(tree, "backlog", [
    ...snapshot.frontier.runnable,
    ...snapshot.frontier.waiting,
  ]);
  const structuralBlockedTaskIds = structuralTaskIdsByState(
    tree,
    "blocked",
    frontierBlocked,
  );
  const activeStructuralTaskReadouts = structuralTaskReadouts(
    structuralActiveTasks,
  );
  const activeCountExplanation =
    activeStructuralTaskReadouts.length > 0
      ? `tree_counts.active counts all active task nodes, including non-leaf structural ancestors; counts.active counts only active leaves; frontier.active lists live active frontier leaves/controllers after app-level suppression. Current non-frontier active structural task ids: ${activeStructuralTaskReadouts
          .map((task) =>
            task.owner ? `${task.id}(owner=${task.owner})` : task.id,
          )
          .join(", ")}.`
      : "tree_counts.active, counts.active, and frontier.active currently agree on live active work semantics.";
  const backlogCountExplanation =
    structuralBacklogTaskIds.length > 0
      ? `tree_counts.backlog counts all backlog task nodes, including non-leaf structural ancestors; counts.backlog counts only backlog leaves; frontier.runnable + frontier.waiting list only executable backlog leaves. Current non-frontier backlog structural task ids: ${structuralBacklogTaskIds.join(", ")}.`
      : "tree_counts.backlog, counts.backlog, and executable backlog frontier currently agree on backlog semantics.";
  const blockedCountExplanation =
    structuralBlockedTaskIds.length > 0
      ? `tree_counts.blocked counts all blocked task nodes, including non-leaf structural ancestors; counts.blocked counts only blocked leaves; frontier.blocked lists exact blocked frontier leaves. Current non-frontier blocked structural task ids: ${structuralBlockedTaskIds.join(", ")}.`
      : "tree_counts.blocked, counts.blocked, and frontier.blocked currently agree on blocked leaf frontier semantics.";

  return {
    ...summary,
    updated_at: snapshot.treeUpdatedAt ?? summary.updated_at,
    total: snapshot.frontier.counts.total,
    leaf_total: snapshot.frontier.counts.leafTotal,
    roots: snapshot.frontier.roots,
    active_task_ids: frontierActive,
    counts: {
      ...summary.counts,
      done: snapshot.frontier.counts.done,
      blocked: frontierBlocked.length,
      review: frontierReview.length,
      backlog: snapshot.frontier.counts.backlog,
      active: frontierActive.length,
    },
    active_structural_task_ids: structuralActiveTaskIds,
    active_structural_tasks: activeStructuralTaskReadouts,
    active_count_explanation: activeCountExplanation,
    backlog_structural_task_ids: structuralBacklogTaskIds,
    backlog_count_explanation: backlogCountExplanation,
    blocked_structural_task_ids: structuralBlockedTaskIds,
    blocked_count_explanation: blockedCountExplanation,
    frontier: {
      ...summary.frontier,
      runnable: frontierRunnable,
      waiting: snapshot.frontier.waiting,
      active: frontierActive,
      review: frontierReview,
      blocked: frontierBlocked,
    },
  };
}

export function listRunnableBacklogTaskIds(
  config: TaskTreeConfig,
  limit = 20,
): string[] {
  return summarizeTaskTree(config).frontier.runnable.slice(0, limit);
}

export function confirmRunnableBacklogLeaves(
  config: TaskTreeConfig,
  limit = 10,
): string[] {
  const promotedIds = listRunnableBacklogTaskIds(config, limit);
  if (promotedIds.length === 0) return [];

  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const promoted: string[] = [];
    for (const taskId of promotedIds) {
      const task = tree.tasks[taskId];
      if (!task) continue;
      task.state = "backlog";
      task.status = "backlog";
      task.trace = {
        ...(task.trace ?? {}),
        promoted_at: new Date().toISOString(),
        promoted_by: "task-tree-tool",
      };
      promoted.push(taskId);
    }
    if (promoted.length) {
      saveTaskTreeWithKanbanSnapshot(config, tree);
      appendToolJournal(config, {
        kind: "tasks_confirmed_runnable",
        task_ids: promoted,
      });
    }
    return promoted;
  });
}

function stringValue(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeReviewDecision(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function latestReviewerDecisionForAttempt(
  config: TaskTreeConfig,
  input: { taskId: string; taskRevision: number; attemptId: string },
): string {
  const reviewLogPath = join(
    config.appDir,
    ".state",
    "task-reviewer-runs.jsonl",
  );
  if (!existsSync(reviewLogPath)) return "";
  const lines = readFileSync(reviewLogPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const row = JSON.parse(lines[index]) as Record<string, unknown>;
      if (
        row.result === "project.task.reviewed" &&
        row.task_id === input.taskId &&
        (typeof row.task_revision === "number" ? row.task_revision : 0) ===
          input.taskRevision &&
        row.attempt_id === input.attemptId
      ) {
        return normalizeReviewDecision(row.decision);
      }
    } catch {
      // Ignore malformed historical log lines; they are not authoritative.
    }
  }
  return "";
}

function assertReviewCloseMatchesLatestReviewerDecision(
  config: TaskTreeConfig,
  task: TaskNode,
  input: MarkDoneInput,
) {
  const state = stringValue(task.state ?? task.status);
  if (state !== "review") return;
  const attemptId = stringValue(
    task.trace && typeof task.trace === "object"
      ? (task.trace as Record<string, unknown>).current_attempt_id
      : undefined,
  );
  if (!attemptId) return;
  const latestDecision = latestReviewerDecisionForAttempt(config, {
    taskId: task.id,
    taskRevision: taskRevision(task),
    attemptId,
  });
  if (!latestDecision) return;
  if (latestDecision === "redo") {
    throw new Error(
      `Review task ${task.id} attempt ${attemptId} has latest reviewer decision redo; refusing to mark it done. Apply the redo through project.task.reviewed handling / reject-review so the same task is retried with reviewer feedback.`,
    );
  }
  const requestedDecision = normalizeReviewDecision(input.reviewDecision);
  if (requestedDecision === latestDecision) return;
  throw new Error(
    `Review task ${task.id} attempt ${attemptId} has latest reviewer decision ${latestDecision}; refusing to mark it done with ${requestedDecision || "no"} review decision. Apply the reviewer decision through project.task.reviewed handling instead of closing the review task from a parallel planner wake.`,
  );
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

function childReviewResultText(childIds: string[]): string {
  return `Child review pending: ${childIds.join(", ") || "review work"}.`;
}

function childBlockedResultText(childIds: string[]): string {
  return `Blocked on child task(s): ${childIds.join(", ")}.`;
}

function usesChildReviewResultText(task: TaskNode): boolean {
  return (
    typeof task.result === "string" &&
    /^Child review pending:\s*/.test(task.result)
  );
}

function usesChildBlockedResultText(task: TaskNode): boolean {
  return (
    typeof task.result === "string" &&
    /^Blocked on child task\(s\):\s*/.test(task.result)
  );
}

function childResultTextUsesLiveChildLineage(task: TaskNode): boolean {
  const blocker = blockerRecord(task);
  return Boolean(
    blocker?.category === "child-blocked" ||
      usesChildReviewResultText(task) ||
      usesChildBlockedResultText(task),
  );
}

function liveChildResultText(task: TaskNode, tree: TaskTree): string | null {
  const reviewChildIds = normalizeStringArray(task.children).filter(
    (childId) => nodeState(tree.tasks[childId]) === "review",
  );
  const blockedChildIds = normalizeStringArray(task.children).filter(
    (childId) => nodeState(tree.tasks[childId]) === "blocked",
  );

  if (nodeState(task) === "review" && reviewChildIds.length > 0) {
    return childReviewResultText(reviewChildIds);
  }
  if (blockedChildIds.length > 0) {
    return childBlockedResultText(blockedChildIds);
  }
  if (reviewChildIds.length > 0) {
    return childReviewResultText(reviewChildIds);
  }

  return null;
}

function repairChildReviewParentResults(config: TaskTreeConfig): string[] {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const repaired: string[] = [];

    for (const task of Object.values(tree.tasks)) {
      if (!childResultTextUsesLiveChildLineage(task)) continue;

      const expected = liveChildResultText(task, tree);
      if (!expected || !/^Child review pending:\s*/.test(expected)) continue;
      if (task.result === expected) continue;
      task.result = expected;
      repaired.push(task.id);
    }

    if (repaired.length > 0) {
      saveTaskTreeWithKanbanSnapshot(config, tree);
      appendToolJournal(config, {
        kind: "child_review_parent_results_repaired",
        task_ids: repaired,
        reason:
          "parent result text refreshed from current review children",
      });
    }

    return repaired;
  });
}

function repairChildBlockedParentResults(config: TaskTreeConfig): string[] {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const repaired: string[] = [];

    for (const task of Object.values(tree.tasks)) {
      if (!childResultTextUsesLiveChildLineage(task)) {
        continue;
      }

      const expected = liveChildResultText(task, tree);
      if (!expected || !/^Blocked on child task\(s\):\s*/.test(expected)) {
        continue;
      }
      if (task.result === expected) continue;
      task.result = expected;
      repaired.push(task.id);
    }

    if (repaired.length > 0) {
      saveTaskTreeWithKanbanSnapshot(config, tree);
      appendToolJournal(config, {
        kind: "child_blocked_parent_results_repaired",
        task_ids: repaired,
        reason: "parent result text refreshed from current blocked children",
      });
    }

    return repaired;
  });
}

function addHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * 3_600_000).toISOString();
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}

export function normalizeBlockedWaitObservationWindow(input: {
  nextCheckAt?: string | null;
  fallbackAt?: string | null;
  minFallbackWindowMs?: number;
}): {
  nextCheckAt?: string;
  fallbackAt?: string;
} {
  const nextCheckAt =
    typeof input.nextCheckAt === "string" && input.nextCheckAt.trim().length > 0
      ? input.nextCheckAt
      : undefined;
  const fallbackAt =
    typeof input.fallbackAt === "string" && input.fallbackAt.trim().length > 0
      ? input.fallbackAt
      : undefined;
  if (!nextCheckAt || !fallbackAt) {
    return { nextCheckAt, fallbackAt };
  }

  const nextCheckMs = Date.parse(nextCheckAt);
  const fallbackMs = Date.parse(fallbackAt);
  if (!Number.isFinite(nextCheckMs) || !Number.isFinite(fallbackMs)) {
    return { nextCheckAt, fallbackAt };
  }
  if (nextCheckMs < fallbackMs) {
    return { nextCheckAt, fallbackAt };
  }

  return {
    nextCheckAt,
    fallbackAt: new Date(
      nextCheckMs +
        Math.max(
          input.minFallbackWindowMs ?? MIN_BLOCKED_WAIT_FALLBACK_WINDOW_MS,
          1,
        ),
    ).toISOString(),
  };
}

function syncFeatureCompactProjectionTiming(
  config: TaskTreeConfig,
  task: TaskNode,
): void {
  const blocker = blockerRecord(task);
  if (!blocker) return;
  const nextCheckAt =
    typeof blocker.next_check_at === "string" ? blocker.next_check_at : null;
  const fallbackAt =
    typeof blocker.fallback_at === "string" ? blocker.fallback_at : null;
  if (!nextCheckAt && !fallbackAt) return;

  const statePath = defaultFeatureCompactLoopStatePath(config.appDir);
  if (!existsSync(statePath)) return;

  const { state } = loadFeatureCompactLoopState({
    appDir: config.appDir,
    projectDir: config.projectDir,
    loopTaskId: "aks-feature-compact-loop",
    windowSize: 1,
    statePath,
    refreshFromProject: false,
  });

  let changed = false;
  const now = new Date().toISOString();
  for (const feature of Object.values(state.features ?? {})) {
    if (feature.taskId !== task.id) continue;
    if (nextCheckAt && feature.nextCheckAt !== nextCheckAt) {
      feature.nextCheckAt = nextCheckAt;
      changed = true;
    }
    if (fallbackAt && feature.fallbackAt !== fallbackAt) {
      feature.fallbackAt = fallbackAt;
      changed = true;
    }
    if (changed) feature.updatedAt = now;
  }

  if (changed) saveFeatureCompactLoopState(statePath, state);
}

export function refreshBlockedWait(
  config: TaskTreeConfig,
  input: RefreshBlockedWaitInput,
): TaskNode {
  const condition = input.condition.trim();
  const resumeCondition = input.resumeCondition.trim();
  const summary = input.summary.trim();
  if (!condition) throw new Error("Blocked wait condition cannot be empty");
  if (!resumeCondition) {
    throw new Error("Blocked wait resume condition cannot be empty");
  }
  if (!summary) throw new Error("Blocked wait summary cannot be empty");

  const task = withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const target = tree.tasks[input.taskId];
    if (!target) throw new Error(`Task not found: ${input.taskId}`);
    if (!isLeaf(target)) throw new Error(`Task ${target.id} is not a leaf`);

    const now = new Date().toISOString();
    const context = scrubTerminalWaitContext(taskContext(target));
    const trace = scrubTerminalWaitTrace(
      target.trace &&
        typeof target.trace === "object" &&
        !Array.isArray(target.trace)
        ? (target.trace as Record<string, unknown>)
        : {},
    );
    const existingBlocker = blockerRecord(target);
    const blockedAt =
      typeof existingBlocker?.blocked_at === "string"
        ? existingBlocker.blocked_at
        : now;
    const existingWaitingFor =
      existingBlocker?.waiting_for &&
      typeof existingBlocker.waiting_for === "object" &&
      !Array.isArray(existingBlocker.waiting_for)
        ? (existingBlocker.waiting_for as Record<string, unknown>)
        : null;
    const existingObservedBy =
      existingBlocker?.observed_by &&
      typeof existingBlocker.observed_by === "object" &&
      !Array.isArray(existingBlocker.observed_by)
        ? (existingBlocker.observed_by as Record<string, unknown>)
        : null;
    const existingObservationMethod =
      typeof existingBlocker?.observation_method === "string"
        ? existingBlocker.observation_method
        : null;
    const existingNextCheckAt =
      typeof existingBlocker?.next_check_at === "string"
        ? existingBlocker.next_check_at
        : null;
    const existingFallbackAt =
      typeof existingBlocker?.fallback_at === "string"
        ? existingBlocker.fallback_at
        : null;
    const existingFallbackAction =
      typeof existingBlocker?.fallback_action === "string"
        ? existingBlocker.fallback_action
        : null;
    const previousStatus = String(target.status ?? target.state ?? "unknown");
    const requestedNextCheckAt =
      input.nextCheckAt ?? existingNextCheckAt ?? addMinutes(now, 10);
    const requestedFallbackAt =
      input.fallbackAt ?? existingFallbackAt ?? addHours(now, 24);
    const { nextCheckAt, fallbackAt } = normalizeBlockedWaitObservationWindow({
      nextCheckAt: requestedNextCheckAt,
      fallbackAt: requestedFallbackAt,
    });

    target.status = "blocked";
    target.state = "blocked";
    target.result = summary;
    target.context = context;
    target.blocker = {
      condition,
      category:
        input.category ??
        (typeof existingBlocker?.category === "string"
          ? existingBlocker.category
          : "external-wait"),
      owner:
        input.owner ??
        (typeof existingBlocker?.owner === "string"
          ? existingBlocker.owner
          : (target.owner ?? "aks-explorer")),
      blocked_at: blockedAt,
      waiting_for: input.waitingFor ??
        existingWaitingFor ?? {
          type: "frontier.changed",
          taskId: input.taskId,
          source: "task-tree.refresh-blocked-wait",
        },
      observed_by: input.observedBy ??
        existingObservedBy ?? {
          workflow: "project-planner",
          trigger: "task-tree.refresh-blocked-wait",
        },
      observation_method:
        input.observationMethod ??
        existingObservationMethod ??
        "Planner/app-ops refreshed this wait after reviewing returned evidence; controller ticks should keep it blocked until the named frontier changes.",
      next_check_at: nextCheckAt,
      resume_condition: resumeCondition,
      fallback_at: fallbackAt,
      fallback_action:
        input.fallbackAction ??
        existingFallbackAction ??
        "If the same wait remains true, refresh evidence or escalate the owner-specific blocker instead of retrying unchanged.",
    };
    target.trace = {
      ...trace,
      blocked_wait_refreshed_at: now,
      blocked_wait_refreshed_by: "task-tree-tool",
      blocked_wait_refresh_summary: summary,
      previous_nonterminal_status: previousStatus,
      current_attempt_id: undefined,
    };
    saveTaskTreeWithKanbanSnapshot(config, tree);
    syncFeatureCompactProjectionTiming(config, target);
    return target;
  });

  appendToolJournal(config, {
    kind: "blocked_wait_refreshed",
    task_id: task.id,
    summary,
  });
  return task;
}

function repairLegacyFocusApprovalStates(config: TaskTreeConfig): string[] {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const now = new Date().toISOString();
    const repaired: string[] = [];

    for (const task of Object.values(tree.tasks ?? {})) {
      if (task.kind !== "focus_plan") continue;
      const rawState = String(task.status ?? task.state ?? "");
      const taskRecord = task as Record<string, unknown>;
      const context =
        task.context &&
        typeof task.context === "object" &&
        !Array.isArray(task.context)
          ? (task.context as Record<string, unknown>)
          : {};
      const needsApproval = context.needs_approval === true;
      if (
        rawState !== "needs_approval" &&
        !(rawState === "backlog" && needsApproval)
      ) {
        continue;
      }

      const updatedAt =
        typeof taskRecord.updated_at === "string" ? taskRecord.updated_at : "";
      const blockedAt =
        updatedAt && Number.isFinite(Date.parse(updatedAt)) ? updatedAt : now;
      const nextCheckAt = addHours(now, 24);
      const fallbackAt = addHours(now, 48);
      const normalizationNote =
        rawState === "backlog"
          ? "Runtime focus-plan context requested human approval while the task still advertised backlog; normalized the stale hidden backlog state to a structured blocked approval wait."
          : "Runtime focus-plan context requested human approval; legacy task state needs_approval was normalized to blocked.";

      task.state = "blocked";
      delete taskRecord.status;
      task.blocker = {
        condition:
          "Focus plan is waiting for human approval of the proposed direction and risk envelope.",
        category: "human-approval",
        owner: "human",
        blocked_at: blockedAt,
        waiting_for: {
          type: "project.approval.submitted",
          approvalKind: "focus-plan",
          taskId: task.id,
          decision: "approve | adjust | hold",
        },
        observed_by: {
          workflow: "project-planner",
          trigger: "project.approval.submitted",
        },
        observation_method:
          "Planner handles the returned project.approval.submitted event and reconciles this focus wait.",
        next_check_at: nextCheckAt,
        resume_condition:
          "Resume when the human owner submits approve, adjust, or hold for this focus plan.",
        resume_at: nextCheckAt,
        fallback_at: fallbackAt,
        fallback_action:
          "If no approval arrives, app-ops should refresh or resend the human approval request, or replace this focus with a safer bounded plan.",
      };
      task.context = {
        ...context,
        needs_approval: true,
        approval_wait_normalized_at: now,
        approval_wait_normalization_note: normalizationNote,
      };
      task.trace = {
        ...(task.trace ?? {}),
        legacy_state_repaired_at: now,
        legacy_state_repaired_by: "task-tree-repair",
        previous_state: rawState,
      };
      repaired.push(task.id);
    }

    if (repaired.length > 0) {
      saveTaskTreeWithKanbanSnapshot(config, tree);
      appendToolJournal(config, {
        kind: "legacy_focus_approval_states_repaired",
        task_ids: repaired,
        reason:
          "focus-plan needs_approval is a workflow result, not runnable backlog; represented it as a structured human approval wait",
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

function specLoopTaskChild(task: TaskNode | undefined): boolean {
  if (!task || task.workflow !== "single-spec-verifier") return false;
  const specId = taskContext(task).specId;
  return typeof specId === "string" && specId.trim().length > 0;
}

function specLoopFollowupTask(task: TaskNode | undefined): boolean {
  return taskContext(task).specLoopFollowup === true;
}

function featureCompactPlannerTask(task: TaskNode | undefined): boolean {
  if (!task || task.workflow !== "feature-compact-planner") return false;
  const featureKey = taskContext(task).featureKey;
  return typeof featureKey === "string" && featureKey.trim().length > 0;
}

function setProgressNumber(
  progress: Record<string, unknown>,
  key: string,
  nextValue: number,
): boolean {
  if (numberProgressField(progress, key) === nextValue) return false;
  progress[key] = nextValue;
  return true;
}

function setProgressString(
  progress: Record<string, unknown>,
  key: string,
  nextValue: string,
): boolean {
  if (progress[key] === nextValue) return false;
  progress[key] = nextValue;
  return true;
}

function setProgressFlag(
  progress: Record<string, unknown>,
  key: string,
  enabled: boolean,
): boolean {
  const current = progress[key] === true;
  if (enabled) {
    if (current) return false;
    progress[key] = true;
    return true;
  }
  if (!(key in progress)) return false;
  delete progress[key];
  return true;
}

function normalizeDurableLoopWorkflowProgress(
  task: TaskNode,
  tree: TaskTree,
): boolean {
  const progress = workflowProgress(task);
  if (!progress) return false;
  let changed = false;

  if (task.id === "aks-spec-verification-loop") {
    let activeChildren = 0;
    let reviewChildren = 0;
    let waitingChildren = 0;
    let backlogChildren = 0;
    let openSpecVerifierChildren = 0;
    let openFollowups = 0;
    let blockedWaitChildren = 0;

    for (const childId of normalizeStringArray(task.children)) {
      const child = tree.tasks[childId];
      if (!child) continue;
      const status = nodeState(child);
      if (specLoopTaskChild(child)) {
        if (status === "active") {
          activeChildren += 1;
          openSpecVerifierChildren += 1;
        } else if (status === "review") {
          reviewChildren += 1;
        } else if (status === "waiting") {
          waitingChildren += 1;
        } else if (status === "backlog") {
          backlogChildren += 1;
          openSpecVerifierChildren += 1;
        }
        continue;
      }
      if (specLoopFollowupTask(child)) {
        if (
          status === "active" ||
          status === "backlog" ||
          status === "review"
        ) {
          openFollowups += 1;
        }
        continue;
      }
      if (status === "blocked") blockedWaitChildren += 1;
      else if (
        status === "active" ||
        status === "backlog" ||
        status === "review" ||
        status === "waiting"
      ) {
        openFollowups += 1;
      }
    }

    const openChildren =
      activeChildren + reviewChildren + waitingChildren + backlogChildren;
    const frontierSummary = [
      `${activeChildren} active child leaf/leaves`,
      `${reviewChildren} review child leaf/leaves`,
      `${waitingChildren} waiting child leaf/leaves`,
      `${backlogChildren} backlog child leaf/leaves`,
      `${blockedWaitChildren} blocked wait leaf/leaves`,
      `${openFollowups} backlog follow-up leaf/leaves`,
    ].join(", ");
    const dispatchablePending =
      numberProgressField(progress, "dispatchablePending") ?? 0;
    const running = numberProgressField(progress, "running") ?? 0;
    const pending = numberProgressField(progress, "pending") ?? 0;
    const unrepresentedNonTerminalCount =
      numberProgressField(progress, "unrepresentedNonTerminalCount") ?? 0;
    const strandedPending =
      numberProgressField(progress, "strandedPending") ??
      Math.max(0, pending - dispatchablePending);
    const noRefillNow =
      openChildren === 0 &&
      activeChildren === 0 &&
      reviewChildren === 0 &&
      waitingChildren === 0 &&
      backlogChildren === 0 &&
      openSpecVerifierChildren === 0 &&
      openFollowups === 0 &&
      blockedWaitChildren > 0 &&
      dispatchablePending === 0 &&
      running === 0 &&
      unrepresentedNonTerminalCount === 0;

    changed =
      setProgressNumber(progress, "openChildren", openChildren) || changed;
    changed =
      setProgressNumber(progress, "activeChildren", activeChildren) || changed;
    changed =
      setProgressNumber(progress, "reviewChildren", reviewChildren) || changed;
    changed =
      setProgressNumber(progress, "waitingChildren", waitingChildren) ||
      changed;
    changed =
      setProgressNumber(progress, "backlogChildren", backlogChildren) ||
      changed;
    changed =
      setProgressNumber(
        progress,
        "openSpecVerifierChildren",
        openSpecVerifierChildren,
      ) || changed;
    changed =
      setProgressNumber(progress, "openFollowups", openFollowups) || changed;
    changed =
      setProgressNumber(progress, "blockedWaitChildren", blockedWaitChildren) ||
      changed;
    changed =
      setProgressString(progress, "frontierSummary", frontierSummary) ||
      changed;
    changed = setProgressFlag(progress, "noRefillNow", noRefillNow) || changed;
    if (noRefillNow) {
      changed =
        setProgressString(
          progress,
          "reason",
          `spec-loop execution is drained and the remaining frontier is exact wait stewardship: ${frontierSummary}; stranded pending=${strandedPending}`,
        ) || changed;
    }
    if (changed) progress.updatedAt = new Date().toISOString();
    return changed;
  }

  if (task.id === "aks-feature-compact-loop") {
    let openChildren = 0;
    let openSupportChildren = 0;
    let blockedWaitChildren = 0;
    for (const childId of normalizeStringArray(task.children)) {
      const child = tree.tasks[childId];
      if (!child) continue;
      const status = nodeState(child);
      if (featureCompactPlannerTask(child)) {
        if (status === "active" || status === "backlog") openChildren += 1;
        continue;
      }
      if (status === "blocked") blockedWaitChildren += 1;
      else if (status !== "done") openSupportChildren += 1;
    }
    const pending = numberProgressField(progress, "pending") ?? 0;
    const running = numberProgressField(progress, "running") ?? 0;
    const blocked = numberProgressField(progress, "blocked") ?? 0;
    const error = numberProgressField(progress, "error") ?? 0;
    const retryBudgetExhausted =
      numberProgressField(progress, "retryBudgetExhausted") ?? 0;
    const unrepresentedNonTerminalCount =
      numberProgressField(progress, "unrepresentedNonTerminalCount") ?? 0;
    const noRefillNow =
      pending === 0 &&
      running === 0 &&
      openChildren === 0 &&
      openSupportChildren === 0 &&
      unrepresentedNonTerminalCount === 0 &&
      (blocked > 0 || error === retryBudgetExhausted) &&
      blockedWaitChildren > 0;

    changed =
      setProgressNumber(progress, "openChildren", openChildren) || changed;
    changed =
      setProgressNumber(progress, "openSupportChildren", openSupportChildren) ||
      changed;
    changed =
      setProgressNumber(progress, "blockedWaitChildren", blockedWaitChildren) ||
      changed;
    changed = setProgressFlag(progress, "noRefillNow", noRefillNow) || changed;
    if (noRefillNow) {
      changed =
        setProgressString(
          progress,
          "reason",
          "feature-compact loop has no runnable planner or support children; the remaining frontier is exact blocked wait stewardship until a stated resume signal lands",
        ) || changed;
    }
    if (changed) progress.updatedAt = new Date().toISOString();
    return changed;
  }

  return false;
}

function durableLoopBlockedWaitStewardshipBlocker(
  task: TaskNode,
  tree: TaskTree,
  now: string,
): Record<string, unknown> | undefined {
  const blockedChildIds = normalizeStringArray(task.children).filter(
    (childId) => nodeState(tree.tasks[childId]) === "blocked",
  );
  if (blockedChildIds.length === 0) return undefined;
  return {
    condition: `Child blocked: ${blockedChildIds.join(", ")}.`,
    category: "child-blocked",
    owner: task.owner,
    blocked_at: now,
    waiting_for: {
      type: "child.task.blocked",
      taskId: task.id,
      childTaskIds: blockedChildIds,
    },
    observed_by: {
      workflow: task.workflow ?? "task-tree-rollup",
      trigger: "task_tree_rollup_repaired",
    },
    observation_method:
      "Task-tree rollup recomputes parent state from current child states; keep this blocked steward only while one or more child tasks remain blocked.",
    next_check_at: addMinutes(now, 10),
    resume_condition:
      "Resume when the blocked child task is resolved or replaced.",
    fallback_at: addHours(now, 24),
    fallback_action:
      "If child-blocked stewardship still holds at fallback time, rerun task-tree rollup/owner review and refresh the blocker metadata or reopen a concrete child follow-up.",
  };
}

function reopenIncompleteDurableLoopRoots(config: TaskTreeConfig): string[] {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const reopened: string[] = [];
    const progressRefreshed: string[] = [];
    const now = new Date().toISOString();

    for (const taskId of durableLoopTaskIds) {
      const task = tree.tasks[taskId];
      if (!task) continue;
      if (normalizeDurableLoopWorkflowProgress(task, tree)) {
        progressRefreshed.push(task.id);
      }
      const childStates = normalizeStringArray(task.children).map((childId) =>
        nodeState(tree.tasks[childId]),
      );
      const status = nodeState(task);
      const progress = workflowProgress(task);
      const exactBlockedWaitStewardship =
        exactBlockedWaitStewardshipProgress(progress);
      if (
        exactBlockedWaitStewardship &&
        status !== "blocked" &&
        status !== "backlog" &&
        status !== "active"
      ) {
        task.status = "blocked";
        task.state = "blocked";
        task.blocker =
          durableLoopBlockedWaitStewardshipBlocker(task, tree, now) ??
          task.blocker;
        task.resolution = undefined;
        task.done_at = undefined;
        task.done_by = undefined;
        task.trace = {
          ...(task.trace ?? {}),
          reopened_at: now,
          reopened_by: "task-tree-repair",
          reopen_reason: `Durable loop root had exact blocked wait stewardship while state=${status || "unknown"}; repair restored blocked durable wait stewardship.`,
          previous_nonterminal_status: status || undefined,
          current_attempt_id: undefined,
          worker_started_attempt_id: undefined,
        };
        reopened.push(task.id);
        continue;
      }
      const childBlockedOnlyStewardship =
        durableLoopChildBlockedOnlyStewardship(task, tree);
      const blocked = childBlockedOnlyStewardship
        ? null
        : (workflowProgressBlocksCompletion(task) ??
          (status === "blocked" &&
          childStates.some((state) =>
            ["active", "review", "backlog"].includes(state),
          )
            ? `Durable loop root is blocked while child rollup is ${childStates.includes("active") ? "active" : childStates.includes("review") ? "review" : "backlog"}`
            : null));
      if (!blocked) continue;
      if (status === "backlog" || status === "active") continue;

      task.status = "backlog";
      task.state = "backlog";
      task.blocker = undefined;
      task.resolution = undefined;
      task.done_at = undefined;
      task.done_by = undefined;
      const context = taskContext(task);
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

    if (reopened.length > 0 || progressRefreshed.length > 0) {
      saveTaskTreeWithKanbanSnapshot(config, tree);
    }
    if (reopened.length > 0) {
      appendToolJournal(config, {
        kind: "durable_loop_roots_reopened",
        task_ids: reopened,
        reason:
          "repair-rollups found durable loop roots with incomplete workflow progress",
      });
    }
    if (progressRefreshed.length > 0) {
      appendToolJournal(config, {
        kind: "durable_loop_progress_refreshed",
        task_ids: progressRefreshed,
        reason:
          "repair-rollups reconciled durable loop workflowProgress child counters against the live child states",
      });
    }

    return reopened;
  });
}

function repairProjectRootGoal(config: TaskTreeConfig): boolean {
  const configuredGoal = configuredProjectGoal(config);
  if (!configuredGoal) return false;
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const root = tree.tasks[tree.root_task_id];
    if (!root || root.goal === configuredGoal) return false;
    const previousGoal = root.goal;
    root.goal = configuredGoal;
    root.trace = {
      ...(root.trace ?? {}),
      project_goal_repaired_at: new Date().toISOString(),
      project_goal_repaired_by: "task-tree-repair",
      previous_project_goal: previousGoal,
    };
    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "project_root_goal_repaired",
      task_id: root.id,
      previous_goal: previousGoal,
      configured_goal: configuredGoal,
    });
    return true;
  });
}

export function repairTaskTreeRollups(config: TaskTreeConfig): ReturnType<
  typeof sdkRepairTaskTreeRollups
> & {
  reopenedDurableLoopRoots: string[];
  repairedChildReviewParentResults: string[];
  repairedChildBlockedParentResults: string[];
  repairedLegacyFocusApprovalStates: string[];
  repairedProjectRootGoal: boolean;
} {
  const initialResult = sdkRepairTaskTreeRollups(config);
  const repairedProjectRootGoal = repairProjectRootGoal(config);
  const repairedLegacyFocusApprovalStates =
    repairLegacyFocusApprovalStates(config);
  const postLegacyResult = repairedLegacyFocusApprovalStates.length
    ? sdkRepairTaskTreeRollups(config)
    : initialResult;
  const repairedChildReviewParentResults =
    repairChildReviewParentResults(config);
  const repairedChildBlockedParentResults =
    repairChildBlockedParentResults(config);
  const reopenedDurableLoopRoots = reopenIncompleteDurableLoopRoots(config);
  return {
    ...postLegacyResult,
    changed:
      initialResult.changed ||
      postLegacyResult.changed ||
      repairedProjectRootGoal ||
      repairedLegacyFocusApprovalStates.length > 0 ||
      reopenedDurableLoopRoots.length > 0 ||
      repairedChildReviewParentResults.length > 0 ||
      repairedChildBlockedParentResults.length > 0,
    repaired: [
      ...new Set([
        ...(initialResult.repaired ?? []),
        ...(postLegacyResult.repaired ?? []),
        ...repairedLegacyFocusApprovalStates.map((taskId) => ({
          taskId,
          from: "needs_approval",
          to: "blocked",
        })),
        ...repairedChildReviewParentResults.map((taskId) => ({
          taskId,
          from: "child-review",
          to: "backlog",
        })),
        ...repairedChildBlockedParentResults.map((taskId) => ({
          taskId,
          from: "child-blocked",
          to: "backlog",
        })),
      ]),
    ],
    reopenedDurableLoopRoots,
    repairedChildReviewParentResults,
    repairedChildBlockedParentResults,
    repairedLegacyFocusApprovalStates,
    repairedProjectRootGoal,
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
  input: MarkDoneInput,
): TaskNode {
  const task = readTask(config, input.taskId);
  if (!task) throw new Error(`Task not found: ${input.taskId}`);
  assertReviewCloseMatchesLatestReviewerDecision(config, task, input);
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
  return sdkMarkTaskDone(withProjectTaskTreeMutationGuard(config), input);
}

function rollupProtectedDoneChildCount(
  tree: TaskTree,
  parent: TaskNode,
): number {
  const dependencyRefs = dependencyReferences(tree);
  return normalizeStringArray(parent.children).filter((childId) => {
    const task = tree.tasks[childId];
    if (!task || !isLeaf(task) || nodeState(task) !== "done") return false;
    return (
      dependencyRefs.has(task.id) ||
      durableLoopTaskIds.has(task.id) ||
      !!workflowProgressBlocksCompletion(task)
    );
  }).length;
}

function implicitRollupArchivableChildIds(
  tree: TaskTree,
  parent: TaskNode,
  limit: number,
): string[] {
  const dependencyRefs = dependencyReferences(tree);
  return normalizeStringArray(parent.children)
    .filter((childId) => {
      const task = tree.tasks[childId];
      if (!task || !isLeaf(task) || nodeState(task) !== "done") return false;
      if (dependencyRefs.has(task.id)) return false;
      if (durableLoopTaskIds.has(task.id)) return false;
      return !workflowProgressBlocksCompletion(task);
    })
    .slice(0, Math.max(0, limit));
}

function promoteOpenParentToActiveWhenChildrenActive(
  config: TaskTreeConfig,
  parentId: string,
): boolean {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const parent = tree.tasks[parentId];
    if (!parent) return false;

    const currentState = nodeState(parent);
    if (currentState === "active" || currentState === "done") {
      return false;
    }

    const hasActiveChild = normalizeStringArray(parent.children).some(
      (childId) => nodeState(tree.tasks[childId]) === "active",
    );
    if (!hasActiveChild) return false;

    parent.state = "active";
    parent.status = "active";
    parent.trace = {
      ...(recordValue(parent.trace) ?? {}),
      active_child_rollup_repaired_at: new Date().toISOString(),
      active_child_rollup_repaired_by: "task-tree-tool",
      previous_state_before_active_child_rollup: currentState,
    };
    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "parent_active_child_rollup_repaired",
      task_id: parent.id,
      from: currentState,
      to: "active",
      reason: "explicit parent rollup left live active child frontier stored non-active",
    });
    return true;
  });
}

export function rollupParent(
  config: TaskTreeConfig,
  input: RollupParentInput,
): TaskTreeCompactResult {
  const tree = readTaskTree(config);
  const parent = tree.tasks[input.parentId];
  if (!parent) throw new Error(`Parent task not found: ${input.parentId}`);

  const requestedIds = [...new Set(input.taskIds ?? [])];
  const implicitSelection = requestedIds.length === 0;
  const selectedIds = implicitSelection
    ? implicitRollupArchivableChildIds(tree, parent, input.limit ?? 200)
    : requestedIds;

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

  const protectedCount = implicitSelection
    ? rollupProtectedDoneChildCount(tree, parent)
    : undefined;
  const result =
    implicitSelection && selectedIds.length === 0
      ? sdkRollupParent(config, {
          ...input,
          limit: 0,
        })
      : sdkRollupParent(config, {
          ...input,
          ...(implicitSelection ? { taskIds: selectedIds } : {}),
        });
  const promotedToActive = promoteOpenParentToActiveWhenChildrenActive(
    config,
    input.parentId,
  );

  const nextResult = {
    ...result,
    changed: result.changed || promotedToActive,
  };

  return protectedCount === undefined
    ? nextResult
    : {
        ...nextResult,
        protected: protectedCount,
      };
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

export type ReadyPathFrontierMaterialization = {
  status: "none" | "covered" | "gap";
  generated_at?: string;
  ready_count: number;
  represented_ready_path_ids: string[];
  unrepresented_ready_path_ids: string[];
};

export type AksTaskPlanningPacket = TaskPlanningPacket & {
  condition_owned_task_ids?: string[];
  project_hygiene_warnings?: ProjectHygieneWarning[];
  blocked_action_warnings?: BlockedActionWarning[];
  ready_path_frontier_materialization?: ReadyPathFrontierMaterialization;
  project_snapshot?: {
    version: "project-snapshot-v2";
    captured_at: string;
    tree_updated_at: string | null;
    frontier_counts: {
      total: number;
      leafTotal: number;
      runnable: number;
      waiting: number;
      active: number;
      review: number;
      blocked: number;
      backlog: number;
      done: number;
    };
  };
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

function isExplicitNonRerunCompactSurfaceHygieneTask(task: TaskNode): boolean {
  const context = taskContext(task);
  if (context.nonRerun !== true) return false;

  const repairSurface = normalizeTextValue(
    context.repairSurface,
  )?.toLowerCase();
  if (!repairSurface || !repairSurface.includes("compact")) return false;

  const scenario = normalizeTextValue(context.scenario)?.toLowerCase();
  return scenario?.startsWith("spec.") === true;
}

function isFinalPathHygieneWarningRepairTask(
  task: TaskNode,
  text: string,
): boolean {
  const conflictScope = normalizeStringArray(task.conflict_scope).map((entry) =>
    entry.toLowerCase(),
  );
  if (
    !conflictScope.includes(
      "ops:task-tree-integrity:final-path-hygiene-warning",
    )
  ) {
    return false;
  }

  return text.includes("stale-terminal-retry") && text.includes("warning");
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
      if (isExplicitNonRerunCompactSurfaceHygieneTask(task)) continue;
      if (isFinalPathHygieneWarningRepairTask(task, text)) continue;
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

function blockerDate(task: TaskNode, field: string): number | null {
  const blocker = task.blocker;
  if (!blocker || typeof blocker !== "object" || Array.isArray(blocker)) {
    return null;
  }
  const value = (blocker as Record<string, unknown>)[field];
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function blockerWaitingForType(task: TaskNode): string {
  const blocker = task.blocker;
  if (!blocker || typeof blocker !== "object" || Array.isArray(blocker)) {
    return "";
  }
  const waitingFor = (blocker as Record<string, unknown>).waiting_for;
  if (
    !waitingFor ||
    typeof waitingFor !== "object" ||
    Array.isArray(waitingFor)
  ) {
    return "";
  }
  const type = (waitingFor as Record<string, unknown>).type;
  return typeof type === "string" ? type.trim().toLowerCase() : "";
}

function exactAdoWaitRunId(task: TaskNode): string {
  const blocker = task.blocker;
  if (blocker && typeof blocker === "object" && !Array.isArray(blocker)) {
    const waitingFor = (blocker as Record<string, unknown>).waiting_for;
    if (
      waitingFor &&
      typeof waitingFor === "object" &&
      !Array.isArray(waitingFor)
    ) {
      const runId = (waitingFor as Record<string, unknown>).runId;
      if (typeof runId === "string" && /^\d{6,}$/.test(runId.trim())) {
        return runId.trim();
      }
    }
  }

  const context = taskContext(task);
  for (const key of [
    "runId",
    "workflowRunId",
    "activeWorkflowRunId",
    "lastRunId",
  ]) {
    const value = context[key];
    if (typeof value === "string" && /^\d{6,}$/.test(value.trim())) {
      return value.trim();
    }
  }

  const trace =
    task.trace && typeof task.trace === "object" && !Array.isArray(task.trace)
      ? (task.trace as Record<string, unknown>)
      : {};
  for (const key of [
    "runId",
    "workflowRunId",
    "activeWorkflowRunId",
    "lastRunId",
  ]) {
    const value = trace[key];
    if (typeof value === "string" && /^\d{6,}$/.test(value.trim())) {
      return value.trim();
    }
  }

  for (const output of normalizeStringArray(task.outputs)) {
    const match = output.match(
      /\.state\/(?:spec-loop|feature-compact-loop)\/artifacts\/(\d{6,})(?:\/|$)/,
    );
    if (match) return match[1];
  }

  return "";
}

function isRefreshedExactAdoCompletionWait(task: TaskNode): boolean {
  if (blockerWaitingForType(task) !== "frontier.changed") return false;

  const runId = exactAdoWaitRunId(task);
  if (!runId) return false;

  const text = taskSearchText(task);
  return (
    includesAny(text, [
      "exact ado completion wait",
      "in-flight azure devops completion wait",
      "queued-run metadata",
      "ado rerun",
    ]) &&
    includesAny(text, [
      `run ${runId} is terminal`,
      `run ${runId} becomes terminal`,
      `rerun ${runId}`,
      `artifacts/${runId}`,
    ]) &&
    includesAny(text, [
      "azure devops",
      "pipeline",
      "artifacts are available",
      "terminal and reviewable",
    ])
  );
}

function isExactAdoCompletionWait(task: TaskNode): boolean {
  const blocker = task.blocker;
  if (!blocker || typeof blocker !== "object" || Array.isArray(blocker)) {
    return false;
  }

  const category =
    typeof blocker.category === "string"
      ? blocker.category.trim().toLowerCase()
      : "";
  if (category !== "external-wait") return false;

  if (blockerWaitingForType(task) === "ado.pipeline_run.completed") {
    return exactAdoWaitRunId(task).length > 0;
  }

  return isRefreshedExactAdoCompletionWait(task);
}

function isPreWindowBlockedExecutionWait(
  task: TaskNode,
  now = Date.now(),
): boolean {
  if (!isLeaf(task)) return false;
  const state = task.status ?? task.state ?? "backlog";
  if (state !== "blocked") return false;

  const resumeAt = blockerDate(task, "resume_at");
  const nextCheckAt = blockerDate(task, "next_check_at");
  const gateAt = resumeAt ?? nextCheckAt;
  if (gateAt == null || gateAt <= now) return false;

  const blocker = task.blocker;
  if (!blocker || typeof blocker !== "object" || Array.isArray(blocker)) {
    return false;
  }
  const owner =
    typeof blocker.owner === "string" ? blocker.owner.trim().toLowerCase() : "";
  const text = taskSearchText(task);
  return (
    owner === "app-ops" &&
    (task.id.startsWith("ops/execute-") ||
      task.id.startsWith("ops-execute-") ||
      includesAny(text, [
        "future-window",
        "do not start before",
        "at or after ",
        "review window opens",
        "fallback window opens",
      ]))
  );
}

function isWatchedAppOpsExternalWait(
  task: TaskNode,
  now = Date.now(),
): boolean {
  if (!isLeaf(task)) return false;
  const state = task.status ?? task.state ?? "backlog";
  if (state !== "blocked") return false;

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
  if (category !== "external-wait" || owner !== "app-ops") return false;

  const gateAt =
    blockerDate(task, "resume_at") ?? blockerDate(task, "next_check_at");
  const fallbackAt = blockerDate(task, "fallback_at");
  if (gateAt == null || gateAt <= now || fallbackAt == null) return false;

  const observedBy = (blocker as Record<string, unknown>).observed_by;
  const observationMethod = (blocker as Record<string, unknown>)
    .observation_method;
  return (
    observedBy != null &&
    typeof observedBy === "object" &&
    !Array.isArray(observedBy) &&
    typeof observationMethod === "string" &&
    observationMethod.trim().length > 0
  );
}

function isReviewGatedPublicationWait(task: TaskNode): boolean {
  if (!isLeaf(task)) return false;
  const state = task.status ?? task.state ?? "backlog";
  if (state !== "blocked") return false;

  const blocker = task.blocker;
  if (!blocker || typeof blocker !== "object" || Array.isArray(blocker)) {
    return false;
  }

  const category =
    typeof blocker.category === "string"
      ? blocker.category.trim().toLowerCase()
      : "";
  if (category !== "external-wait") return false;

  const waitingForType = blockerWaitingForType(task);
  if (waitingForType !== "blocker.resolved") return false;

  const observedBy = (blocker as Record<string, unknown>).observed_by;
  const observationMethod = (blocker as Record<string, unknown>)
    .observation_method;
  if (
    observedBy == null ||
    typeof observedBy !== "object" ||
    Array.isArray(observedBy) ||
    typeof observationMethod !== "string" ||
    observationMethod.trim().length === 0
  ) {
    return false;
  }

  const text = taskSearchText(task);
  const publicationGateText = includesAny(text, [
    "review-gated publication wait",
    "reviewer-gated publication holder",
    "publication holder only",
    "publish the accepted",
    "pipeline-visible branch/head",
    "without publishing unreviewed work",
    "publication-safe decision",
  ]);
  const reviewDecisionText = includesAny(text, [
    "task-reviewer returns",
    "task-reviewer decision",
    "reviewer decision",
    "structured project.task.reviewed decision",
    "project.task.reviewed decision",
    "live review leaves",
    "review chain",
  ]);
  return publicationGateText && reviewDecisionText;
}

function isQuotaHeadroomWaitWithIsolatedAlternativeCheck(
  task: TaskNode,
): boolean {
  if (!isLeaf(task)) return false;
  const state = task.status ?? task.state ?? "backlog";
  if (state !== "blocked") return false;
  if (blockerWaitingForType(task) !== "azure.quota.exhausted") return false;

  const text = taskSearchText(task);
  return (
    includesAny(text, [
      "alternative-target",
      "source-equivalent question is already isolated",
      "same-surface exhausted target",
    ]) &&
    includesAny(text, [
      "lack of a new exact source witness alone must not block progress",
      "must not spawn duplicate blocked work",
      "keep this exact wait as the sole family holder",
    ])
  );
}

function isFeatureCompactExactWait(task: TaskNode): boolean {
  if (taskContext(task).featureCompactExactWait === true) return true;
  if (task.parent_id !== "aks-feature-compact-loop") return false;

  const scopes = normalizeStringArray(task.conflict_scope);
  if (!scopes.some((scope) => scope.startsWith("feature-compact:"))) {
    return false;
  }
  if (!scopes.some((scope) => scope.startsWith("feature:"))) return false;
  if (!scopes.some((scope) => scope.startsWith("feature-compact-wait:"))) {
    return false;
  }

  const text = taskSearchText(task);
  return includesAny(text, [
    "hold compact feature",
    "compact-facing",
    "compact projection",
    "do not rerun unchanged",
    "named condition changes",
    "mixed residual frontier",
    "reviewed-exception",
    "package-partial frontier",
  ]);
}

function isFeatureCompactNonEnvironmentFrontier(task: TaskNode): boolean {
  if (!isFeatureCompactExactWait(task)) return false;
  return [
    "owner.decision",
    "pipeline.result.or.artifact.available",
    "publish.auth.ready",
    "compact.frontier.changed",
    "compact.live-ready.policy",
    "frontier.changed",
    "evidence.available",
    "azure.capacity.available",
    "environment.prerequisite.ready",
  ].includes(blockerWaitingForType(task));
}

function isSupersededCompactSourceWitnessCarrier(task: TaskNode): boolean {
  if (!isFeatureCompactExactWait(task)) return false;
  if (blockerWaitingForType(task) !== "blocker.resolved") return false;

  const blocker = task.blocker;
  if (!blocker || typeof blocker !== "object" || Array.isArray(blocker)) {
    return false;
  }

  const category =
    typeof blocker.category === "string"
      ? blocker.category.trim().toLowerCase()
      : "";
  if (category !== "external-wait") return false;

  const observedBy = (blocker as Record<string, unknown>).observed_by;
  const observationMethod = (blocker as Record<string, unknown>)
    .observation_method;
  if (
    observedBy == null ||
    typeof observedBy !== "object" ||
    Array.isArray(observedBy) ||
    typeof observationMethod !== "string" ||
    observationMethod.trim().length === 0
  ) {
    return false;
  }

  const text = taskSearchText(task);
  const supersededWitnessSignals = [
    "superseded nonlive source witness",
    "superseded nonlive source-witness",
    "superseded source-witness lineage",
    "superseded raw-file/source-witness lineage",
    "superseded raw-file lineage",
  ];
  if (!includesAny(text, supersededWitnessSignals)) return false;

  return includesAny(text, [
    "only active compact frontier",
    "blocked only through",
    "blocked behind",
    "preserves only",
    "already preserved as the exact blocked",
    "exact wait",
  ]);
}

function isSharedFamilyCoveredHolder(task: TaskNode): boolean {
  const waitingForType = blockerWaitingForType(task);
  const isSupportedHolder =
    isFeatureCompactExactWait(task) ||
    task.id.startsWith("hold-spec-") ||
    task.id.startsWith("hold-compact-");
  if (!isSupportedHolder) return false;

  const text = taskSearchText(task);
  const exactSharedFamilyReferenced =
    includesAny(text, [
      "exact shared wait",
      "exact shared-family",
      "exact shared family",
      "shared-family wait",
      "shared family wait",
      "capacity-family wait",
      "shared capacity-family wait",
      "shared underlay/runtime-input family wait",
      "only truthful live carrier",
    ]) || /wait-[a-z0-9-]*family[a-z0-9-]*/.test(text);
  if (!exactSharedFamilyReferenced) return false;

  if (waitingForType === "blocker.resolved") {
    const noLocalSuccessorJudgment =
      includesAny(text, [
        "no sharper successor",
        "no local successor",
        "no truthful local successor",
        "no sharper same-lineage successor",
        "no evidence requiring replacement with a sharper successor",
        "no sharper setup",
      ]) &&
      includesAny(text, [
        "truthful",
        "same-surface retry",
        "alternate-environment",
        "replacement with a sharper successor",
        "setup",
        "escalation",
      ]);
    if (noLocalSuccessorJudgment) return true;

    const passiveCoveredHolderJudgment =
      includesAny(text, [
        "passive trio representation",
        "passive holder",
        "do not treat it as the mover",
        "do not treat it as mover",
        "still governs",
        "owner-contradiction holder",
        "reviewed-exception/domain evidence ceiling",
      ]) &&
      includesAny(text, [
        "single live shared",
        "single live shared automatic/managedsystem capacity-family wait",
        "exact owner-contradiction holder",
        "accepted reviewed-exception/domain evidence ceiling",
        "keep one exact compact trio holder",
        "fallback review still sees the same trio",
      ]);

    return passiveCoveredHolderJudgment;
  }

  const blocker = task.blocker;
  if (!blocker || typeof blocker !== "object" || Array.isArray(blocker)) {
    return false;
  }
  const waitingFor = (blocker as Record<string, unknown>).waiting_for;
  if (
    !waitingFor ||
    typeof waitingFor !== "object" ||
    Array.isArray(waitingFor)
  ) {
    return false;
  }
  const waitingForTaskId = (waitingFor as Record<string, unknown>).taskId;
  if (
    typeof waitingForTaskId !== "string" ||
    !waitingForTaskId.startsWith("wait-shared-")
  ) {
    return false;
  }

  const context = taskContext(task);
  const governedFrontierTaskIds = new Set([
    ...normalizeStringArray(context.frontierTaskIds),
    ...normalizeStringArray(context.compactFrontierTaskIds),
  ]);
  if (!governedFrontierTaskIds.has(waitingForTaskId)) return false;

  return (
    includesAny(text, [
      "compact-facing projection",
      "feature-facing projection",
      "governing family wait",
      "shared family reconciliation path",
      "only the projection of wait-shared-",
      "keep this holder blocked until that shared wait returns",
      "still depends on the live shared underlay/runtime-input family wait",
      "governed by the shared underlay/runtime-input family wait",
    ]) &&
    includesAny(text, [
      "do not broad-rerun",
      "do not carry a duplicate feature-local environment wait",
      "without reopening a feature-local environment blocker",
      "instead of a generic local environment wait",
      "environment umbrella",
      "do not reopen an unchanged compact rerun",
      "do not reopen an unchanged rerun",
      "do not rerun unchanged",
    ])
  );
}

function isFocusPlanApprovalWait(task: TaskNode): boolean {
  if (task.kind !== "focus_plan") return false;
  if (taskContext(task).needs_approval !== true) return false;

  const blocker = task.blocker;
  if (!blocker || typeof blocker !== "object" || Array.isArray(blocker)) {
    return false;
  }

  const category =
    typeof blocker.category === "string"
      ? blocker.category.trim().toLowerCase()
      : "";
  if (category !== "human-approval") return false;

  return blockerWaitingForType(task) === "project.approval.submitted";
}

function isDependentHumanApprovalWait(task: TaskNode): boolean {
  const blocker = task.blocker;
  if (!blocker || typeof blocker !== "object" || Array.isArray(blocker)) {
    return false;
  }

  const category =
    typeof blocker.category === "string"
      ? blocker.category.trim().toLowerCase()
      : "";
  if (category !== "human-approval") return false;
  if (blockerWaitingForType(task) !== "project.approval.submitted") {
    return false;
  }

  const waitingFor = (blocker as Record<string, unknown>).waiting_for;
  if (
    !waitingFor ||
    typeof waitingFor !== "object" ||
    Array.isArray(waitingFor)
  ) {
    return false;
  }

  const waitTaskId = (waitingFor as Record<string, unknown>).taskId;
  const focusTaskId = (waitingFor as Record<string, unknown>).focusTaskId;
  return (
    (typeof waitTaskId === "string" && waitTaskId.trim() !== task.id) ||
    typeof focusTaskId === "string"
  );
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
  const classicRepresentedShape =
    includesAny(text, representedSignals) &&
    includesAny(text, [
      "materially changes",
      "remains the exact",
      "still controls",
      "represented by ",
    ]) &&
    includesAny(text, ["frontier", "carrier", "represented blocker"]);
  if (classicRepresentedShape) return true;

  const compactResidualSplitShape =
    (task.id.startsWith("hold-compact-") ||
      task.parent_id === "aks-feature-compact-loop") &&
    includesAny(text, [
      "exact residual wait plus active remediation",
      "keep this residual holder blocked only while active task",
    ]) &&
    includesAny(text, [
      "wait-shared-",
      "live shared",
      "owner-arbitration waits preserve",
      "remaining blocked members",
    ]) &&
    includesAny(text, [
      "do not widen back into a broad",
      "without reopening a broad rerun",
    ]) &&
    includesAny(text, [
      "materially changes the exact residual",
      "yields a runnable next step",
      "still-blocked compact residual members",
    ]);

  return compactResidualSplitShape;
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
          isHumanOwnedExternalWait(task) ||
          isRepresentedBlockedFrontier(task) ||
          isFeatureCompactNonEnvironmentFrontier(task) ||
          isSharedFamilyCoveredHolder(task) ||
          isSupersededCompactSourceWitnessCarrier(task) ||
          isFocusPlanApprovalWait(task) ||
          isDependentHumanApprovalWait(task) ||
          isWatchedAppOpsExternalWait(task) ||
          isExactAdoCompletionWait(task) ||
          isReviewGatedPublicationWait(task) ||
          isQuotaHeadroomWaitWithIsolatedAlternativeCheck(task)
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
          isFeatureCompactNonEnvironmentFrontier(task) ||
          isSharedFamilyCoveredHolder(task) ||
          isFocusPlanApprovalWait(task) ||
          isDependentHumanApprovalWait(task) ||
          isPreWindowBlockedExecutionWait(task) ||
          isWatchedAppOpsExternalWait(task) ||
          isExactAdoCompletionWait(task) ||
          isReviewGatedPublicationWait(task)
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

function taskTreeHygieneSummary(
  config: TaskTreeConfig,
): TaskTreeHygieneSummary | undefined {
  const tree = readTaskTree(config);
  const candidates = doneLeafCompactionCandidates(tree);
  const protectedCount = doneLeafCompactionProtectedCount(tree);

  if (candidates.length === 0 && protectedCount === 0) return undefined;

  const byParent = new Map<
    string,
    {
      parent: TaskNode;
      safeDoneLeaves: TaskNode[];
      doneChildCount: number;
      openChildCount: number;
      childCount: number;
    }
  >();

  for (const leaf of candidates) {
    const parentId = leaf.parent_id ?? "";
    const parent = parentId ? tree.tasks[parentId] : undefined;
    if (!parent) continue;
    const existing = byParent.get(parent.id) ?? {
      parent,
      safeDoneLeaves: [],
      doneChildCount: 0,
      openChildCount: 0,
      childCount: normalizeStringArray(parent.children).length,
    };
    existing.safeDoneLeaves.push(leaf);
    byParent.set(parent.id, existing);
  }

  for (const entry of byParent.values()) {
    for (const childId of normalizeStringArray(entry.parent.children)) {
      const child = tree.tasks[childId];
      if (!child) continue;
      if (nodeState(child) === "done") entry.doneChildCount++;
      else entry.openChildCount++;
    }
  }

  const compactionCandidates = [...byParent.values()]
    .map((entry) => {
      const context = taskContext(entry.parent);
      const archivedCount =
        typeof context.archived_done_leaf_count === "number"
          ? context.archived_done_leaf_count
          : undefined;
      const rollupSummary =
        typeof context.rollup_summary === "string"
          ? context.rollup_summary.slice(0, 500)
          : undefined;
      return {
        parent_id: entry.parent.id,
        child_count: entry.childCount,
        open_child_count: entry.openChildCount,
        done_child_count: entry.doneChildCount,
        safe_done_leaf_count: entry.safeDoneLeaves.length,
        ...(archivedCount !== undefined
          ? { archived_done_leaf_count: archivedCount }
          : {}),
        ...(rollupSummary ? { rollup_summary: rollupSummary } : {}),
        sample_done_leaf_ids: entry.safeDoneLeaves
          .sort((a, b) => a.id.localeCompare(b.id))
          .slice(0, 8)
          .map((task) => task.id),
      };
    })
    .sort(
      (a, b) =>
        b.safe_done_leaf_count - a.safe_done_leaf_count ||
        b.done_child_count - a.done_child_count ||
        a.parent_id.localeCompare(b.parent_id),
    )
    .slice(0, 8);

  if (compactionCandidates.length === 0 && protectedCount === 0)
    return undefined;

  return {
    safe_done_leaf_count: candidates.length,
    protected_done_leaf_count: protectedCount,
    compaction_candidates: compactionCandidates,
  };
}

function snapshotPlanningTask(
  tree: TaskTree,
  taskId: string,
  readinessReasons?: string[],
): TaskPlanningSnapshot | null {
  const task =
    tree.tasks[taskId] ??
    Object.values(tree.tasks).find((candidate) => candidate.id === taskId);
  if (!task) return null;
  const state = taskState(task);
  const blocker = (() => {
    if (typeof task.blocker === "string") return task.blocker.slice(0, 700);
    if (!task.blocker) return undefined;
    try {
      return JSON.stringify(task.blocker).slice(0, 700);
    } catch {
      return undefined;
    }
  })();
  return {
    id: task.id,
    parent_id: task.parent_id,
    state,
    status: state,
    kind: task.kind,
    priority: task.priority,
    owner: task.owner,
    workflow: task.workflow,
    session_id: task.session_id,
    goal: typeof task.goal === "string" ? task.goal.slice(0, 900) : undefined,
    outputs: normalizeStringArray(task.outputs).slice(0, 20),
    acceptance: normalizeStringArray(task.acceptance).slice(0, 20),
    conflict_scope: normalizeStringArray(task.conflict_scope).slice(0, 20),
    depends_on: normalizeStringArray(task.depends_on).slice(0, 20),
    blocker,
    readiness_reasons: readinessReasons?.slice(0, 6),
  };
}

function snapshotPlanningDetails(
  tree: TaskTree,
  ids: string[],
  readiness: Record<string, string[]>,
): TaskPlanningSnapshot[] {
  return ids.slice(0, 8).flatMap((taskId) => {
    const detail = snapshotPlanningTask(tree, taskId, readiness[taskId]);
    return detail ? [detail] : [];
  });
}

export function planningPacket(config: TaskTreeConfig): AksTaskPlanningPacket {
  let packet = sdkPlanningPacket(config) as AksTaskPlanningPacket;
  let tree = withTreeLock(config, () => readTaskTree(config));
  if (packet.updated_at !== tree.updated_at) {
    packet = sdkPlanningPacket(config) as AksTaskPlanningPacket;
    tree = withTreeLock(config, () => readTaskTree(config));
  }
  const snapshot = buildProjectSnapshotV2({
    projectId: "aks-rp-e2e",
    tree,
  });
  const conditionOwnedTaskIds = Object.values(tree.conditions ?? {})
    .flatMap((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value))
        return [];
      const condition = value as Record<string, unknown>;
      if (condition.status !== "open") return [];
      const subject =
        condition.subject &&
        typeof condition.subject === "object" &&
        !Array.isArray(condition.subject)
          ? (condition.subject as Record<string, unknown>)
          : {};
      const taskId =
        typeof subject.id === "string" && subject.id.trim()
          ? subject.id.trim()
          : "";
      const task = tree.tasks[taskId];
      return task &&
        taskState(task) === "blocked" &&
        taskRevision(task) === subject.revision &&
        task.context?.controlPlaneVersion === 2
        ? [taskId]
        : [];
    })
    .sort((left, right) => left.localeCompare(right));
  const suppression = appFrontierSuppression(tree, snapshot.frontier);
  const frontier = {
    runnable: snapshot.frontier.runnable.filter(
      (taskId) => !suppression.suppressedRunnableDurableLoops.has(taskId),
    ),
    waiting: snapshot.frontier.waiting,
    active: snapshot.frontier.active.filter(
      (taskId) => !suppression.suppressedActiveDurableLoops.has(taskId),
    ),
    review: snapshot.frontier.review.filter(
      (taskId) => !suppression.nonReviewableDurableLoops.has(taskId),
    ),
    blocked: snapshot.frontier.blocked,
  };
  packet.updated_at = snapshot.treeUpdatedAt ?? undefined;
  packet.total = snapshot.frontier.counts.total;
  packet.leaf_total = snapshot.frontier.counts.leafTotal;
  packet.roots = snapshot.frontier.roots;
  packet.active_task_ids = frontier.active;
  packet.counts = {
    ...packet.counts,
    runnable: frontier.runnable.length,
    waiting: frontier.waiting.length,
    active: frontier.active.length,
    review: frontier.review.length,
    blocked: frontier.blocked.length,
    backlog: snapshot.frontier.counts.backlog,
    done: snapshot.frontier.counts.done,
  };
  packet.frontier = frontier;
  packet.ready_path_frontier_materialization =
    readyPathFrontierMaterialization(config);
  if (conditionOwnedTaskIds.length > 0) {
    packet.condition_owned_task_ids = conditionOwnedTaskIds;
  } else {
    delete packet.condition_owned_task_ids;
  }
  const ownerActionableBlockedSummary = summarizeBlockedFrontier(
    tree,
    conditionOwnedTaskIds,
  );
  if (ownerActionableBlockedSummary) {
    packet.blocked_frontier_summary = ownerActionableBlockedSummary;
  } else {
    delete packet.blocked_frontier_summary;
  }
  packet.frontier_details = {
    runnable: snapshotPlanningDetails(
      tree,
      frontier.runnable,
      snapshot.frontier.readiness,
    ),
    waiting: snapshotPlanningDetails(
      tree,
      frontier.waiting,
      snapshot.frontier.readiness,
    ),
    active: snapshotPlanningDetails(tree, frontier.active, {}),
    review: snapshotPlanningDetails(tree, frontier.review, {}),
    blocked: snapshotPlanningDetails(tree, frontier.blocked, {}),
  };
  packet.project_snapshot = {
    version: snapshot.version,
    captured_at: snapshot.capturedAt,
    tree_updated_at: snapshot.treeUpdatedAt,
    frontier_counts: snapshot.frontier.counts,
  };
  const hygiene = taskTreeHygieneSummary(config);
  if (hygiene) packet.task_tree_hygiene = hygiene;
  else delete packet.task_tree_hygiene;
  const warnings = projectHygieneWarnings(config);
  if (warnings.length > 0) packet.project_hygiene_warnings = warnings;
  const blockedWarnings = blockedActionWarnings(config);
  const ownerActionableBlockedWarnings = blockedWarnings.filter(
    (warning) => !conditionOwnedTaskIds.includes(warning.taskId),
  );
  if (ownerActionableBlockedWarnings.length > 0)
    packet.blocked_action_warnings = ownerActionableBlockedWarnings;
  else delete packet.blocked_action_warnings;
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

function openTaskAlreadyCoversSignals(
  tree: TaskTree,
  signals: string[],
): boolean {
  const normalizedSignals = signals
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  if (normalizedSignals.length === 0) return false;
  return Object.values(tree.tasks).some((task) => {
    if (taskState(task) === "done") return false;
    const haystack = JSON.stringify({
      id: task.id,
      goal: task.goal,
      inputs: task.inputs,
      outputs: task.outputs,
      conflict_scope: task.conflict_scope,
      context: task.context,
      blocker: task.blocker,
    }).toLowerCase();
    return normalizedSignals.some((signal) => haystack.includes(signal));
  });
}

function openTaskAlreadyCoversPath(
  tree: TaskTree,
  path: KnowledgeFeaturePath,
  stem: string | null,
): boolean {
  return openTaskAlreadyCoversSignals(tree, [path.id, path.featureId, stem]);
}

function readyPathSummaryEntries(
  projectDir: string,
): Array<{ id: string; featureId?: string; specId?: string }> {
  const summary = readJsonFile<{ generatedAt?: unknown; paths?: unknown }>(
    join(projectDir, "model", "knowledge-map", "views", "path-summary.json"),
    {},
  );
  const paths = Array.isArray(summary.paths) ? summary.paths : [];
  return paths.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    if (record.status !== "ready") return [];
    const id = typeof record.id === "string" ? record.id.trim() : "";
    if (!id) return [];
    return [
      {
        id,
        featureId:
          typeof record.featureId === "string" && record.featureId.trim()
            ? record.featureId.trim()
            : undefined,
        specId:
          typeof record.specId === "string" && record.specId.trim()
            ? record.specId.trim()
            : undefined,
      },
    ];
  });
}

export function readyPathFrontierMaterialization(
  config: TaskTreeConfig,
): ReadyPathFrontierMaterialization {
  const readyPaths = readyPathSummaryEntries(config.projectDir);
  const summary = readJsonFile<{ generatedAt?: unknown }>(
    join(config.projectDir, "model", "knowledge-map", "views", "path-summary.json"),
    {},
  );
  if (readyPaths.length === 0) {
    return {
      status: "none",
      generated_at:
        typeof summary.generatedAt === "string" ? summary.generatedAt : undefined,
      ready_count: 0,
      represented_ready_path_ids: [],
      unrepresented_ready_path_ids: [],
    };
  }

  const tree = readTaskTree(config);
  const representedReadyPathIds: string[] = [];
  const unrepresentedReadyPathIds: string[] = [];
  for (const path of readyPaths) {
    const represented = openTaskAlreadyCoversSignals(tree, [
      path.id,
      path.featureId,
      path.specId,
    ]);
    (represented ? representedReadyPathIds : unrepresentedReadyPathIds).push(
      path.id,
    );
  }

  return {
    status: unrepresentedReadyPathIds.length === 0 ? "covered" : "gap",
    generated_at:
      typeof summary.generatedAt === "string" ? summary.generatedAt : undefined,
    ready_count: readyPaths.length,
    represented_ready_path_ids: representedReadyPathIds.sort((a, b) =>
      a.localeCompare(b),
    ),
    unrepresented_ready_path_ids: unrepresentedReadyPathIds.sort((a, b) =>
      a.localeCompare(b),
    ),
  };
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
    if (evidence.length === 0)
      throw new Error("Provide at least one evidence path");

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
