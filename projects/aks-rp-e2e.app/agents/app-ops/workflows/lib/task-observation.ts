import { readFileSync } from "node:fs";
import { resolveTaskTreePath } from "@may-agent/sdk";

export type ObservedTask = {
  id: string;
  item_type?: "group" | "task";
  phase?: string;
  parent_id?: string;
  children?: string[];
  outcome?: string;
  acceptance?: string[];
  owner?: string;
  priority?: string;
  category?: string;
  readiness?: { state?: string; reason?: string; related_ids?: string[] };
  depends_on?: string[];
  input?: Record<string, unknown>;
  trigger?: Record<string, unknown>;
  condition_ids?: string[];
  context?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ObservedTaskTree = {
  tasks: Record<string, ObservedTask>;
  satisfied_dependency_ids?: string[];
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
    phase: string;
    owner?: string;
    outcome?: string;
  }>;
};

export function taskState(tree: ObservedTaskTree, task: ObservedTask): string {
  return task.phase ?? "unknown";
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

export function planningObservation(
  appDir: string,
  limit = 50,
): TaskPlanningObservation {
  const tree = readTaskObservation(appDir);
  const counts: Record<string, number> = {};
  const leaves = Object.values(tree.tasks).filter(
    (task) => task.item_type === "task" && isLeaf(task),
  );
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
    ...new Set([...(tree.active_task_ids ?? []), ...ids("running")]),
  ];
  const runnable = leaves
    .filter((task) => task.readiness?.state === "ready")
    .map((task) => task.id)
    .sort()
    .slice(0, limit);
  return {
    counts,
    active_task_ids: active,
    frontier: {
      review: ids("attention"),
      runnable,
      waiting: ids("waiting"),
    },
    tasks: leaves.slice(0, limit).map((task) => ({
      id: task.id,
      phase: taskState(tree, task),
      ...(task.owner ? { owner: task.owner } : {}),
      ...(task.outcome ? { outcome: task.outcome } : {}),
    })),
  };
}
