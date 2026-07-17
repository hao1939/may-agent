import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { ensureTaskTreeState, projectRuntimePaths } from "./project-runtime-state.js";
import {
  dependenciesSatisfied,
  isClearEnough,
  isLeaf,
  normalizeStringArray,
  readTaskTree,
  saveTaskTree,
  setTaskState,
  taskRevision,
  taskState,
  withTreeLock,
  type TaskTreeConfig,
  type TaskBlocker,
  type TaskNode,
  type TaskTree,
} from "./project-task-tree-store.js";

type ToolConfig = TaskTreeConfig;

export type TaskTreeToolConfig = {
  appDir: string;
  projectDir: string;
  worker: string;
  maxConcurrent: number;
};

export type TaskTreeSummary = {
  updated_at?: string;
  total: number;
  leaf_total: number;
  roots: string[];
  active_task_ids: string[];
  tree_counts: Record<string, number>;
  counts: Record<string, number>;
  frontier: {
    runnable: string[];
    waiting: string[];
    active: string[];
    review: string[];
    blocked: string[];
  };
};

export type TaskKanbanColumn = "backlog" | "in-progress" | "review" | "blocked" | "done";

export type TaskKanbanProjection = {
  total_cards: number;
  tree_total: number;
  tree_status_counts?: Record<string, number>;
  status_counts: Record<string, number>;
  column_counts: Record<TaskKanbanColumn, number>;
  card_ids_by_column: Record<TaskKanbanColumn, string[]>;
  escalated: number;
  settled_pct: number;
};

export type TaskKanbanState = {
  tree: TaskTree;
  kanban: TaskKanbanProjection;
};

export type TaskKanbanSnapshot = {
  version: 1;
  generated_at: string;
  tree_updated_at?: string;
  kanban: TaskKanbanProjection;
};

export type TaskPlanningSnapshot = {
  id: string;
  parent_id?: string | null;
  state: string;
  status: string;
  kind?: string;
  priority?: string;
  owner?: string;
  workflow?: string;
  session_id?: string;
  goal?: string;
  outputs: string[];
  acceptance: string[];
  conflict_scope: string[];
  depends_on: string[];
  blocker?: string;
  readiness_reasons?: string[];
  trace?: Record<string, unknown>;
};

export type ModelPathStatusEntry = {
  id: string;
  status: string;
  rootCauseClass?: string;
  label?: string;
  verdictFinal?: boolean;
  retestCondition?: string;
};

export type ModelStatusSummary = {
  total: number;
  passing: number;
  non_passing: number;
  non_passing_paths: ModelPathStatusEntry[];
};

export type TaskPlanningPacket = TaskTreeSummary & {
  frontier_details: {
    runnable: TaskPlanningSnapshot[];
    waiting: TaskPlanningSnapshot[];
    active: TaskPlanningSnapshot[];
    review: TaskPlanningSnapshot[];
    blocked: TaskPlanningSnapshot[];
  };
  blocked_frontier_summary?: TaskBlockedFrontierSummary;
  task_tree_hygiene?: TaskTreeHygieneSummary;
  model_status_summary?: ModelStatusSummary;
};

export type TaskTreeCompactionCandidate = {
  parent_id: string;
  child_count: number;
  open_child_count: number;
  done_child_count: number;
  safe_done_leaf_count: number;
  archived_done_leaf_count?: number;
  rollup_summary?: string;
  sample_done_leaf_ids: string[];
};

export type TaskTreeHygieneSummary = {
  safe_done_leaf_count: number;
  protected_done_leaf_count: number;
  compaction_candidates: TaskTreeCompactionCandidate[];
};

export type TaskBlockedParentGroup = {
  parent_id: string;
  parent_goal?: string;
  blocked_leaf_count: number;
  total_child_count: number;
  open_child_count: number;
  sample_blocked_leaf_ids: string[];
  sample_blockers: string[];
};

export type TaskBlockedSignatureGroup = {
  signature: string;
  blocked_leaf_count: number;
  parent_ids: string[];
  sample_blocked_leaf_ids: string[];
  sample_blocker?: string;
};

export type TaskBlockedFrontierSummary = {
  blocked_leaf_count: number;
  parent_groups: TaskBlockedParentGroup[];
  repeated_blocker_groups: TaskBlockedSignatureGroup[];
};

export type TaskCompletionClaim = "done" | "partial" | "blocked";

export type TaskAssignment = {
  taskId: string;
  taskRevision: number;
  attemptId: string;
  sessionId: string;
  worker: string;
  assignedAt: string;
};

export type RunnableBacklogAssignmentResult = {
  assignments: TaskAssignment[];
  skipped: Array<{ taskId: string; reason: string }>;
};

export type TaskTreeRepairResult = {
  changed: boolean;
  lifecycle?: string;
  active_task_ids: string[];
  repaired: Array<{ taskId: string; from: string; to: string }>;
};

export type TaskTreePruneMissingChildrenResult = {
  changed: boolean;
  parentId: string;
  removedChildIds: string[];
  remainingChildIds: string[];
  lifecycle?: string;
  active_task_ids: string[];
  repaired: Array<{ taskId: string; from: string; to: string }>;
};

export type TaskTreeCompactResult = {
  changed: boolean;
  archived: number;
  protected: number;
  archivePath?: string;
  archivePaths?: string[];
  remainingTotal: number;
  parentId?: string;
  archivedTaskIds?: string[];
};

export type RollupParentInput = {
  parentId: string;
  summary: string;
  taskIds?: string[];
  limit?: number;
  reason?: string;
};

export type CreateTaskInput = {
  id: string;
  parentId: string;
  initialRevision?: number;
  state?: "backlog" | "blocked";
  status?: "backlog" | "blocked";
  kind?: string;
  priority?: "P0" | "P1" | "P2" | "P3";
  owner?: string;
  workflow?: string;
  goal: string;
  inputs?: string[];
  outputs: string[];
  acceptance: string[];
  forbidden?: string[];
  conflict_scope?: string[];
  depends_on?: string[];
  context?: Record<string, unknown>;
  blocker?: string | TaskBlocker;
  blockerCategory?: string;
  blockerOwner?: string;
  resumeCondition?: string;
  resumeAt?: string;
  nextCheckAt?: string;
  fallbackAt?: string;
  fallbackAction?: string;
};

export type MarkTaskDoneInput = {
  taskId: string;
  taskRevision?: number;
  attemptId?: string;
  summary: string;
  resolution?: string;
};

export type UpdateTaskOutputsInput = {
  taskId: string;
  outputs: string[];
};

export type UpdateTaskTextInput = {
  taskId: string;
  goal?: string;
  acceptance?: string[];
  blocker?: string | TaskBlocker;
  blockerCategory?: string;
  blockerOwner?: string;
  resumeCondition?: string;
  resumeAt?: string;
  nextCheckAt?: string;
  fallbackAt?: string;
  fallbackAction?: string;
  clearBlocker?: boolean;
};

export type UnblockTaskInput = {
  taskId: string;
  reason: string;
  force?: boolean;
};

export type RejectTaskReviewInput = {
  taskId: string;
  taskRevision?: number;
  attemptId?: string;
  reason: string;
  freshSession?: boolean;
  review?: Record<string, unknown>;
};

function canonicalIntentValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalIntentValue);
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalIntentValue(entry)]),
  );
}

function sortedIntentStrings(value: unknown): string[] {
  return [...new Set(normalizeStringArray(value))].sort((left, right) => left.localeCompare(right));
}

function blockerIntent(blocker: TaskBlocker | undefined): unknown {
  if (typeof blocker === "string") return blocker.trim();
  if (!blocker || typeof blocker !== "object") return null;
  return {
    condition: blocker.condition,
    category: blocker.category,
    owner: blocker.owner,
    resume_condition: blocker.resume_condition ?? blocker.resumeCondition,
    waiting_for: blocker.waiting_for ?? blocker.waitingFor,
    fallback_action: blocker.fallback_action ?? blocker.fallbackAction,
  };
}

export function taskIntentFingerprint(task: TaskNode): string {
  const intent = canonicalIntentValue({
    goal: task.goal?.trim() ?? "",
    workflow: task.workflow?.trim() ?? "",
    inputs: sortedIntentStrings(task.inputs),
    outputs: sortedIntentStrings(task.outputs),
    acceptance: sortedIntentStrings(task.acceptance),
    forbidden: sortedIntentStrings(task.forbidden),
    depends_on: sortedIntentStrings(task.depends_on),
    conflict_scope: sortedIntentStrings(task.conflict_scope),
    blocker: blockerIntent(task.blocker),
  });
  return createHash("sha256").update(JSON.stringify(intent)).digest("hex");
}

function bumpRevisionForIntentChange(task: TaskNode, previousFingerprint: string): boolean {
  if (taskIntentFingerprint(task) === previousFingerprint) return false;
  task.revision = taskRevision(task) + 1;
  return true;
}

function assertTaskCorrelation(
  task: TaskNode,
  input: { taskRevision?: number; attemptId?: string },
  operation: string,
): void {
  const currentRevision = taskRevision(task);
  if (input.taskRevision !== undefined && input.taskRevision !== currentRevision) {
    throw new Error(`Task ${task.id} revision ${input.taskRevision} is stale; current revision is ${currentRevision}`);
  }
  if (currentRevision > 0 && input.taskRevision === undefined) {
    throw new Error(`${operation} for task ${task.id} requires taskRevision ${currentRevision}`);
  }
  const currentAttemptId =
    typeof task.trace?.current_attempt_id === "string" ? task.trace.current_attempt_id : undefined;
  if (input.attemptId && currentAttemptId && input.attemptId !== currentAttemptId) {
    throw new Error(`Task ${task.id} attempt ${input.attemptId} is stale; current attempt is ${currentAttemptId}`);
  }
  if (currentRevision > 0 && currentAttemptId && !input.attemptId) {
    throw new Error(`${operation} for task ${task.id} requires attemptId ${currentAttemptId}`);
  }
}

export function taskTreeConfig(input: TaskTreeToolConfig): ToolConfig {
  const runtimePaths = projectRuntimePaths(input.appDir);
  return {
    appDir: input.appDir,
    projectDir: input.projectDir,
    treePath: ensureTaskTreeState(input.appDir).path,
    journalPath: runtimePaths.journalPath,
    worker: input.worker,
    maxConcurrent: input.maxConcurrent,
  };
}

export function appendToolJournal(config: ToolConfig, entry: Record<string, unknown>): void {
  mkdirSync(dirname(config.journalPath), { recursive: true });
  appendFileSync(
    config.journalPath,
    `${JSON.stringify({
      ts: new Date().toISOString(),
      actor: "task-tree-tool",
      ...entry,
    })}\n`,
  );
}

function priorityRank(priority?: string): number {
  return ({ P0: 0, P1: 1, P2: 2, P3: 3 } as const)[priority as "P0" | "P1" | "P2" | "P3"] ?? 3;
}

function taskSort(a: TaskNode, b: TaskNode): number {
  return priorityRank(a.priority) - priorityRank(b.priority) || a.id.localeCompare(b.id);
}

function taskEscalation(task: TaskNode): Record<string, unknown> | null {
  const escalation = (task as { escalation?: unknown }).escalation;
  return escalation && typeof escalation === "object" && !Array.isArray(escalation)
    ? (escalation as Record<string, unknown>)
    : null;
}

function hasOpenEscalation(task: TaskNode): boolean {
  const state = taskEscalation(task)?.state;
  return typeof state === "string" && ["open", "routed", "waiting_human"].includes(state);
}

function hasClosedGate(task: TaskNode): boolean {
  const gates = normalizeStringArray((task as { gates?: unknown }).gates);
  const gateStatus = (task as { gate_status?: unknown }).gate_status;
  return gates.length > 0 && gateStatus !== "satisfied";
}

function isPlanningTask(task: TaskNode): boolean {
  return task.kind === "frontier_replan" || task.kind === "domain_planner" || task.kind === "loop_task";
}

function isReviewTask(task: TaskNode): boolean {
  const id = task.id || "";
  return (
    task.kind === "blocked_review" ||
    task.kind === "parent_review" ||
    task.kind === "rework_review" ||
    id === "blocked-frontier-review" ||
    id.endsWith("-blocker-review") ||
    id.endsWith("-rollup-review") ||
    id.endsWith("-rework-review")
  );
}

function hasExternalBlockSignal(task: TaskNode): boolean {
  if (taskState(task) !== "blocked") return false;
  const record = task as {
    blocked?: unknown;
    blocker_type?: unknown;
    blocked_by?: unknown;
    gates?: unknown;
  };
  if (task.kind === "human_question") return true;
  if (hasClosedGate(task) || normalizeStringArray(record.gates).length > 0) return true;
  if (isReviewTask(task) || isPlanningTask(task)) return false;
  if (task.owner === "human") return true;
  if (
    task.verification &&
    typeof task.verification === "object" &&
    !Array.isArray(task.verification) &&
    (task.verification as { verdict?: unknown }).verdict === "rejected"
  )
    return false;
  if (
    /validation|validator|check failed|failed required|not executable|no-work|waiting claims are not terminal/i.test(
      blockerText(task.blocker) || "",
    )
  )
    return false;
  if (record.blocked === true) return true;
  if (record.blocker_type === "external") return true;
  if (record.blocked_by === "human") return true;
  const text = [task.goal, blockerText(task.blocker), ...normalizeStringArray(record.gates)].filter(Boolean).join("\n");
  return /(?:external|credential|auth|token|azure cli|\baz\b|owner|capacity|quota|rollout|environment|precondition|human|input|approval|unsafe|safety|not installed|unavailable|source signal|subscription|msi|hcp|staging)/i.test(
    text,
  );
}

export function taskKanbanColumn(task: TaskNode): TaskKanbanColumn | null {
  const state = taskState(task);
  if (state === "backlog") return "backlog";
  if (state === "active") return "in-progress";
  if (state === "review") return "review";
  if (state === "blocked") return hasExternalBlockSignal(task) ? "blocked" : "review";
  if (state === "done") return "done";
  return null;
}

function emptyKanbanColumns(): Record<TaskKanbanColumn, string[]> {
  return {
    backlog: [],
    "in-progress": [],
    review: [],
    blocked: [],
    done: [],
  };
}

function summarizeKanbanLoadedTree(tree: TaskTree): TaskKanbanProjection {
  const tasks = Object.values(tree.tasks ?? {});
  const treeStatusCounts: Record<string, number> = {};
  for (const task of tasks) {
    const state = taskState(task);
    treeStatusCounts[state] = (treeStatusCounts[state] ?? 0) + 1;
  }
  const cardIdsByColumn = emptyKanbanColumns();
  const cardTasks = tasks.filter((task) => task.id !== tree.root_task_id && isLeaf(task)).sort(taskSort);
  const statusCounts: Record<string, number> = {};
  for (const task of cardTasks) {
    const state = taskState(task);
    statusCounts[state] = (statusCounts[state] ?? 0) + 1;
    const column = taskKanbanColumn(task);
    if (column) cardIdsByColumn[column].push(task.id);
  }
  const columnCounts = Object.fromEntries(
    Object.entries(cardIdsByColumn).map(([column, ids]) => [column, ids.length]),
  ) as Record<TaskKanbanColumn, number>;
  const totalCards = Object.values(columnCounts).reduce((sum, count) => sum + count, 0);
  const settled = columnCounts.done + columnCounts.blocked;
  return {
    total_cards: totalCards,
    tree_total: tasks.length,
    tree_status_counts: treeStatusCounts,
    status_counts: statusCounts,
    column_counts: columnCounts,
    card_ids_by_column: cardIdsByColumn,
    escalated: tasks.filter((task) => isLeaf(task) && hasOpenEscalation(task)).length,
    settled_pct: totalCards ? Math.round((settled / totalCards) * 100) : 0,
  };
}

function kanbanSnapshotPath(config: ToolConfig): string {
  return projectRuntimePaths(config.appDir).kanbanPath;
}

function writeKanbanSnapshotForTree(config: ToolConfig, tree: TaskTree): TaskKanbanSnapshot {
  const snapshot: TaskKanbanSnapshot = {
    version: 1,
    generated_at: new Date().toISOString(),
    tree_updated_at: tree.updated_at,
    kanban: summarizeKanbanLoadedTree(tree),
  };
  const path = kanbanSnapshotPath(config);
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
  renameSync(tempPath, path);
  return snapshot;
}

export function saveTaskTreeWithKanbanSnapshot(config: ToolConfig, tree: TaskTree): TaskKanbanSnapshot {
  saveTaskTree(config, tree);
  return writeKanbanSnapshotForTree(config, tree);
}

function activeIds(tree: TaskTree): string[] {
  return Object.values(tree.tasks)
    .filter((task) => taskState(task) === "active" && (isLeaf(task) || isAssignedWorkflowController(task)))
    .sort(taskSort)
    .map((task) => task.id);
}

function openLeafIds(tree: TaskTree): string[] {
  return Object.values(tree.tasks)
    .filter((task) => isLeaf(task) && taskState(task) !== "done")
    .sort(taskSort)
    .map((task) => task.id);
}

function blockedOnlyWorkflowWaitStewardship(tree: TaskTree, task: TaskNode): boolean {
  if (!isWorkflowControllerTask(task)) return false;
  const progress = contextObject(task).workflowProgress;
  if (!progress || typeof progress !== "object" || Array.isArray(progress)) {
    return false;
  }
  const record = progress as Record<string, unknown>;
  const blockedWaitChildren = progressNumber(record, "blockedWaitChildren") ?? 0;
  const unrepresentedNonTerminalCount = progressNumber(record, "unrepresentedNonTerminalCount");
  if (blockedWaitChildren <= 0 || unrepresentedNonTerminalCount !== 0) {
    return false;
  }

  const childStates = normalizeStringArray(task.children)
    .map((id) => taskState(tree.tasks[id]))
    .filter((state): state is string => Boolean(state));
  return (
    childStates.length > 0 &&
    childStates.every((state) => state === "blocked" || state === "done") &&
    childStates.some((state) => state === "blocked")
  );
}

function rolledUpParentState(tree: TaskTree, task: TaskNode): string {
  const childStates = normalizeStringArray(task.children)
    .map((id) => taskState(tree.tasks[id]))
    .filter((state): state is string => Boolean(state));
  if (!childStates.length) return taskState(task);
  if (workflowProgressIncomplete(task)) {
    if (isAssignedWorkflowController(task)) return "active";
    if (childStates.includes("active")) return "active";
    if (childStates.includes("review")) return "review";
    if (blockedOnlyWorkflowWaitStewardship(tree, task)) {
      return "blocked";
    }
    return "backlog";
  }
  if (childStates.includes("active")) return "active";
  if (childStates.includes("review")) return "review";
  if (childStates.includes("blocked")) return "blocked";
  if (childStates.includes("backlog")) return "backlog";
  return "done";
}

function workflowProgressIncomplete(task: TaskNode): boolean {
  const context =
    task.context && typeof task.context === "object" && !Array.isArray(task.context)
      ? (task.context as Record<string, unknown>)
      : {};
  const progress = context.workflowProgress;
  if (!progress || typeof progress !== "object" || Array.isArray(progress)) return false;
  return (progress as Record<string, unknown>).completionReady === false;
}

function isWorkflowControllerTask(task: TaskNode): boolean {
  return (
    !isLeaf(task) &&
    typeof task.workflow === "string" &&
    task.workflow.trim().length > 0 &&
    workflowProgressIncomplete(task)
  );
}

function isAssignedWorkflowController(task: TaskNode): boolean {
  if (!isWorkflowControllerTask(task)) return false;
  const trace =
    task.trace && typeof task.trace === "object" && !Array.isArray(task.trace)
      ? (task.trace as Record<string, unknown>)
      : {};
  return typeof trace.current_attempt_id === "string" && trace.current_attempt_id.length > 0;
}

function reviewResultForChildren(tree: TaskTree, task: TaskNode): string {
  const reviewIds = normalizeStringArray(task.children).filter((id) => taskState(tree.tasks[id]) === "review");
  return `Child review pending: ${reviewIds.join(", ") || "review work"}.`;
}

function blockedConditionForChildren(tree: TaskTree, task: TaskNode): string {
  const blockedIds = normalizeStringArray(task.children).filter((id) => taskState(tree.tasks[id]) === "blocked");
  return `Child blocked: ${blockedIds.join(", ") || "blocked work"}.`;
}

function childBlockedIds(tree: TaskTree, task: TaskNode): string[] {
  return normalizeStringArray(task.children).filter((id) => taskState(tree.tasks[id]) === "blocked");
}

function hasBlockerCondition(task: TaskNode): boolean {
  const blocker = task.blocker;
  if (typeof blocker === "string") return blocker.trim().length > 0;
  return Boolean(blocker?.condition?.trim());
}

function isoPlusMinutes(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}

function isoPlusHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * 3_600_000).toISOString();
}

function childBlockedContract(tree: TaskTree, task: TaskNode): Exclude<TaskBlocker, string> {
  const now = new Date().toISOString();
  return {
    condition: blockedConditionForChildren(tree, task),
    category: "child-blocked",
    owner: task.owner,
    blocked_at: now,
    waiting_for: {
      type: "child.task.blocked",
      taskId: task.id,
      childTaskIds: childBlockedIds(tree, task),
    },
    observed_by: {
      workflow: task.workflow ?? "task-tree-rollup",
      trigger: "task_tree_rollup_repaired",
    },
    observation_method:
      "Task-tree rollup recomputes parent state from current child states; keep this blocked steward only while one or more child tasks remain blocked.",
    next_check_at: isoPlusMinutes(now, 10),
    resume_condition: "Resume when the blocked child task is resolved or replaced.",
    fallback_at: isoPlusHours(now, 24),
    fallback_action:
      "If child-blocked stewardship still holds at fallback time, rerun task-tree rollup/owner review and refresh the blocker metadata or reopen a concrete child follow-up.",
  };
}

function computeTaskTreeRollupHints(tree: TaskTree): TaskTreeRepairResult {
  const repaired: TaskTreeRepairResult["repaired"] = [];
  const visit = (taskId: string): void => {
    const task = tree.tasks[taskId];
    if (!task) return;
    for (const childId of normalizeStringArray(task.children)) visit(childId);
    if (!normalizeStringArray(task.children).length) return;
    const nextState = rolledUpParentState(tree, task);
    const currentState = taskState(task);
    if (currentState !== nextState) {
      repaired.push({
        taskId: task.id,
        from: currentState,
        to: nextState,
      });
    }
  };
  if (tree.root_task_id) visit(tree.root_task_id);

  const nextActiveIds = activeIds(tree);
  const nextLifecycle = openLeafIds(tree).length > 0 ? "active" : "closed";
  const changed =
    repaired.length > 0 ||
    tree.project_lifecycle !== nextLifecycle ||
    JSON.stringify(tree.active_task_ids ?? []) !== JSON.stringify(nextActiveIds) ||
    (tree.active_task_id ?? null) !== (nextActiveIds[0] ?? null);
  return {
    changed,
    lifecycle: nextLifecycle,
    active_task_ids: nextActiveIds,
    repaired,
  };
}

export function repairTaskTreeRollups(config: ToolConfig): TaskTreeRepairResult {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    return computeTaskTreeRollupHints(tree);
  });
}

export function pruneMissingChildren(
  config: ToolConfig,
  input: { parentId: string },
): TaskTreePruneMissingChildrenResult {
  const parentId = input.parentId.trim();
  if (!parentId) throw new Error("Parent id cannot be empty");
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const parent = tree.tasks[parentId];
    if (!parent) throw new Error(`Parent task not found: ${parentId}`);

    const beforeChildren = normalizeStringArray(parent.children);
    const remainingChildIds = beforeChildren.filter((childId) => Boolean(tree.tasks[childId]));
    const removedChildIds = beforeChildren.filter((childId) => !tree.tasks[childId]);

    parent.children = remainingChildIds;
    const result = computeTaskTreeRollupHints(tree);
    if (!removedChildIds.length) {
      return {
        changed: false,
        parentId: parent.id,
        removedChildIds,
        remainingChildIds,
        lifecycle: result.lifecycle,
        active_task_ids: result.active_task_ids,
        repaired: result.repaired,
      };
    }

    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_tree_missing_children_pruned",
      parent_id: parent.id,
      removed_child_ids: removedChildIds,
      remaining_child_ids: remainingChildIds,
      lifecycle: result.lifecycle,
      active_task_ids: result.active_task_ids,
      rollup_hints: result.repaired,
    });
    return {
      changed: removedChildIds.length > 0,
      parentId: parent.id,
      removedChildIds,
      remainingChildIds,
      lifecycle: result.lifecycle,
      active_task_ids: result.active_task_ids,
      repaired: result.repaired,
    };
  });
}

function compactArchiveStamp(): string {
  return new Date().toISOString().replace(/\D/g, "").slice(0, 17);
}

function contextObject(task: TaskNode): Record<string, unknown> {
  return task.context && typeof task.context === "object" && !Array.isArray(task.context) ? task.context : {};
}

function dependencyReferences(tree: TaskTree): Set<string> {
  return new Set(Object.values(tree.tasks).flatMap((task) => normalizeStringArray(task.depends_on)));
}

function taskDepth(tree: TaskTree, task: TaskNode): number {
  let depth = 0;
  let current: TaskNode | undefined = task;
  const seen = new Set<string>();
  while (current?.parent_id && tree.tasks[current.parent_id] && !seen.has(current.id)) {
    seen.add(current.id);
    depth++;
    current = tree.tasks[current.parent_id];
  }
  return depth;
}

function isDurableLoopRetirementProtected(task: TaskNode | undefined): boolean {
  if (!task) return false;
  const acceptance = normalizeStringArray(task.acceptance).map((value) => value.toLowerCase());
  return acceptance.some((value) => value.includes("loop remains present until explicitly retired"));
}

function isSafeDoneLeaf(tree: TaskTree, task: TaskNode | undefined, dependencyRefs: Set<string>): task is TaskNode {
  return Boolean(
    task &&
    task.id !== tree.root_task_id &&
    isLeaf(task) &&
    taskState(task) === "done" &&
    !dependencyRefs.has(task.id) &&
    !isDurableLoopRetirementProtected(task),
  );
}

function writeCompactArchive(input: {
  config: ToolConfig;
  reason: string;
  tasks: TaskNode[];
  parentId?: string;
  summary?: string;
}): string {
  const runtimePaths = projectRuntimePaths(input.config.appDir);
  const archiveDir = runtimePaths.taskArchiveDir;
  const archiveStamp = compactArchiveStamp();
  let archiveRelPath = join(".state", "tasks", "archive", `done-leaves-${archiveStamp}.json`);
  let archivePath = join(input.config.appDir, archiveRelPath);
  let attempt = 1;
  while (existsSync(archivePath)) {
    archiveRelPath = join(".state", "tasks", "archive", `done-leaves-${archiveStamp}-${attempt}.json`);
    archivePath = join(input.config.appDir, archiveRelPath);
    attempt++;
  }
  mkdirSync(archiveDir, { recursive: true });
  writeFileSync(
    archivePath,
    `${JSON.stringify(
      {
        version: 1,
        generated_at: new Date().toISOString(),
        reason: input.reason,
        parent_id: input.parentId,
        summary: input.summary,
        archived: input.tasks.length,
        tasks: input.tasks,
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
  return archiveRelPath;
}

function recordParentArchive(input: {
  parent: TaskNode;
  archiveRelPath: string;
  count: number;
  summary?: string;
  reason?: string;
  taskIds?: string[];
  now: string;
}): void {
  const context = contextObject(input.parent);
  const existingCount = typeof context.archived_done_leaf_count === "number" ? context.archived_done_leaf_count : 0;
  const existingArchives = Array.isArray(context.rollup_archives) ? context.rollup_archives : [];
  input.parent.context = {
    ...context,
    ...(input.summary ? { rollup_summary: input.summary } : {}),
    archived_done_leaf_count: existingCount + input.count,
    rollup_archives: [
      {
        archive: input.archiveRelPath,
        archived: input.count,
        at: input.now,
        ...(input.summary ? { summary: input.summary } : {}),
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.taskIds ? { task_ids: input.taskIds } : {}),
      },
      ...existingArchives,
    ].slice(0, 5),
  };
  input.parent.trace = {
    ...(input.parent.trace ?? {}),
    rolled_up_at: input.now,
    rolled_up_by: "task-tree-tool",
  };
}

export function rollupParent(config: ToolConfig, input: RollupParentInput): TaskTreeCompactResult {
  const summary = input.summary.trim();
  if (!summary) throw new Error("Rollup summary cannot be empty");
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const parent = tree.tasks[input.parentId];
    if (!parent) throw new Error(`Parent task not found: ${input.parentId}`);

    const childIds = normalizeStringArray(parent.children);
    const dependencyRefs = dependencyReferences(tree);
    const requestedIds = [...new Set(input.taskIds ?? [])];
    const selectedIds = requestedIds.length
      ? requestedIds
      : childIds
          .filter((childId) => {
            const task = tree.tasks[childId];
            return task && isLeaf(task) && taskState(task) === "done" && !dependencyRefs.has(task.id);
          })
          .slice(0, Math.max(0, input.limit ?? 200));

    const selected: TaskNode[] = [];
    const protectedCount = childIds.filter((childId) => {
      const task = tree.tasks[childId];
      return task && isLeaf(task) && taskState(task) === "done" && dependencyRefs.has(task.id);
    }).length;

    for (const taskId of selectedIds) {
      const task = tree.tasks[taskId];
      if (!task) throw new Error(`Task not found: ${taskId}`);
      if (task.parent_id !== parent.id) throw new Error(`Task ${taskId} is not a child of ${parent.id}`);
      if (!isLeaf(task)) throw new Error(`Task ${taskId} is not a leaf`);
      const state = taskState(task);
      if (state !== "done") throw new Error(`Task ${taskId} is ${state}, not done`);
      if (dependencyRefs.has(task.id)) throw new Error(`Task ${taskId} is still referenced by a dependency`);
      selected.push(task);
    }

    if (selected.length === 0) {
      const now = new Date().toISOString();
      const context = contextObject(parent);
      parent.context = {
        ...context,
        rollup_summary: summary,
      };
      parent.trace = {
        ...(parent.trace ?? {}),
        rolled_up_at: now,
        rolled_up_by: "task-tree-tool",
      };
      saveTaskTreeWithKanbanSnapshot(config, tree);
      appendToolJournal(config, {
        kind: "task_tree_parent_rolled_up",
        parent_id: parent.id,
        archived: 0,
        summary,
        reason: input.reason,
      });
      return {
        changed: true,
        archived: 0,
        protected: protectedCount,
        parentId: parent.id,
        archivedTaskIds: [],
        remainingTotal: Object.keys(tree.tasks).length,
      };
    }

    const archiveRelPath = writeCompactArchive({
      config,
      reason: input.reason ?? "owner rolled up completed child tasks",
      parentId: parent.id,
      summary,
      tasks: selected,
    });
    const selectedIdSet = new Set(selected.map((task) => task.id));
    parent.children = childIds.filter((childId) => !selectedIdSet.has(childId));
    for (const task of selected) delete tree.tasks[task.id];

    const now = new Date().toISOString();
    recordParentArchive({
      parent,
      archiveRelPath,
      count: selected.length,
      summary,
      reason: input.reason,
      taskIds: selected.map((task) => task.id),
      now,
    });

    const repair = computeTaskTreeRollupHints(tree);
    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_tree_parent_rolled_up",
      parent_id: parent.id,
      archive: archiveRelPath,
      archived: selected.length,
      protected: protectedCount,
      archived_task_ids: selected.map((task) => task.id),
      rollup_hints: repair.repaired,
      summary,
      reason: input.reason,
    });
    return {
      changed: true,
      archived: selected.length,
      protected: protectedCount,
      parentId: parent.id,
      archivedTaskIds: selected.map((task) => task.id),
      archivePath: archiveRelPath,
      remainingTotal: Object.keys(tree.tasks).length,
    };
  });
}

export function compactDoneLeaves(
  config: ToolConfig,
  input: { limit?: number; reason?: string } = {},
): TaskTreeCompactResult {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const limit = Math.max(0, input.limit ?? 200);
    const archivedTaskIds: string[] = [];
    const archivePaths: string[] = [];
    let protectedCount = 0;
    let preferredNextTaskId: string | undefined;

    while (archivedTaskIds.length < limit) {
      const dependencyRefs = dependencyReferences(tree);
      const candidates = Object.values(tree.tasks).filter((task) => isSafeDoneLeaf(tree, task, dependencyRefs));
      protectedCount = Object.values(tree.tasks).filter(
        (task) =>
          task.id !== tree.root_task_id && isLeaf(task) && taskState(task) === "done" && dependencyRefs.has(task.id),
      ).length;

      if (candidates.length === 0) break;

      const preferred = isSafeDoneLeaf(tree, tree.tasks[preferredNextTaskId ?? ""], dependencyRefs)
        ? tree.tasks[preferredNextTaskId ?? ""]
        : undefined;
      const chosen =
        preferred ?? candidates.sort((a, b) => taskDepth(tree, b) - taskDepth(tree, a) || taskSort(a, b))[0];
      const chosenDepth = taskDepth(tree, chosen);
      const selected = preferred
        ? [preferred]
        : candidates
            .filter((task) => task.parent_id === chosen.parent_id && taskDepth(tree, task) === chosenDepth)
            .sort(taskSort)
            .slice(0, limit - archivedTaskIds.length);
      if (selected.length === 0) break;

      const archiveRelPath = writeCompactArchive({
        config,
        reason: input.reason ?? "compact done task leaves",
        parentId: selected.every((task) => task.parent_id === selected[0]?.parent_id)
          ? (selected[0]?.parent_id ?? undefined)
          : undefined,
        tasks: selected,
      });
      archivePaths.push(archiveRelPath);

      const parentCounts = new Map<string, number>();
      const parentTaskIds = new Map<string, string[]>();
      for (const task of selected) {
        const parentId = task.parent_id ?? "";
        const parent = parentId ? tree.tasks[parentId] : undefined;
        if (parent) {
          parent.children = normalizeStringArray(parent.children).filter((childId) => childId !== task.id);
          parentCounts.set(parent.id, (parentCounts.get(parent.id) ?? 0) + 1);
          parentTaskIds.set(parent.id, [...(parentTaskIds.get(parent.id) ?? []), task.id]);
        }
        delete tree.tasks[task.id];
        archivedTaskIds.push(task.id);
      }

      const now = new Date().toISOString();
      for (const [parentId, count] of parentCounts) {
        const parent = tree.tasks[parentId];
        if (!parent) continue;
        recordParentArchive({
          parent,
          archiveRelPath,
          count,
          reason: input.reason,
          taskIds: parentTaskIds.get(parentId),
          now,
        });
      }

      computeTaskTreeRollupHints(tree);
      const parentId = selected.length > 0 ? selected[0].parent_id : undefined;
      const parent = parentId ? tree.tasks[parentId] : undefined;
      const nextDependencyRefs = dependencyReferences(tree);
      preferredNextTaskId = isSafeDoneLeaf(tree, parent, nextDependencyRefs) ? parent.id : undefined;
    }

    if (archivedTaskIds.length === 0) {
      return {
        changed: false,
        archived: 0,
        protected: protectedCount,
        remainingTotal: Object.keys(tree.tasks).length,
      };
    }

    const repair = computeTaskTreeRollupHints(tree);
    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_tree_done_leaves_compacted",
      archive: archivePaths[archivePaths.length - 1],
      archives: archivePaths,
      archived: archivedTaskIds.length,
      protected: protectedCount,
      rollup_hints: repair.repaired,
      reason: input.reason,
    });
    return {
      changed: true,
      archived: archivedTaskIds.length,
      protected: protectedCount,
      archivedTaskIds,
      archivePath: archivePaths[archivePaths.length - 1],
      archivePaths,
      remainingTotal: Object.keys(tree.tasks).length,
    };
  });
}

function frontierIds(tree: TaskTree, status: string): string[] {
  return Object.values(tree.tasks)
    .filter((task) => taskState(task) === status && (isLeaf(task) || isWorkflowControllerTask(task)))
    .sort(taskSort)
    .slice(0, 20)
    .map((task) => task.id);
}

function isWorkerExecutableBacklogLeaf(task: TaskNode): boolean {
  if (!isLeaf(task)) return false;
  if (taskState(task) !== "backlog") return false;
  if (isPlanningTask(task)) return false;
  if (
    task.kind === "work" ||
    task.kind === "focus_plan" ||
    task.kind === "durable_lane" ||
    task.kind === "standing_task"
  ) {
    return false;
  }
  if (isWorkflowControllerTask(task) && controllerRefillPaused(task)) return false;
  return true;
}

function progressNumber(progress: Record<string, unknown>, key: string): number | undefined {
  const value = progress[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function controllerRefillPaused(task: TaskNode): boolean {
  if (!isWorkflowControllerTask(task)) return false;
  const progress = contextObject(task).workflowProgress;
  if (!progress || typeof progress !== "object" || Array.isArray(progress)) {
    return false;
  }
  const record = progress as Record<string, unknown>;
  if (record.noRefillNow === true) return true;
  if (record.strandedExhaustedResidueOnly === true) return true;
  if (record.holdMode === "dormant-backlog-preserved") return true;

  const openChildren = progressNumber(record, "openChildren") ?? 0;
  const openFollowups = progressNumber(record, "openFollowups") ?? 0;
  const pending = progressNumber(record, "pending") ?? 0;
  const running = progressNumber(record, "running") ?? 0;
  const error = progressNumber(record, "error") ?? 0;
  const retryBudgetExhausted = progressNumber(record, "retryBudgetExhausted");

  if (record.backendBlocked === true && openChildren === 0 && openFollowups === 0 && running === 0) {
    return true;
  }

  if (pending === 0 && running === 0 && openChildren === 0 && error > 0 && retryBudgetExhausted === error) {
    return true;
  }

  return false;
}

function isWorkerExecutableController(task: TaskNode): boolean {
  if (!isWorkflowControllerTask(task)) return false;
  if (taskState(task) !== "backlog") return false;
  if (isPlanningTask(task)) return false;
  if (controllerRefillPaused(task)) return false;
  return true;
}

function isRunnableBacklogLeaf(tree: TaskTree, task: TaskNode): boolean {
  if (!isWorkerExecutableBacklogLeaf(task) && !isWorkerExecutableController(task)) return false;
  if (!isClearEnough(task)) return false;
  if (!dependenciesSatisfied(tree, task)) return false;
  return !activeLeaves(tree).some((active) => conflictScopesOverlap(active, task));
}

function waitingBacklogReasons(tree: TaskTree, task: TaskNode): string[] {
  const reasons: string[] = [];
  if (!isClearEnough(task)) reasons.push("missing goal, acceptance, or output");

  for (const dependencyId of normalizeStringArray(task.depends_on)) {
    const dependency = tree.tasks[dependencyId];
    if (!dependency) {
      reasons.push(`depends_on '${dependencyId}' is missing`);
    } else if (taskState(dependency) !== "done") {
      reasons.push(`depends_on '${dependencyId}' is ${taskState(dependency)}, not done`);
    }
  }

  const conflicts = activeLeaves(tree)
    .filter((active) => active.id !== task.id && conflictScopesOverlap(active, task))
    .map((active) => active.id);
  if (conflicts.length > 0) reasons.push(`conflicts with active task(s): ${conflicts.join(", ")}`);

  return reasons;
}

function frontierAssignableIds(tree: TaskTree): string[] {
  return Object.values(tree.tasks)
    .filter((task) => isRunnableBacklogLeaf(tree, task))
    .sort(taskSort)
    .slice(0, 20)
    .map((task) => task.id);
}

function truncate(value: string | undefined, max = 900): string | undefined {
  if (!value) return value;
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

type TaskBlockerInput = {
  blocker?: string | TaskBlocker;
  blockerCategory?: string;
  blockerOwner?: string;
  resumeCondition?: string;
  resumeAt?: string;
  nextCheckAt?: string;
  fallbackAt?: string;
  fallbackAction?: string;
};

function trimmed(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}

function blockerRecord(value: TaskBlocker | undefined): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function blockerTextField(blocker: TaskBlocker | undefined, ...keys: string[]): string | undefined {
  const record = blockerRecord(blocker);
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string") {
      const text = trimmed(value);
      if (text) return text;
    }
  }
  return undefined;
}

function blockerObjectField(blocker: TaskBlocker | undefined, ...keys: string[]): Record<string, unknown> | undefined {
  const record = blockerRecord(blocker);
  for (const key of keys) {
    const value = record?.[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return undefined;
}

function hasStructuredBlockerInput(input: TaskBlockerInput): boolean {
  return Boolean(
    blockerRecord(input.blocker) ||
    trimmed(input.blockerCategory) ||
    trimmed(input.blockerOwner) ||
    trimmed(input.resumeCondition) ||
    trimmed(input.resumeAt) ||
    trimmed(input.nextCheckAt) ||
    trimmed(input.fallbackAt) ||
    trimmed(input.fallbackAction),
  );
}

function blockerCondition(blocker: TaskBlocker | undefined): string | undefined {
  if (typeof blocker === "string") return trimmed(blocker);
  return blockerTextField(blocker, "condition");
}

function sanitizeStructuredBlockerPatch(inputRecord: Record<string, unknown>): Record<string, unknown> {
  const patch = { ...inputRecord };
  const waitingFor = blockerObjectField(patch, "waiting_for", "waitingFor");
  if (("waiting_for" in patch || "waitingFor" in patch) && !waitingFor) {
    delete patch.waiting_for;
    delete patch.waitingFor;
  }
  const observedBy = blockerObjectField(patch, "observed_by", "observedBy");
  if (("observed_by" in patch || "observedBy" in patch) && !observedBy) {
    delete patch.observed_by;
    delete patch.observedBy;
  }
  return patch;
}

function buildBlocker(input: TaskBlockerInput): TaskBlocker | undefined {
  const blockerValue = input.blocker;
  if (!hasStructuredBlockerInput(input)) {
    return typeof blockerValue === "string" ? trimmed(blockerValue) : blockerValue;
  }

  const existingRecord = sanitizeStructuredBlockerPatch(blockerRecord(blockerValue) ?? {});
  const condition = typeof blockerValue === "string" ? trimmed(blockerValue) : blockerCondition(blockerValue);

  const nextCheckAt = trimmed(input.nextCheckAt);
  const resumeAt = trimmed(input.resumeAt) ?? nextCheckAt;

  return {
    ...existingRecord,
    ...(condition ? { condition } : {}),
    ...(trimmed(input.blockerCategory) ? { category: trimmed(input.blockerCategory) } : {}),
    ...(trimmed(input.blockerOwner) ? { owner: trimmed(input.blockerOwner) } : {}),
    ...(trimmed(input.resumeCondition) ? { resume_condition: trimmed(input.resumeCondition) } : {}),
    ...(resumeAt ? { resume_at: resumeAt } : {}),
    ...(nextCheckAt ? { next_check_at: nextCheckAt } : {}),
    ...(trimmed(input.fallbackAt) ? { fallback_at: trimmed(input.fallbackAt) } : {}),
    ...(trimmed(input.fallbackAction) ? { fallback_action: trimmed(input.fallbackAction) } : {}),
  };
}

function mergeBlocker(existing: TaskBlocker | undefined, input: TaskBlockerInput): TaskBlocker | undefined {
  const blockerValue = input.blocker;
  const existingRecord = blockerRecord(existing);

  if (!hasStructuredBlockerInput(input)) {
    if (existingRecord && typeof blockerValue === "string") {
      const condition = trimmed(blockerValue);
      return condition ? { ...existingRecord, condition } : existing;
    }
    return typeof blockerValue === "string" ? trimmed(blockerValue) : blockerValue;
  }

  const inputRecord = sanitizeStructuredBlockerPatch(blockerRecord(blockerValue) ?? {});
  const condition =
    (typeof blockerValue === "string" ? trimmed(blockerValue) : blockerCondition(blockerValue)) ??
    blockerCondition(existing);
  const nextCheckAt = trimmed(input.nextCheckAt);
  const resumeAt = trimmed(input.resumeAt) ?? nextCheckAt;
  return {
    ...(existingRecord ?? {}),
    ...inputRecord,
    ...(condition ? { condition } : {}),
    ...(trimmed(input.blockerCategory) ? { category: trimmed(input.blockerCategory) } : {}),
    ...(trimmed(input.blockerOwner) ? { owner: trimmed(input.blockerOwner) } : {}),
    ...(trimmed(input.resumeCondition) ? { resume_condition: trimmed(input.resumeCondition) } : {}),
    ...(resumeAt ? { resume_at: resumeAt } : {}),
    ...(nextCheckAt ? { next_check_at: nextCheckAt } : {}),
    ...(trimmed(input.fallbackAt) ? { fallback_at: trimmed(input.fallbackAt) } : {}),
    ...(trimmed(input.fallbackAction) ? { fallback_action: trimmed(input.fallbackAction) } : {}),
  };
}

function hasBlockerInput(input: TaskBlockerInput): boolean {
  return input.blocker !== undefined || hasStructuredBlockerInput(input);
}

function blockerText(blocker: TaskNode["blocker"]): string | undefined {
  if (typeof blocker === "string") return blocker;
  if (!blocker) return undefined;
  const resumeCondition = blocker.resume_condition ?? blocker.resumeCondition;
  const resumeAt = blocker.resume_at ?? blocker.resumeAt;
  const nextCheckAt = blocker.next_check_at ?? blocker.nextCheckAt;
  const fallbackAt = blocker.fallback_at ?? blocker.fallbackAt;
  return [
    blocker.condition,
    resumeCondition,
    resumeAt ? `Resume at: ${resumeAt}` : undefined,
    nextCheckAt ? `Next check at: ${nextCheckAt}` : undefined,
    fallbackAt ? `Fallback at: ${fallbackAt}` : undefined,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" Resume: ");
}

function compactArray(values: unknown, limit = 8): string[] {
  return normalizeStringArray(values)
    .slice(0, limit)
    .map((value) => truncate(value, 260) ?? "");
}

function compactTrace(trace: TaskNode["trace"]): Record<string, unknown> {
  if (!trace || typeof trace !== "object" || Array.isArray(trace)) return {};
  const keep = [
    "current_attempt_id",
    "assigned_at",
    "assigned_by",
    "assigned_worker",
    "last_session",
    "last_worker_result",
    "last_worker_claim",
    "last_worker_summary",
    "last_worker_completed_at",
    "last_worker_evidence",
    "stale_active_restart_count",
    "stale_active_restart_reason",
    "stale_active_restart_at",
  ];
  return Object.fromEntries(
    keep
      .filter((key) => trace[key] !== undefined)
      .map((key) => [key, typeof trace[key] === "string" ? truncate(trace[key] as string, 700) : trace[key]]),
  );
}

function compactTask(task: TaskNode, readinessReasons?: string[]): TaskPlanningSnapshot {
  const trace = compactTrace(task.trace);
  const state = taskState(task);
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
    goal: truncate(task.goal, 900),
    outputs: compactArray(task.outputs),
    acceptance: compactArray(task.acceptance),
    conflict_scope: compactArray(task.conflict_scope),
    depends_on: compactArray(task.depends_on),
    blocker: truncate(blockerText(task.blocker), 700),
    readiness_reasons: readinessReasons?.slice(0, 6).map((reason) => truncate(reason, 260) ?? ""),
    trace: Object.keys(trace).length ? trace : undefined,
  };
}

function openChildCount(tree: TaskTree, parent: TaskNode): number {
  return normalizeStringArray(parent.children).filter((childId) => {
    const child = tree.tasks[childId];
    return child && taskState(child) !== "done";
  }).length;
}

function blockerSourceText(task: TaskNode): string {
  const blocker = blockerText(task.blocker);
  if (blocker?.trim()) return blocker;
  return [task.goal, compactArray(task.acceptance, 2).join(" ")]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
}

function blockerSignature(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b20\d{6,}\b/g, "date")
    .replace(/\b20\d{2}-\d{2}-\d{2}(t[0-9:.z-]+)?\b/g, "date")
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g, "email")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

export function summarizeBlockedFrontier(
  tree: TaskTree,
  excludedTaskIds: readonly string[] = [],
): TaskBlockedFrontierSummary | undefined {
  const excluded = new Set(excludedTaskIds);
  const blockedLeaves = Object.values(tree.tasks)
    .filter((task) => isLeaf(task) && taskState(task) === "blocked" && !excluded.has(task.id))
    .sort(taskSort);
  if (blockedLeaves.length === 0) return undefined;

  const byParent = new Map<string, TaskNode[]>();
  const bySignature = new Map<string, TaskNode[]>();
  const sampleBlockerBySignature = new Map<string, string>();

  for (const task of blockedLeaves) {
    const parentId = task.parent_id ?? "(root)";
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), task]);

    const source = blockerSourceText(task);
    const signature = blockerSignature(source);
    if (!signature) continue;
    bySignature.set(signature, [...(bySignature.get(signature) ?? []), task]);
    if (!sampleBlockerBySignature.has(signature)) {
      sampleBlockerBySignature.set(signature, truncate(source, 500) ?? "");
    }
  }

  return {
    blocked_leaf_count: blockedLeaves.length,
    parent_groups: [...byParent.entries()]
      .map(([parentId, tasks]) => {
        const parent = tree.tasks[parentId];
        return {
          parent_id: parentId,
          ...(parent?.goal ? { parent_goal: truncate(parent.goal, 300) } : {}),
          blocked_leaf_count: tasks.length,
          total_child_count: parent ? normalizeStringArray(parent.children).length : tasks.length,
          open_child_count: parent ? openChildCount(tree, parent) : tasks.length,
          sample_blocked_leaf_ids: tasks.slice(0, 8).map((task) => task.id),
          sample_blockers: [
            ...new Set(
              tasks
                .map((task) => truncate(blockerSourceText(task), 300))
                .filter((value): value is string => Boolean(value)),
            ),
          ].slice(0, 3),
        };
      })
      .sort(
        (a, b) =>
          b.blocked_leaf_count - a.blocked_leaf_count ||
          b.open_child_count - a.open_child_count ||
          a.parent_id.localeCompare(b.parent_id),
      )
      .slice(0, 10),
    repeated_blocker_groups: [...bySignature.entries()]
      .filter(([, tasks]) => tasks.length >= 2)
      .map(([signature, tasks]) => ({
        signature,
        blocked_leaf_count: tasks.length,
        parent_ids: [...new Set(tasks.map((task) => task.parent_id ?? "(root)"))].sort().slice(0, 8),
        sample_blocked_leaf_ids: tasks.slice(0, 8).map((task) => task.id),
        sample_blocker: sampleBlockerBySignature.get(signature),
      }))
      .sort((a, b) => b.blocked_leaf_count - a.blocked_leaf_count || a.signature.localeCompare(b.signature))
      .slice(0, 10),
  };
}

function frontierDetails(tree: TaskTree, status: string): TaskPlanningSnapshot[] {
  return Object.values(tree.tasks)
    .filter((task) => isLeaf(task) && taskState(task) === status)
    .sort(taskSort)
    .slice(0, 8)
    .map((task) => compactTask(task));
}

function frontierAssignableDetails(tree: TaskTree): TaskPlanningSnapshot[] {
  return Object.values(tree.tasks)
    .filter((task) => isRunnableBacklogLeaf(tree, task))
    .sort(taskSort)
    .slice(0, 8)
    .map((task) => compactTask(task));
}

export function waitingBacklogTaskSnapshots(tree: TaskTree): TaskPlanningSnapshot[] {
  return Object.values(tree.tasks)
    .map((task) => ({ task, reasons: waitingBacklogReasons(tree, task) }))
    .filter(({ task, reasons }) => isWorkerExecutableBacklogLeaf(task) && reasons.length > 0)
    .sort((a, b) => taskSort(a.task, b.task))
    .map(({ task, reasons }) => compactTask(task, reasons));
}

function taskTreeHygieneSummary(tree: TaskTree): TaskTreeHygieneSummary | undefined {
  const dependencyRefs = dependencyReferences(tree);
  const leaves = Object.values(tree.tasks).filter((task) => isLeaf(task));
  const safeDoneLeaves = leaves.filter((task) => isSafeDoneLeaf(tree, task, dependencyRefs));
  const protectedDoneLeafCount = leaves.filter(
    (task) => task.id !== tree.root_task_id && taskState(task) === "done" && dependencyRefs.has(task.id),
  ).length;

  if (safeDoneLeaves.length === 0 && protectedDoneLeafCount === 0) return undefined;

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

  for (const leaf of safeDoneLeaves) {
    const parentId = leaf.parent_id ?? "";
    const parent = parentId ? tree.tasks[parentId] : undefined;
    if (!parent) continue;
    const existing =
      byParent.get(parent.id) ??
      ({
        parent,
        safeDoneLeaves: [],
        doneChildCount: 0,
        openChildCount: 0,
        childCount: normalizeStringArray(parent.children).length,
      } satisfies {
        parent: TaskNode;
        safeDoneLeaves: TaskNode[];
        doneChildCount: number;
        openChildCount: number;
        childCount: number;
      });
    existing.safeDoneLeaves.push(leaf);
    byParent.set(parent.id, existing);
  }

  for (const entry of byParent.values()) {
    for (const childId of normalizeStringArray(entry.parent.children)) {
      const child = tree.tasks[childId];
      if (!child) continue;
      if (taskState(child) === "done") entry.doneChildCount++;
      else entry.openChildCount++;
    }
  }

  return {
    safe_done_leaf_count: safeDoneLeaves.length,
    protected_done_leaf_count: protectedDoneLeafCount,
    compaction_candidates: [...byParent.values()]
      .map((entry) => {
        const context = contextObject(entry.parent);
        const archivedCount =
          typeof context.archived_done_leaf_count === "number" ? context.archived_done_leaf_count : undefined;
        const rollupSummary =
          typeof context.rollup_summary === "string" ? truncate(context.rollup_summary, 500) : undefined;
        return {
          parent_id: entry.parent.id,
          child_count: entry.childCount,
          open_child_count: entry.openChildCount,
          done_child_count: entry.doneChildCount,
          safe_done_leaf_count: entry.safeDoneLeaves.length,
          ...(archivedCount !== undefined ? { archived_done_leaf_count: archivedCount } : {}),
          ...(rollupSummary ? { rollup_summary: rollupSummary } : {}),
          sample_done_leaf_ids: entry.safeDoneLeaves
            .sort(taskSort)
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
      .slice(0, 8),
  };
}

function summarizeLoadedTree(tree: TaskTree): TaskTreeSummary {
  const tasks = tree.tasks ?? {};
  const treeCounts: Record<string, number> = {};
  for (const task of Object.values(tasks)) {
    const state = taskState(task);
    treeCounts[state] = (treeCounts[state] ?? 0) + 1;
  }
  const leaves = Object.values(tasks).filter((task) => isLeaf(task));
  const counts: Record<string, number> = {};
  for (const task of leaves) {
    const state = taskState(task);
    counts[state] = (counts[state] ?? 0) + 1;
  }
  const childIds = new Set(Object.values(tasks).flatMap((task) => normalizeStringArray(task.children)));
  return {
    updated_at: tree.updated_at,
    total: Object.keys(tasks).length,
    leaf_total: leaves.length,
    roots: Object.keys(tasks)
      .filter((id) => !childIds.has(id))
      .sort(),
    active_task_ids: activeIds(tree),
    tree_counts: treeCounts,
    counts,
    frontier: {
      runnable: frontierAssignableIds(tree),
      waiting: waitingBacklogTaskSnapshots(tree)
        .slice(0, 20)
        .map((task) => task.id),
      active: frontierIds(tree, "active"),
      review: frontierIds(tree, "review"),
      blocked: frontierIds(tree, "blocked"),
    },
  };
}

export function summarizeTaskTree(config: ToolConfig): TaskTreeSummary {
  if (!existsSync(config.treePath))
    return {
      total: 0,
      leaf_total: 0,
      roots: [],
      active_task_ids: [],
      tree_counts: {},
      counts: {},
      frontier: {
        runnable: [],
        waiting: [],
        active: [],
        review: [],
        blocked: [],
      },
    };

  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    return summarizeLoadedTree(tree);
  });
}

export function listRunnableBacklogTaskIds(config: ToolConfig, limit = 20): string[] {
  if (!existsSync(config.treePath)) return [];
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    return Object.values(tree.tasks)
      .filter((task) => isRunnableBacklogLeaf(tree, task))
      .sort(taskSort)
      .slice(0, limit)
      .map((task) => task.id);
  });
}

export function kanbanTaskTreeState(config: ToolConfig): TaskKanbanState {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    return {
      tree,
      kanban: summarizeKanbanLoadedTree(tree),
    };
  });
}

export function writeKanbanSnapshot(config: ToolConfig): TaskKanbanSnapshot {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    return writeKanbanSnapshotForTree(config, tree);
  });
}

function loadModelStatusSummary(config: ToolConfig): ModelStatusSummary | undefined {
  const modelPath = join(config.projectDir, "model", "knowledge-map", "model.json");
  if (!existsSync(modelPath)) return undefined;
  try {
    const raw = JSON.parse(readFileSync(modelPath, "utf-8"));
    const featurePaths: Array<Record<string, unknown>> = Array.isArray(raw?.featurePaths) ? raw.featurePaths : [];
    const mirrorPaths: Array<Record<string, unknown>> = Array.isArray(raw?.paths) ? raw.paths : [];
    const byId = new Map<string, Record<string, unknown>>();
    for (const entry of mirrorPaths) {
      const id = typeof entry?.id === "string" ? entry.id.trim() : "";
      if (!id) continue;
      byId.set(id, { ...entry, id });
    }
    for (const entry of featurePaths) {
      const id = typeof entry?.id === "string" ? entry.id.trim() : "";
      if (!id) continue;
      byId.set(id, { ...byId.get(id), ...entry, id });
    }
    const paths = [...byId.values()];
    if (paths.length === 0) return undefined;
    const passing = paths.filter((p) => p.status === "pass");
    const nonPassing = paths.filter((p) => p.status !== "pass");
    const nonPassingEntries: ModelPathStatusEntry[] = nonPassing.map((p) => {
      const entry: ModelPathStatusEntry = {
        id: String(p.id ?? ""),
        status: String(p.status ?? "unknown"),
      };
      if (p.rootCauseClass) entry.rootCauseClass = String(p.rootCauseClass);
      if (p.label) entry.label = truncate(String(p.label), 200);
      if (p.verdictFinal === true) entry.verdictFinal = true;
      if (p.retestCondition) entry.retestCondition = truncate(String(p.retestCondition), 300);
      return entry;
    });
    return {
      total: paths.length,
      passing: passing.length,
      non_passing: nonPassing.length,
      non_passing_paths: nonPassingEntries,
    };
  } catch {
    return undefined;
  }
}

export function planningPacket(config: ToolConfig): TaskPlanningPacket {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const summary = summarizeLoadedTree(tree);
    const modelSummary = loadModelStatusSummary(config);
    const blockedSummary = summarizeBlockedFrontier(tree);
    const packet: TaskPlanningPacket = {
      ...summary,
      frontier_details: {
        runnable: frontierAssignableDetails(tree),
        waiting: waitingBacklogTaskSnapshots(tree).slice(0, 8),
        active: frontierDetails(tree, "active"),
        review: frontierDetails(tree, "review"),
        blocked: frontierDetails(tree, "blocked"),
      },
    };
    if (blockedSummary) {
      packet.blocked_frontier_summary = blockedSummary;
    }
    const hygiene = taskTreeHygieneSummary(tree);
    if (hygiene) {
      packet.task_tree_hygiene = hygiene;
    }
    if (modelSummary) {
      packet.model_status_summary = modelSummary;
    }
    return packet;
  });
}

export function readTask(config: ToolConfig, taskId: string): TaskNode | null {
  return withTreeLock(config, () => readTaskTree(config).tasks[taskId] ?? null);
}

function taskConflictScope(task: TaskNode): string[] {
  const explicit = normalizeStringArray(task.conflict_scope);
  return [...new Set(explicit.length ? explicit : normalizeStringArray(task.outputs))];
}

function conflictScopesOverlap(a: TaskNode, b: TaskNode): boolean {
  const right = new Set(taskConflictScope(b));
  return taskConflictScope(a).some((item) => right.has(item));
}

function activeLeaves(tree: TaskTree): TaskNode[] {
  return Object.values(tree.tasks)
    .filter((task) => isLeaf(task) && taskState(task) === "active")
    .sort(taskSort);
}

function stableTaskSessionId(task: TaskNode): string {
  const slug =
    task.id
      .replace(/[^A-Za-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 96) || "task";
  return `s_task_${slug}`;
}

function taskAttemptSessionId(task: TaskNode, attemptId: string): string {
  const attemptSlug =
    attemptId
      .replace(/[^A-Za-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(-64) || "attempt";
  return `${stableTaskSessionId(task)}_${attemptSlug}`;
}

function nonEmptyTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function createAssignmentForTask(
  task: TaskNode,
  input: {
    worker?: string;
    attemptId?: string;
  },
  config: ToolConfig,
  now = new Date().toISOString(),
): TaskAssignment {
  const attemptId =
    input.attemptId ?? `a_${task.id.replace(/[^A-Za-z0-9_-]+/g, "_")}_${now.replace(/\D/g, "").slice(0, 14)}`;
  const sessionId = taskAttemptSessionId(task, attemptId);
  const worker =
    nonEmptyTrimmedString(input.worker) || nonEmptyTrimmedString(task.owner) || nonEmptyTrimmedString(config.worker);
  if (!worker) {
    throw new Error(`Task ${task.id} cannot be assigned without a non-empty worker/owner contract`);
  }
  setTaskState(task, "active");
  task.owner = worker;
  task.session_id = sessionId;
  task.session_history = [...new Set([...(task.session_history ?? []), sessionId])];
  task.trace = {
    ...(task.trace ?? {}),
    current_attempt_id: attemptId,
    current_task_revision: taskRevision(task),
    assigned_at: now,
    assigned_by: "planner",
    assigned_worker: worker,
    last_session: sessionId,
  };
  return {
    taskId: task.id,
    taskRevision: taskRevision(task),
    attemptId,
    sessionId,
    worker,
    assignedAt: now,
  };
}

function assignmentOutboxPath(config: ToolConfig): string {
  return join(config.appDir, ".state", "task-assignments.jsonl");
}

function appendAssignmentOutbox(config: ToolConfig, assignment: TaskAssignment): void {
  const path = assignmentOutboxPath(config);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(assignment)}\n`);
}

function assignmentDrainPath(config: ToolConfig): string {
  return `${assignmentOutboxPath(config)}.draining`;
}

function parseTaskAssignment(value: unknown): TaskAssignment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const taskId = nonEmptyTrimmedString(row.taskId) || nonEmptyTrimmedString(row.task_id);
  const attemptId = nonEmptyTrimmedString(row.attemptId) || nonEmptyTrimmedString(row.attempt_id);
  const sessionId = nonEmptyTrimmedString(row.sessionId) || nonEmptyTrimmedString(row.session_id);
  const worker = nonEmptyTrimmedString(row.worker);
  const assignedAt = nonEmptyTrimmedString(row.assignedAt) || nonEmptyTrimmedString(row.assigned_at);
  const rawRevision = row.taskRevision ?? row.task_revision;
  const taskRevision =
    typeof rawRevision === "number" && Number.isInteger(rawRevision) && rawRevision >= 0 ? rawRevision : 0;
  if (!taskId || !attemptId || !sessionId || !worker || !assignedAt) return null;
  return { taskId, taskRevision, attemptId, sessionId, worker, assignedAt };
}

function readAssignmentFile(path: string): TaskAssignment[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf-8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const assignment = parseTaskAssignment(JSON.parse(line));
        return assignment ? [assignment] : [];
      } catch {
        return [];
      }
    });
}

function assignmentMatchesTree(tree: TaskTree, assignment: TaskAssignment): boolean {
  const task = tree.tasks[assignment.taskId];
  return Boolean(
    task &&
    taskState(task) === "active" &&
    task.session_id === assignment.sessionId &&
    task.trace?.current_attempt_id === assignment.attemptId &&
    taskRevision(task) === assignment.taskRevision,
  );
}

export function drainTaskAssignments(config: ToolConfig): TaskAssignment[] {
  return withTreeLock(config, () => {
    const path = assignmentOutboxPath(config);
    const drainingPath = assignmentDrainPath(config);
    const tree = readTaskTree(config);
    const rows: TaskAssignment[] = [];

    if (existsSync(drainingPath)) {
      rows.push(...readAssignmentFile(drainingPath));
      rmSync(drainingPath, { force: true });
    }
    if (existsSync(path)) {
      renameSync(path, drainingPath);
      rows.push(...readAssignmentFile(drainingPath));
      rmSync(drainingPath, { force: true });
    }
    return rows.filter((assignment) => assignmentMatchesTree(tree, assignment));
  });
}

export function peekTaskAssignments(config: ToolConfig): TaskAssignment[] {
  const path = assignmentOutboxPath(config);
  const drainingPath = assignmentDrainPath(config);
  const tree = readTaskTree(config);
  return [...readAssignmentFile(drainingPath), ...readAssignmentFile(path)].filter((assignment) =>
    assignmentMatchesTree(tree, assignment),
  );
}

function assignmentDeliveryKey(assignment: TaskAssignment): string {
  return `${assignment.taskId}:${assignment.taskRevision}:${assignment.attemptId}:${assignment.sessionId}`;
}

export function acknowledgeTaskAssignments(config: ToolConfig, assignments: TaskAssignment[]): number {
  const acknowledgedKeys = new Set(assignments.map(assignmentDeliveryKey));
  if (acknowledgedKeys.size === 0) return 0;
  return withTreeLock(config, () => {
    const path = assignmentOutboxPath(config);
    const drainingPath = assignmentDrainPath(config);
    const tree = readTaskTree(config);
    const rows = [...readAssignmentFile(drainingPath), ...readAssignmentFile(path)];
    const liveRows = rows.filter((assignment) => assignmentMatchesTree(tree, assignment));
    const remaining = liveRows.filter((assignment) => !acknowledgedKeys.has(assignmentDeliveryKey(assignment)));
    const acknowledged = liveRows.length - remaining.length;
    rmSync(path, { force: true });
    rmSync(drainingPath, { force: true });
    if (remaining.length > 0) {
      mkdirSync(dirname(path), { recursive: true });
      const temporaryPath = `${path}.ack-${process.pid}-${Date.now()}`;
      writeFileSync(temporaryPath, `${remaining.map((assignment) => JSON.stringify(assignment)).join("\n")}\n`);
      renameSync(temporaryPath, path);
    }
    return acknowledged;
  });
}

export function requeueStaleActiveTasks(
  config: ToolConfig,
  input: {
    taskIds: string[];
    reason?: string;
    freshSession?: boolean;
  },
): string[] {
  const uniqueIds = [...new Set(input.taskIds.filter(Boolean))];
  if (uniqueIds.length === 0) return [];
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const requeued: string[] = [];
    const now = new Date().toISOString();
    for (const taskId of uniqueIds) {
      const task = tree.tasks[taskId];
      if (!task || !isLeaf(task) || taskState(task) !== "active") continue;
      setTaskState(task, "backlog");
      task.trace = {
        ...(task.trace ?? {}),
        stale_active_requeued_at: now,
        stale_active_requeue_reason: input.reason ?? "session-not-running",
        stale_active_fresh_session: input.freshSession === true,
        previous_attempt_id:
          task.trace && typeof task.trace.current_attempt_id === "string" ? task.trace.current_attempt_id : undefined,
        current_attempt_id: undefined,
      };
      if (input.freshSession) task.session_id = undefined;
      requeued.push(task.id);
    }
    if (requeued.length > 0) {
      tree.active_task_ids = activeIds(tree);
      tree.active_task_id = tree.active_task_ids[0] ?? null;
      saveTaskTreeWithKanbanSnapshot(config, tree);
      appendToolJournal(config, {
        kind: "stale_active_tasks_requeued",
        task_ids: requeued,
        reason: input.reason ?? "session-not-running",
      });
    }
    return requeued;
  });
}

export function assignRunnableBacklogTasks(
  config: ToolConfig,
  input: {
    worker?: string;
    limit?: number;
  } = {},
): RunnableBacklogAssignmentResult {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const assignments: TaskAssignment[] = [];
    const skipped: RunnableBacklogAssignmentResult["skipped"] = [];
    const capacity = Math.max(0, config.maxConcurrent - activeLeaves(tree).length);
    const limit = Math.max(0, Math.min(input.limit ?? capacity, capacity));
    if (limit <= 0) return { assignments, skipped };

    for (const task of Object.values(tree.tasks)
      .filter((candidate) => isWorkerExecutableBacklogLeaf(candidate) || isWorkerExecutableController(candidate))
      .sort(taskSort)) {
      if (assignments.length >= limit) break;
      const controllerTask = isWorkerExecutableController(task);
      if (!isLeaf(task) && !controllerTask) {
        skipped.push({ taskId: task.id, reason: "not-leaf" });
        continue;
      }
      if (!isClearEnough(task)) {
        skipped.push({ taskId: task.id, reason: "not-clear-enough" });
        continue;
      }
      if (!dependenciesSatisfied(tree, task)) {
        skipped.push({ taskId: task.id, reason: "dependencies-unsatisfied" });
        continue;
      }
      const active = activeLeaves(tree);
      if (active.length >= config.maxConcurrent) break;
      if (active.some((other) => conflictScopesOverlap(other, task))) {
        skipped.push({ taskId: task.id, reason: "conflict-scope-active" });
        continue;
      }

      const assignment = createAssignmentForTask(task, { worker: input.worker }, config);
      assignments.push(assignment);
      appendAssignmentOutbox(config, assignment);
    }

    if (assignments.length > 0) {
      tree.active_task_ids = activeIds(tree);
      tree.active_task_id = tree.active_task_ids[0] ?? null;
      saveTaskTreeWithKanbanSnapshot(config, tree);
      for (const assignment of assignments) {
        appendToolJournal(config, {
          kind: "task_assigned",
          task_id: assignment.taskId,
          task_revision: assignment.taskRevision,
          attempt_id: assignment.attemptId,
          session_id: assignment.sessionId,
          worker: assignment.worker,
          source: "planner_quick_refill",
        });
      }
    }
    return { assignments, skipped };
  });
}

export function assignTask(
  config: ToolConfig,
  input: {
    taskId: string;
    worker?: string;
    attemptId?: string;
    expectedRevision?: number;
  },
): TaskAssignment {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId];
    if (!task) throw new Error(`Task not found: ${input.taskId}`);
    if (input.expectedRevision !== undefined && input.expectedRevision !== taskRevision(task)) {
      throw new Error(
        `Task ${task.id} revision ${input.expectedRevision} is stale; current revision is ${taskRevision(task)}`,
      );
    }
    const currentState = taskState(task);
    if (currentState !== "backlog") throw new Error(`Task ${task.id} is ${currentState}, not runnable backlog`);
    const controllerTask = isWorkerExecutableController(task);
    if (!isLeaf(task) && !controllerTask) throw new Error(`Task ${task.id} is not a leaf`);
    if (!isWorkerExecutableBacklogLeaf(task) && !controllerTask)
      throw new Error(`Task ${task.id} is not a worker-executable backlog leaf`);
    if (!isClearEnough(task)) throw new Error(`Task ${task.id} is not clear enough to assign`);
    if (!dependenciesSatisfied(tree, task)) throw new Error(`Task ${task.id} has unsatisfied dependencies`);
    const active = activeLeaves(tree);
    if (active.length >= config.maxConcurrent) throw new Error(`Worker capacity is full (${config.maxConcurrent})`);
    if (active.some((other) => conflictScopesOverlap(other, task)))
      throw new Error(`Task ${task.id} conflicts with active work`);

    const assignment = createAssignmentForTask(task, input, config);
    tree.active_task_ids = activeIds(tree);
    tree.active_task_id = tree.active_task_ids[0] ?? null;
    appendAssignmentOutbox(config, assignment);
    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_assigned",
      task_id: task.id,
      task_revision: assignment.taskRevision,
      attempt_id: assignment.attemptId,
      session_id: assignment.sessionId,
      worker: assignment.worker,
    });
    return assignment;
  });
}

export function createTask(config: ToolConfig, input: CreateTaskInput): TaskNode {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    if (tree.tasks[input.id]) throw new Error(`Task already exists: ${input.id}`);
    const parent = tree.tasks[input.parentId];
    if (!parent) throw new Error(`Parent task not found: ${input.parentId}`);
    const requestedState = input.state ?? input.status ?? "backlog";
    const state = requestedState === "blocked" ? "blocked" : "backlog";
    const blocker = buildBlocker(input);
    const initialRevision = input.initialRevision ?? 0;
    if (!Number.isInteger(initialRevision) || initialRevision < 0) {
      throw new Error("initialRevision must be a non-negative integer");
    }
    if (state === "blocked" && !blockerCondition(blocker)) throw new Error("Blocked tasks require --blocker");
    if (state !== "blocked" && hasBlockerInput(input))
      throw new Error("--blocker fields are only valid with --status blocked");

    const task: TaskNode = {
      id: input.id,
      revision: initialRevision,
      parent_id: input.parentId,
      state,
      kind: input.kind ?? "domain_leaf",
      priority: input.priority ?? "P2",
      owner: input.owner ?? config.worker,
      children: [],
      goal: input.goal,
      inputs: input.inputs ?? [],
      outputs: input.outputs,
      acceptance: input.acceptance,
      forbidden: input.forbidden ?? [],
      conflict_scope: input.conflict_scope,
      depends_on: input.depends_on,
      workflow: input.workflow,
      context: input.context,
      blocker,
      trace: {
        created_at: new Date().toISOString(),
        created_by: "task-tree-tool",
      },
    };
    setTaskState(task, state);

    tree.tasks[input.id] = task;
    parent.children = [...new Set([...normalizeStringArray(parent.children), input.id])];
    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_created",
      task_id: task.id,
      parent_id: input.parentId,
      state: taskState(task),
    });
    return task;
  });
}

export function confirmRunnableBacklogLeaves(config: ToolConfig, limit = 10): string[] {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const promoted: string[] = [];
    const candidates = Object.values(tree.tasks)
      .filter((task) => isRunnableBacklogLeaf(tree, task))
      .sort(taskSort);
    for (const task of candidates) {
      if (promoted.length >= limit) break;
      setTaskState(task, "backlog");
      task.trace = {
        ...(task.trace ?? {}),
        promoted_at: new Date().toISOString(),
        promoted_by: "task-tree-tool",
      };
      promoted.push(task.id);
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

export function completeTask(
  config: ToolConfig,
  input: {
    taskId: string;
    taskRevision?: number;
    attemptId?: string;
    claim: TaskCompletionClaim;
    summary: string;
    evidence?: string[];
  },
): TaskNode {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId];
    if (!task) throw new Error(`Task not found: ${input.taskId}`);
    assertTaskCorrelation(task, input, "Completion");
    const now = new Date().toISOString();
    const trace = {
      ...(task.trace ?? {}),
      last_worker_result: input.claim,
      last_worker_claim: input.claim,
      last_worker_summary: input.summary,
      last_worker_completed_at: now,
      last_worker_task_revision: taskRevision(task),
      last_worker_evidence: input.evidence ?? [],
    };
    setTaskState(task, "review");
    task.result = input.summary;
    task.evidence = input.evidence ?? [];
    task.blocker = undefined;
    task.trace = trace;
    tree.active_task_ids = activeIds(tree);
    tree.active_task_id = tree.active_task_ids[0] ?? null;
    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_worker_completed",
      task_id: task.id,
      task_revision: taskRevision(task),
      attempt_id: input.attemptId,
      result: input.claim,
      state: taskState(task),
      summary: input.summary,
    });
    return task;
  });
}

export function markTaskDone(config: ToolConfig, input: MarkTaskDoneInput): TaskNode {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId];
    if (!task) throw new Error(`Task not found: ${input.taskId}`);
    assertTaskCorrelation(task, input, "Review acceptance");
    const now = new Date().toISOString();
    setTaskState(task, "done");
    task.blocker = undefined;
    task.resolution = input.resolution ?? task.resolution ?? "completed";
    task.done_at = now;
    task.done_by = "task-tree-tool";
    task.trace = {
      ...(task.trace ?? {}),
      reviewed_at: now,
      reviewed_by: "task-tree-tool",
      review_summary: input.summary,
    };
    const context =
      task.context && typeof task.context === "object" && !Array.isArray(task.context) ? task.context : {};
    task.context = {
      ...context,
      acceptance_note: input.summary,
    };
    tree.active_task_ids = activeIds(tree);
    tree.active_task_id = tree.active_task_ids[0] ?? null;
    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_marked_done",
      task_id: task.id,
      resolution: task.resolution,
      summary: input.summary,
    });
    return task;
  });
}

export function updateTaskOutputs(config: ToolConfig, input: UpdateTaskOutputsInput): TaskNode {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId];
    if (!task) throw new Error(`Task not found: ${input.taskId}`);
    const previousFingerprint = taskIntentFingerprint(task);
    const outputs = normalizeStringArray(input.outputs);
    if (outputs.length === 0) throw new Error("Task outputs cannot be empty");
    task.outputs = outputs;
    const revisionChanged = bumpRevisionForIntentChange(task, previousFingerprint);
    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_outputs_updated",
      task_id: task.id,
      outputs,
      revision: taskRevision(task),
      revision_changed: revisionChanged,
    });
    return task;
  });
}

export function updateTaskText(config: ToolConfig, input: UpdateTaskTextInput): TaskNode {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId];
    if (!task) throw new Error(`Task not found: ${input.taskId}`);
    const previousFingerprint = taskIntentFingerprint(task);

    const hasGoal = typeof input.goal === "string";
    const hasAcceptance = input.acceptance !== undefined;
    const hasBlocker = hasBlockerInput(input);
    const clearBlocker = input.clearBlocker === true;
    if (!hasGoal && !hasAcceptance && !hasBlocker && !clearBlocker) {
      throw new Error("Provide at least one of goal, acceptance, blocker, or clearBlocker");
    }
    if (clearBlocker && hasBlocker) throw new Error("Cannot combine clearBlocker with blocker fields");

    if (hasGoal) {
      const goal = input.goal?.trim() ?? "";
      if (!goal) throw new Error("Task goal cannot be empty");
      task.goal = goal;
    }

    let acceptance: string[] | undefined;
    if (hasAcceptance) {
      acceptance = normalizeStringArray(input.acceptance);
      if (acceptance.length === 0) throw new Error("Task acceptance cannot be empty");
      task.acceptance = acceptance;
    }

    if (clearBlocker) {
      task.blocker = undefined;
    }
    if (hasBlocker) {
      const blocker = mergeBlocker(task.blocker, input);
      if (hasStructuredBlockerInput(input) && !blockerCondition(blocker)) {
        throw new Error("Structured blocker updates require --blocker or an existing blocker condition");
      }
      task.blocker = blockerCondition(blocker) ? blocker : undefined;
    }

    const revisionChanged = bumpRevisionForIntentChange(task, previousFingerprint);

    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_text_updated",
      task_id: task.id,
      goal_updated: hasGoal,
      acceptance_updated: hasAcceptance,
      blocker_updated: hasBlocker || clearBlocker,
      acceptance_count: acceptance?.length,
      blocked_state: task.blocker ? "present" : "cleared",
      revision: taskRevision(task),
      revision_changed: revisionChanged,
    });
    return task;
  });
}

export function unblockTask(config: ToolConfig, input: UnblockTaskInput): TaskNode {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId];
    if (!task) throw new Error(`Task not found: ${input.taskId}`);
    if (!isLeaf(task)) throw new Error(`Task ${task.id} is not a leaf`);
    const state = taskState(task);
    if (state !== "blocked") throw new Error(`Task ${task.id} is ${state}, not blocked`);
    const previousFingerprint = taskIntentFingerprint(task);

    const reason = input.reason.trim();
    if (!reason) throw new Error("Unblock reason cannot be empty");

    const blocker =
      task.blocker && typeof task.blocker === "object" && !Array.isArray(task.blocker)
        ? (task.blocker as Record<string, unknown>)
        : null;
    const resumeAt =
      typeof blocker?.resume_at === "string"
        ? blocker.resume_at.trim()
        : typeof blocker?.resumeAt === "string"
          ? blocker.resumeAt.trim()
          : "";
    if (!input.force && resumeAt) {
      const resumeAtMs = Date.parse(resumeAt);
      if (Number.isFinite(resumeAtMs) && resumeAtMs > Date.now()) {
        throw new Error(
          `Task ${task.id} remains time-gated until ${resumeAt}; pass force=true only when intentionally overriding the review window.`,
        );
      }
    }

    const now = new Date().toISOString();
    setTaskState(task, "backlog");
    task.blocker = undefined;
    const revisionChanged = bumpRevisionForIntentChange(task, previousFingerprint);
    task.trace = {
      ...(task.trace ?? {}),
      unblocked_at: now,
      unblocked_by: "task-tree-tool",
      unblock_reason: reason,
      current_attempt_id: undefined,
    };
    tree.active_task_ids = activeIds(tree);
    tree.active_task_id = tree.active_task_ids[0] ?? null;
    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_unblocked",
      task_id: task.id,
      reason,
      revision: taskRevision(task),
      revision_changed: revisionChanged,
    });
    return task;
  });
}

export function rejectTaskReview(config: ToolConfig, input: RejectTaskReviewInput): TaskNode {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId];
    if (!task) throw new Error(`Task not found: ${input.taskId}`);
    const state = taskState(task);
    if (state !== "review") throw new Error(`Task ${task.id} is ${state}, not review`);
    assertTaskCorrelation(task, input, "Review rejection");
    if (!isLeaf(task)) throw new Error(`Task ${task.id} is not a leaf`);
    const now = new Date().toISOString();
    const previousAttemptId =
      typeof task.trace?.current_attempt_id === "string" ? task.trace.current_attempt_id : undefined;
    setTaskState(task, "backlog");
    task.blocker = undefined;
    task.trace = {
      ...(task.trace ?? {}),
      review_rejected_at: now,
      review_rejected_by: "task-tree-tool",
      review_reject_reason: input.reason,
      review_reject: input.review,
      review_reject_fresh_session: input.freshSession === true,
      previous_attempt_id: previousAttemptId,
      current_attempt_id: undefined,
    };
    if (input.freshSession) task.session_id = undefined;
    tree.active_task_ids = activeIds(tree);
    tree.active_task_id = tree.active_task_ids[0] ?? null;
    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_review_rejected",
      task_id: task.id,
      task_revision: taskRevision(task),
      attempt_id: input.attemptId,
      reason: input.reason,
      review: input.review,
    });
    return task;
  });
}

export function appendPlannerRun(appDir: string, entry: Record<string, unknown>): void {
  const plannerRunsPath = join(appDir, ".state", "planner-runs.jsonl");
  mkdirSync(dirname(plannerRunsPath), { recursive: true });
  appendFileSync(
    plannerRunsPath,
    `${JSON.stringify({
      ts: new Date().toISOString(),
      workflow: "project-planner",
      ...entry,
    })}\n`,
  );
}
