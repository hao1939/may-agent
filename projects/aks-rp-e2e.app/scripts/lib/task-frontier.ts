type TaskTree = {
  root_task_id?: string;
  resources?: Record<string, any>;
  tasks?: Record<string, any>;
  receipts?: Record<string, any>;
  updated_at?: string;
};

export type VisibleFrontier = {
  observedTreeUpdatedAt: string;
  active: string[];
  review: string[];
  waiting: string[];
  runnable: string[];
  blocked: string[];
  allVisible: string[];
  counts: {
    active: number;
    review: number;
    waiting: number;
    runnable: number;
    blocked: number;
  };
};

function taskState(tree: TaskTree, taskId: string): string {
  const resourcePhase = tree.resources?.[taskId]?.status?.phase;
  const projected = tree.tasks?.[taskId] ?? {};
  return String(
    resourcePhase ?? projected.state ?? projected.phase ?? "unknown",
  );
}

function taskWorkflow(task: any): string {
  return String(task?.workflow ?? task?.spec?.workflow ?? "").trim();
}

function isLeaf(task: any): boolean {
  return !Array.isArray(task?.children) || task.children.length === 0;
}

function dependenciesOpen(tree: TaskTree, task: any): boolean {
  const dependsOn = Array.isArray(task?.depends_on)
    ? task.depends_on.filter(
        (value: unknown): value is string => typeof value === "string",
      )
    : typeof task?.depends_on === "string"
      ? [task.depends_on]
      : [];
  return dependsOn.some(
    (taskId: string) =>
      Boolean(tree.tasks?.[taskId]) &&
      taskState(tree, taskId) !== "done" &&
      !Object.hasOwn(tree.receipts ?? {}, taskId),
  );
}

function dependencyBlocked(tree: TaskTree, task: any, state: string): boolean {
  return (
    ["backlog", "pending", "ready"].includes(state) &&
    (String(task?.readiness?.state ?? "") === "dependency-blocked" ||
      dependenciesOpen(tree, task))
  );
}

function unique(ids: string[]): string[] {
  return [...new Set(ids.filter((value) => value.trim()))];
}

/** Read-only projection used by local diagnostics; scheduling stays in the host. */
export function computeVisibleFrontier(
  tree: TaskTree,
  options: { excludeTaskIds?: string[] } = {},
): VisibleFrontier {
  const excluded = new Set(options.excludeTaskIds ?? []);
  const visibleTasks = Object.entries(tree.tasks ?? {})
    .filter(
      ([id]) =>
        id !== tree.root_task_id &&
        !id.startsWith("runtime/") &&
        !excluded.has(id),
    )
    .map(([id, task]) => ({ id, task, state: taskState(tree, id) }));
  const leaves = visibleTasks.filter(({ task }) => isLeaf(task));
  const exactRepoWaits = leaves
    .filter(({ task }) => taskWorkflow(task) === "wait-for-repo-ref-advance")
    .map(({ id }) => id);
  const byState = (
    items: Array<{ id: string; state: string }>,
    states: string[],
  ) => items.filter(({ state }) => states.includes(state)).map(({ id }) => id);
  const active = leaves
    .filter(
      ({ state, task }) =>
        ["active", "running"].includes(state) &&
        taskWorkflow(task) !== "wait-for-repo-ref-advance",
    )
    .map(({ id }) => id)
    .sort();
  const review = byState(visibleTasks, ["review", "attention"]).sort();
  const waiting = unique([
    ...byState(visibleTasks, ["waiting", "blocked"]),
    ...exactRepoWaits,
  ]).sort();
  const runnable = leaves
    .filter(
      ({ state, task }) =>
        ["backlog", "pending", "ready"].includes(state) &&
        !dependencyBlocked(tree, task, state) &&
        taskWorkflow(task) !== "wait-for-repo-ref-advance",
    )
    .map(({ id }) => id)
    .sort();
  const blocked = visibleTasks
    .filter(({ state, task }) => dependencyBlocked(tree, task, state))
    .map(({ id }) => id)
    .sort();
  return {
    observedTreeUpdatedAt: String(tree.updated_at ?? ""),
    active,
    review,
    waiting,
    runnable,
    blocked,
    allVisible: unique([
      ...active,
      ...review,
      ...runnable,
      ...waiting,
      ...blocked,
    ]),
    counts: {
      active: active.length,
      review: review.length,
      waiting: waiting.length,
      runnable: runnable.length,
      blocked: blocked.length,
    },
  };
}
