import { readFileSync } from "node:fs";
import { resolveTaskTreePath } from "@may-agent/sdk";

export type ObservedTask = {
  id: string;
  state?: string;
  parent_id?: string;
  children?: string[];
  goal?: string;
  acceptance?: string[];
  owner?: string;
  priority?: string;
  blocker?: unknown;
  kind?: string;
  context?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ObservedTaskTree = {
  tasks: Record<string, ObservedTask>;
  resources?: Record<
    string,
    {
      metadata?: { id?: string; generation?: number; resourceVersion?: number };
      spec?: {
        input?: Record<string, unknown>;
        owner?: string;
        [key: string]: unknown;
      };
      status?: { phase?: string; conditionIds?: string[] };
    }
  >;
  receipts?: Record<string, unknown>;
  conditions?: Record<
    string,
    {
      metadata?: { id?: string };
      spec?: {
        type?: string;
        subject?: string;
        expected?: unknown;
        owner?: string;
      };
    }
  >;
  taskTriggers?: Record<
    string,
    { taskId?: string; event?: Record<string, unknown> }
  >;
  active_task_ids?: string[];
};

export type TaskPlanningObservation = {
  counts: Record<string, number>;
  active_task_ids: string[];
  frontier: {
    review: string[];
    runnable: string[];
    waiting: string[];
  };
  tasks: Array<{
    id: string;
    state: string;
    owner?: string;
    goal?: string;
  }>;
};

export function taskState(tree: ObservedTaskTree, task: ObservedTask): string {
  return tree.resources?.[task.id]?.status?.phase ?? task.state ?? "backlog";
}

export function readTaskObservation(appDir: string): ObservedTaskTree {
  const parsed = JSON.parse(
    readFileSync(resolveTaskTreePath(appDir), "utf8"),
  ) as Partial<ObservedTaskTree>;
  return { ...parsed, tasks: parsed.tasks ?? {} };
}

function isLeaf(task: ObservedTask): boolean {
  return (task.children ?? []).length === 0;
}

function dependenciesOpen(tree: ObservedTaskTree, task: ObservedTask): boolean {
  const dependencies = Array.isArray(task.depends_on)
    ? task.depends_on.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  return dependencies.some(
    (id) =>
      tree.tasks[id] &&
      taskState(tree, tree.tasks[id]) !== "done" &&
      !tree.receipts?.[id],
  );
}

export function planningObservation(
  appDir: string,
  limit = 50,
): TaskPlanningObservation {
  const tree = readTaskObservation(appDir);
  const counts: Record<string, number> = {};
  const leaves = Object.values(tree.tasks).filter(isLeaf);
  for (const task of leaves) {
    const state = taskState(tree, task);
    counts[state] = (counts[state] ?? 0) + 1;
  }
  const ids = (state: string) =>
    leaves
      .filter((task) => taskState(tree, task) === state)
      .map((task) => task.id)
      .sort()
      .slice(0, limit);
  const active = [
    ...new Set([
      ...(tree.active_task_ids ?? []),
      ...ids("active"),
      ...ids("running"),
    ]),
  ];
  const runnable = leaves
    .filter((task) =>
      ["backlog", "pending", "ready"].includes(taskState(tree, task)),
    )
    .filter((task) => !dependenciesOpen(tree, task))
    .map((task) => task.id)
    .sort()
    .slice(0, limit);
  return {
    counts,
    active_task_ids: active,
    frontier: {
      review: [...new Set([...ids("review"), ...ids("attention")])],
      runnable,
      waiting: [...new Set([...ids("blocked"), ...ids("waiting")])],
    },
    tasks: leaves.slice(0, limit).map((task) => ({
      id: task.id,
      state: taskState(tree, task),
      ...(task.owner ? { owner: task.owner } : {}),
      ...(task.goal ? { goal: task.goal } : {}),
    })),
  };
}
