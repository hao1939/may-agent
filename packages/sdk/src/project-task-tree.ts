import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  dependenciesSatisfied,
  isClearEnough,
  isLeaf,
  normalizeStringArray,
  readTaskTree,
  saveTaskTree,
  taskState,
  withTreeLock,
  type TaskTreeConfig,
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
    active: TaskPlanningSnapshot[];
    review: TaskPlanningSnapshot[];
    blocked: TaskPlanningSnapshot[];
  };
  model_status_summary?: ModelStatusSummary;
};

export type TaskCompletionClaim = "done" | "partial" | "blocked";

export type TaskAssignment = {
  taskId: string;
  task_id: string;
  attemptId: string;
  attempt_id: string;
  sessionId: string;
  session_id: string;
  worker: string;
  assignedAt: string;
  assigned_at: string;
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
  state?: "backlog" | "blocked";
  status?: "proposed" | "backlog" | "ready" | "blocked";
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
  blocker?: string;
};

export type MarkTaskDoneInput = {
  taskId: string;
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
  blocker?: string;
  clearBlocker?: boolean;
};

export type UnblockTaskInput = {
  taskId: string;
  reason: string;
};

export type RejectTaskReviewInput = {
  taskId: string;
  reason: string;
  freshSession?: boolean;
};

export function taskTreeConfig(input: TaskTreeToolConfig): ToolConfig {
  return {
    appDir: input.appDir,
    projectDir: input.projectDir,
    treePath: join(input.appDir, "tasks", "tree.json"),
    journalPath: join(input.appDir, ".state", "journal.jsonl"),
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
  if (task.status !== "blocked") return false;
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
      task.blocker || "",
    )
  )
    return false;
  if (record.blocked === true) return true;
  if (record.blocker_type === "external") return true;
  if (record.blocked_by === "human") return true;
  const text = [task.goal, task.blocker, ...normalizeStringArray(record.gates)].filter(Boolean).join("\n");
  return /(?:external|credential|auth|token|azure cli|\baz\b|owner|capacity|quota|rollout|environment|precondition|human|input|approval|unsafe|safety|not installed|unavailable|source signal|subscription|msi|hcp|staging)/i.test(
    text,
  );
}

export function taskKanbanColumn(task: TaskNode): TaskKanbanColumn | null {
  if (task.status === "backlog") return "backlog";
  if (task.status === "active") return "in-progress";
  if (task.status === "review") return "review";
  if (task.status === "blocked") return hasExternalBlockSignal(task) ? "blocked" : "review";
  if (task.status === "done") return "done";
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
  return join(config.appDir, "tasks", "kanban.json");
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
  applyTaskTreeRollups(tree);
  saveTaskTree(config, tree);
  return writeKanbanSnapshotForTree(config, tree);
}

function activeIds(tree: TaskTree): string[] {
  return Object.values(tree.tasks)
    .filter((task) => isLeaf(task) && task.status === "active")
    .sort(taskSort)
    .map((task) => task.id);
}

function openLeafIds(tree: TaskTree): string[] {
  return Object.values(tree.tasks)
    .filter((task) => isLeaf(task) && task.status !== "done")
    .sort(taskSort)
    .map((task) => task.id);
}

function rolledUpParentState(tree: TaskTree, task: TaskNode): string {
  const childStates = normalizeStringArray(task.children)
    .map((id) => tree.tasks[id]?.status)
    .filter((state): state is string => Boolean(state));
  if (!childStates.length) return task.status ?? "backlog";
  if (childStates.includes("active")) return "active";
  if (childStates.includes("review")) return "review";
  if (childStates.includes("blocked")) return "blocked";
  if (childStates.includes("backlog")) return "backlog";
  return "done";
}

function applyTaskTreeRollups(tree: TaskTree): TaskTreeRepairResult {
  const repaired: TaskTreeRepairResult["repaired"] = [];
  const visit = (taskId: string): void => {
    const task = tree.tasks[taskId];
    if (!task) return;
    for (const childId of normalizeStringArray(task.children)) visit(childId);
    if (!normalizeStringArray(task.children).length) return;
    const nextState = rolledUpParentState(tree, task);
    if (task.status !== nextState) {
      repaired.push({
        taskId: task.id,
        from: task.status ?? "unknown",
        to: nextState,
      });
      task.status = nextState;
      task.state = nextState;
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
  tree.project_lifecycle = nextLifecycle;
  tree.active_task_ids = nextActiveIds;
  tree.active_task_id = nextActiveIds[0] ?? null;
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
    const result = applyTaskTreeRollups(tree);

    if (result.changed) {
      saveTaskTreeWithKanbanSnapshot(config, tree);
      appendToolJournal(config, {
        kind: "task_tree_rollup_repaired",
        lifecycle: result.lifecycle,
        active_task_ids: result.active_task_ids,
        repaired: result.repaired,
      });
    }
    return result;
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

function isSafeDoneLeaf(tree: TaskTree, task: TaskNode | undefined, dependencyRefs: Set<string>): task is TaskNode {
  return Boolean(
    task && task.id !== tree.root_task_id && isLeaf(task) && task.status === "done" && !dependencyRefs.has(task.id),
  );
}

function writeCompactArchive(input: {
  config: ToolConfig;
  reason: string;
  tasks: TaskNode[];
  parentId?: string;
  summary?: string;
}): string {
  const archiveDir = join(input.config.appDir, "tasks", "archive");
  const archiveStamp = compactArchiveStamp();
  let archiveRelPath = join("tasks", "archive", `done-leaves-${archiveStamp}.json`);
  let archivePath = join(input.config.appDir, archiveRelPath);
  let attempt = 1;
  while (existsSync(archivePath)) {
    archiveRelPath = join("tasks", "archive", `done-leaves-${archiveStamp}-${attempt}.json`);
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
            return task && isLeaf(task) && task.status === "done" && !dependencyRefs.has(task.id);
          })
          .slice(0, Math.max(0, input.limit ?? 200));

    const selected: TaskNode[] = [];
    const protectedCount = childIds.filter((childId) => {
      const task = tree.tasks[childId];
      return task && isLeaf(task) && task.status === "done" && dependencyRefs.has(task.id);
    }).length;

    for (const taskId of selectedIds) {
      const task = tree.tasks[taskId];
      if (!task) throw new Error(`Task not found: ${taskId}`);
      if (task.parent_id !== parent.id) throw new Error(`Task ${taskId} is not a child of ${parent.id}`);
      if (!isLeaf(task)) throw new Error(`Task ${taskId} is not a leaf`);
      if (task.status !== "done") throw new Error(`Task ${taskId} is ${task.status}, not done`);
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

    const repair = applyTaskTreeRollups(tree);
    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_tree_parent_rolled_up",
      parent_id: parent.id,
      archive: archiveRelPath,
      archived: selected.length,
      protected: protectedCount,
      archived_task_ids: selected.map((task) => task.id),
      repaired: repair.repaired,
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
          task.id !== tree.root_task_id && isLeaf(task) && task.status === "done" && dependencyRefs.has(task.id),
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

      applyTaskTreeRollups(tree);
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

    const repair = applyTaskTreeRollups(tree);
    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_tree_done_leaves_compacted",
      archive: archivePaths[archivePaths.length - 1],
      archives: archivePaths,
      archived: archivedTaskIds.length,
      protected: protectedCount,
      repaired: repair.repaired,
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
    .filter((task) => isLeaf(task) && task.status === status)
    .sort(taskSort)
    .slice(0, 20)
    .map((task) => task.id);
}

function isWorkerExecutableBacklogLeaf(task: TaskNode): boolean {
  if (!isLeaf(task)) return false;
  if (task.status !== "backlog") return false;
  if (isPlanningTask(task)) return false;
  if (task.kind === "work" || task.kind === "focus_plan" || task.kind === "durable_lane") return false;
  return true;
}

function isRunnableBacklogLeaf(tree: TaskTree, task: TaskNode): boolean {
  if (!isWorkerExecutableBacklogLeaf(task)) return false;
  if (!isClearEnough(task)) return false;
  if (!dependenciesSatisfied(tree, task)) return false;
  return !activeLeaves(tree).some((active) => conflictScopesOverlap(active, task));
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

function compactTask(task: TaskNode): TaskPlanningSnapshot {
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
    blocker: truncate(task.blocker, 700),
    trace: Object.keys(trace).length ? trace : undefined,
  };
}

function frontierDetails(tree: TaskTree, status: string): TaskPlanningSnapshot[] {
  return Object.values(tree.tasks)
    .filter((task) => isLeaf(task) && task.status === status)
    .sort(taskSort)
    .slice(0, 8)
    .map(compactTask);
}

function frontierAssignableDetails(tree: TaskTree): TaskPlanningSnapshot[] {
  return Object.values(tree.tasks)
    .filter((task) => isRunnableBacklogLeaf(tree, task))
    .sort(taskSort)
    .slice(0, 8)
    .map(compactTask);
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
    const paths: Array<Record<string, unknown>> = Array.isArray(raw?.paths) ? raw.paths : [];
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
    const packet: TaskPlanningPacket = {
      ...summary,
      frontier_details: {
        runnable: frontierAssignableDetails(tree),
        active: frontierDetails(tree, "active"),
        review: frontierDetails(tree, "review"),
        blocked: frontierDetails(tree, "blocked"),
      },
    };
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
    .filter((task) => isLeaf(task) && task.status === "active")
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
  const wantsFreshSession =
    (task.trace?.review_reject_fresh_session === true || task.trace?.stale_active_fresh_session === true) &&
    !task.session_id;
  const defaultSessionId = wantsFreshSession
    ? `${stableTaskSessionId(task)}_retry_${now.replace(/\D/g, "").slice(0, 14)}`
    : stableTaskSessionId(task);
  const sessionId =
    typeof task.session_id === "string" && task.session_id.trim() ? task.session_id.trim() : defaultSessionId;
  const worker = input.worker ?? task.owner ?? config.worker;
  task.status = "active";
  task.state = "active";
  task.owner = worker;
  task.session_id = sessionId;
  task.session_history = [...new Set([...(task.session_history ?? []), sessionId])];
  task.trace = {
    ...(task.trace ?? {}),
    current_attempt_id: attemptId,
    assigned_at: now,
    assigned_by: "planner",
    assigned_worker: worker,
    last_session: sessionId,
  };
  return {
    taskId: task.id,
    task_id: task.id,
    attemptId,
    attempt_id: attemptId,
    sessionId,
    session_id: sessionId,
    worker,
    assignedAt: now,
    assigned_at: now,
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

export function drainTaskAssignments(config: ToolConfig): TaskAssignment[] {
  const path = assignmentOutboxPath(config);
  if (!existsSync(path)) return [];
  const rows = peekTaskAssignments(config);
  writeFileSync(path, "", "utf-8");
  return rows;
}

export function peekTaskAssignments(config: ToolConfig): TaskAssignment[] {
  const path = assignmentOutboxPath(config);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf-8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TaskAssignment);
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
      if (!task || !isLeaf(task) || task.status !== "active") continue;
      task.status = "backlog";
      task.state = "backlog";
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

    for (const task of Object.values(tree.tasks).filter(isWorkerExecutableBacklogLeaf).sort(taskSort)) {
      if (assignments.length >= limit) break;
      if (!isLeaf(task)) {
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
      appendToolJournal(config, {
        kind: "task_assigned",
        task_id: task.id,
        attempt_id: assignment.attemptId,
        session_id: assignment.sessionId,
        worker: assignment.worker,
        source: "planner_quick_refill",
      });
    }

    if (assignments.length > 0) {
      tree.active_task_ids = activeIds(tree);
      tree.active_task_id = tree.active_task_ids[0] ?? null;
      saveTaskTreeWithKanbanSnapshot(config, tree);
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
  },
): TaskAssignment {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId];
    if (!task) throw new Error(`Task not found: ${input.taskId}`);
    if (task.status !== "backlog") throw new Error(`Task ${task.id} is ${task.status}, not runnable backlog`);
    if (!isLeaf(task)) throw new Error(`Task ${task.id} is not a leaf`);
    if (!isWorkerExecutableBacklogLeaf(task))
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
    saveTaskTreeWithKanbanSnapshot(config, tree);

    appendAssignmentOutbox(config, assignment);
    appendToolJournal(config, {
      kind: "task_assigned",
      task_id: task.id,
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
    const status = requestedState === "blocked" ? "blocked" : "backlog";
    if (status === "blocked" && !input.blocker?.trim()) throw new Error("Blocked tasks require --blocker");
    if (status !== "blocked" && input.blocker?.trim()) throw new Error("--blocker is only valid with --status blocked");

    const task: TaskNode = {
      id: input.id,
      parent_id: input.parentId,
      state: status,
      status,
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
      blocker: input.blocker,
      trace: {
        created_at: new Date().toISOString(),
        created_by: "task-tree-tool",
      },
    };

    tree.tasks[input.id] = task;
    parent.children = [...new Set([...normalizeStringArray(parent.children), input.id])];
    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_created",
      task_id: task.id,
      parent_id: input.parentId,
      state: task.status,
      status: task.status,
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
      task.status = "backlog";
      task.state = "backlog";
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
    claim: TaskCompletionClaim;
    summary: string;
    evidence?: string[];
  },
): TaskNode {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId];
    if (!task) throw new Error(`Task not found: ${input.taskId}`);
    const now = new Date().toISOString();
    const trace = {
      ...(task.trace ?? {}),
      last_worker_result: input.claim,
      last_worker_claim: input.claim,
      last_worker_summary: input.summary,
      last_worker_completed_at: now,
      last_worker_evidence: input.evidence ?? [],
    };
    task.status = "review";
    task.state = "review";
    task.blocker = undefined;
    task.trace = trace;
    tree.active_task_ids = activeIds(tree);
    tree.active_task_id = tree.active_task_ids[0] ?? null;
    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_worker_completed",
      task_id: task.id,
      result: input.claim,
      state: task.status,
      status: task.status,
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
    const now = new Date().toISOString();
    task.status = "done";
    task.state = "done";
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
    const outputs = normalizeStringArray(input.outputs);
    if (outputs.length === 0) throw new Error("Task outputs cannot be empty");
    task.outputs = outputs;
    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_outputs_updated",
      task_id: task.id,
      outputs,
    });
    return task;
  });
}

export function updateTaskText(config: ToolConfig, input: UpdateTaskTextInput): TaskNode {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId];
    if (!task) throw new Error(`Task not found: ${input.taskId}`);

    const hasGoal = typeof input.goal === "string";
    const hasAcceptance = input.acceptance !== undefined;
    const hasBlocker = typeof input.blocker === "string";
    const clearBlocker = input.clearBlocker === true;
    if (!hasGoal && !hasAcceptance && !hasBlocker && !clearBlocker) {
      throw new Error("Provide at least one of goal, acceptance, blocker, or clearBlocker");
    }

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
      const blocker = input.blocker?.trim() ?? "";
      task.blocker = blocker || undefined;
    }

    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_text_updated",
      task_id: task.id,
      goal_updated: hasGoal,
      acceptance_updated: hasAcceptance,
      blocker_updated: hasBlocker || clearBlocker,
      acceptance_count: acceptance?.length,
      blocked_state: task.blocker ? "present" : "cleared",
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
    if (task.status !== "blocked") throw new Error(`Task ${task.id} is ${task.status}, not blocked`);

    const reason = input.reason.trim();
    if (!reason) throw new Error("Unblock reason cannot be empty");

    const now = new Date().toISOString();
    task.status = "backlog";
    task.state = "backlog";
    task.blocker = undefined;
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
    });
    return task;
  });
}

export function rejectTaskReview(config: ToolConfig, input: RejectTaskReviewInput): TaskNode {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId];
    if (!task) throw new Error(`Task not found: ${input.taskId}`);
    if (task.status !== "review") throw new Error(`Task ${task.id} is ${task.status}, not review`);
    if (!isLeaf(task)) throw new Error(`Task ${task.id} is not a leaf`);
    const now = new Date().toISOString();
    const previousAttemptId =
      typeof task.trace?.current_attempt_id === "string" ? task.trace.current_attempt_id : undefined;
    task.status = "backlog";
    task.state = "backlog";
    task.blocker = undefined;
    task.trace = {
      ...(task.trace ?? {}),
      review_rejected_at: now,
      review_rejected_by: "task-tree-tool",
      review_reject_reason: input.reason,
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
      reason: input.reason,
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
