import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  dependenciesSatisfied,
  isClearEnough,
  isLeaf,
  normalizeStringArray,
  readTaskTree,
  saveTaskTree,
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
  roots: string[];
  active_task_ids: string[];
  counts: Record<string, number>;
  frontier: {
    ready: string[];
    active: string[];
    review: string[];
    claimed_done: string[];
    blocked: string[];
    proposed: string[];
  };
};

export type TaskKanbanColumn =
  | "planning"
  | "backlog"
  | "ready"
  | "in-progress"
  | "review"
  | "blocked"
  | "done"
  | "archive";

export type TaskKanbanProjection = {
  total_cards: number;
  tree_total: number;
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

export type TaskPlanningPacket = TaskTreeSummary & {
  frontier_details: {
    ready: TaskPlanningSnapshot[];
    active: TaskPlanningSnapshot[];
    review: TaskPlanningSnapshot[];
    blocked: TaskPlanningSnapshot[];
    proposed: TaskPlanningSnapshot[];
  };
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

export type ReadyAssignmentResult = {
  assignments: TaskAssignment[];
  skipped: Array<{ taskId: string; reason: string }>;
};

export type CreateTaskInput = {
  id: string;
  parentId: string;
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
  if (isPlanningTask(task) && ["proposed", "backlog", "ready", "active"].includes(task.status)) return "planning";
  if (task.status === "proposed") return "backlog";
  if (task.status === "backlog") return "backlog";
  if (task.status === "ready") return "backlog";
  if (task.status === "active") return "in-progress";
  if (task.status === "review" || task.status === "claimed_done" || task.status === "rejected") return "review";
  if (task.status === "blocked") return hasExternalBlockSignal(task) ? "blocked" : "review";
  if (task.status === "accepted") return "done";
  if (task.status === "superseded") return "archive";
  return null;
}

function emptyKanbanColumns(): Record<TaskKanbanColumn, string[]> {
  return {
    planning: [],
    backlog: [],
    ready: [],
    "in-progress": [],
    review: [],
    blocked: [],
    done: [],
    archive: [],
  };
}

function summarizeKanbanLoadedTree(tree: TaskTree): TaskKanbanProjection {
  const tasks = Object.values(tree.tasks ?? {});
  const statusCounts: Record<string, number> = {};
  for (const task of tasks) {
    statusCounts[task.status] = (statusCounts[task.status] ?? 0) + 1;
  }
  const cardIdsByColumn = emptyKanbanColumns();
  for (const task of tasks.filter((task) => task.id !== tree.root_task_id && isLeaf(task)).sort(taskSort)) {
    const column = taskKanbanColumn(task);
    if (column) cardIdsByColumn[column].push(task.id);
  }
  const columnCounts = Object.fromEntries(
    Object.entries(cardIdsByColumn).map(([column, ids]) => [column, ids.length]),
  ) as Record<TaskKanbanColumn, number>;
  const totalCards = Object.values(columnCounts).reduce((sum, count) => sum + count, 0);
  const settled = columnCounts.done + columnCounts.blocked + columnCounts.archive;
  return {
    total_cards: totalCards,
    tree_total: tasks.length,
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

function saveTaskTreeWithKanbanSnapshot(config: ToolConfig, tree: TaskTree): TaskKanbanSnapshot {
  saveTaskTree(config, tree);
  return writeKanbanSnapshotForTree(config, tree);
}

function activeIds(tree: TaskTree): string[] {
  return Object.values(tree.tasks)
    .filter((task) => isLeaf(task) && task.status === "active")
    .sort(taskSort)
    .map((task) => task.id);
}

function frontierIds(tree: TaskTree, status: string): string[] {
  return Object.values(tree.tasks)
    .filter((task) => isLeaf(task) && task.status === status)
    .sort(taskSort)
    .slice(0, 20)
    .map((task) => task.id);
}

function isAssignableBacklogStatus(status: string): boolean {
  return status === "backlog" || status === "ready";
}

function frontierAssignableIds(tree: TaskTree): string[] {
  return Object.values(tree.tasks)
    .filter((task) => isLeaf(task) && isAssignableBacklogStatus(task.status))
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
  return {
    id: task.id,
    parent_id: task.parent_id,
    status: task.status,
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
    .filter((task) => isLeaf(task) && isAssignableBacklogStatus(task.status))
    .sort(taskSort)
    .slice(0, 8)
    .map(compactTask);
}

function summarizeLoadedTree(tree: TaskTree): TaskTreeSummary {
  const tasks = tree.tasks ?? {};
  const counts: Record<string, number> = {};
  for (const task of Object.values(tasks)) {
    counts[task.status] = (counts[task.status] ?? 0) + 1;
  }
  const childIds = new Set(Object.values(tasks).flatMap((task) => normalizeStringArray(task.children)));
  return {
    updated_at: tree.updated_at,
    total: Object.keys(tasks).length,
    roots: Object.keys(tasks)
      .filter((id) => !childIds.has(id))
      .sort(),
    active_task_ids: activeIds(tree),
    counts,
    frontier: {
      ready: frontierAssignableIds(tree),
      active: frontierIds(tree, "active"),
      review: [...frontierIds(tree, "review"), ...frontierIds(tree, "claimed_done")],
      claimed_done: frontierIds(tree, "claimed_done"),
      blocked: frontierIds(tree, "blocked"),
      proposed: frontierIds(tree, "proposed"),
    },
  };
}

export function summarizeTaskTree(config: ToolConfig): TaskTreeSummary {
  if (!existsSync(config.treePath))
    return {
      total: 0,
      roots: [],
      active_task_ids: [],
      counts: {},
      frontier: {
        ready: [],
        active: [],
        review: [],
        claimed_done: [],
        blocked: [],
        proposed: [],
      },
    };

  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    return summarizeLoadedTree(tree);
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

export function planningPacket(config: ToolConfig): TaskPlanningPacket {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const summary = summarizeLoadedTree(tree);
    return {
      ...summary,
      frontier_details: {
        ready: frontierAssignableDetails(tree),
        active: frontierDetails(tree, "active"),
        review: [...frontierDetails(tree, "review"), ...frontierDetails(tree, "claimed_done")].slice(0, 8),
        blocked: frontierDetails(tree, "blocked"),
        proposed: frontierDetails(tree, "proposed"),
      },
    };
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
  const sessionId =
    typeof task.session_id === "string" && task.session_id.trim() ? task.session_id.trim() : stableTaskSessionId(task);
  const worker = input.worker ?? task.owner ?? config.worker;
  task.status = "active";
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
      task.status = "ready";
      task.trace = {
        ...(task.trace ?? {}),
        stale_active_requeued_at: now,
        stale_active_requeue_reason: input.reason ?? "session-not-running",
        previous_attempt_id:
          task.trace && typeof task.trace.current_attempt_id === "string" ? task.trace.current_attempt_id : undefined,
        current_attempt_id: undefined,
      };
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

export function assignReadyTasks(
  config: ToolConfig,
  input: {
    worker?: string;
    limit?: number;
  } = {},
): ReadyAssignmentResult {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const assignments: TaskAssignment[] = [];
    const skipped: ReadyAssignmentResult["skipped"] = [];
    const capacity = Math.max(0, config.maxConcurrent - activeLeaves(tree).length);
    const limit = Math.max(0, Math.min(input.limit ?? capacity, capacity));
    if (limit <= 0) return { assignments, skipped };

    for (const task of Object.values(tree.tasks)
      .filter((candidate) => isAssignableBacklogStatus(candidate.status))
      .sort(taskSort)) {
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
    if (!isAssignableBacklogStatus(task.status))
      throw new Error(`Task ${task.id} is ${task.status}, not backlog/ready`);
    if (!isLeaf(task)) throw new Error(`Task ${task.id} is not a leaf`);
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
    const status = input.status ?? "proposed";
    if (status === "blocked" && !input.blocker?.trim()) throw new Error("Blocked tasks require --blocker");
    if (status !== "blocked" && input.blocker?.trim()) throw new Error("--blocker is only valid with --status blocked");

    const task: TaskNode = {
      id: input.id,
      parent_id: input.parentId,
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
      status: task.status,
    });
    return task;
  });
}

export function promoteClearProposedLeaves(config: ToolConfig, limit = 10): string[] {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const promoted: string[] = [];
    const candidates = Object.values(tree.tasks)
      .filter((task) => task.status === "proposed" && isLeaf(task))
      .sort(taskSort);
    for (const task of candidates) {
      if (promoted.length >= limit) break;
      if (!isClearEnough(task)) continue;
      if (!dependenciesSatisfied(tree, task)) continue;
      task.status = "ready";
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
        kind: "tasks_promoted",
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
    task.blocker = undefined;
    task.trace = trace;
    tree.active_task_ids = activeIds(tree);
    tree.active_task_id = tree.active_task_ids[0] ?? null;
    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_worker_completed",
      task_id: task.id,
      result: input.claim,
      status: task.status,
      summary: input.summary,
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
