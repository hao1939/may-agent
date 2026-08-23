import type { TaskReconciliationContext } from "@may-agent/sdk";

export type ObservedTask = {
  id: string;
  item_type?: "group" | "task";
  phase?: string;
  parent_id?: string;
  children?: string[];
  outcome?: string;
  acceptance?: string[];
  agent?: string;
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
  truncated?: boolean;
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
  truncated: boolean;
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
    agent?: string;
    outcome?: string;
  }>;
};

export function taskState(tree: ObservedTaskTree, task: ObservedTask): string {
  return task.phase ?? "unknown";
}

export function taskObservation(
  reconciliation: TaskReconciliationContext | undefined,
): ObservedTaskTree {
  const children = reconciliation?.children;
  if (!children) return { tasks: {} };
  const snapshot = reconciliation.taskSnapshot;
  const live = snapshot ? snapshot.live : children.live;
  const completed = snapshot ? [] : children.completed;
  const all = [...live, ...completed];
  const conditions = Object.fromEntries(
    all.flatMap((child) =>
      child.conditions.map((condition) => [
        condition.id,
        {
          metadata: { id: condition.id },
          spec: {
            type: condition.type,
            subject: condition.subject,
            ...(Object.prototype.hasOwnProperty.call(condition, "expected")
              ? { expected: (condition as { expected?: unknown }).expected }
              : {}),
            ...(condition.owner ? { owner: condition.owner } : {}),
          },
        },
      ]),
    ),
  );
  return {
    tasks: Object.fromEntries(
      all.map((child) => [
        child.taskId,
        {
          id: child.taskId,
          item_type: "task",
          phase: child.status,
          parent_id: child.parentId,
          children: child.hasLiveChildren ? ["bounded-live-child"] : [],
          outcome: child.outcome,
          agent: child.agent,
          priority: child.priority,
          category: child.category,
          depends_on: child.dependsOn,
          ...(child.readiness
            ? {
                readiness: {
                  state: child.readiness.state,
                  reason: child.readiness.reason,
                  related_ids: child.readiness.relatedTaskIds,
                },
              }
            : {}),
          condition_ids: child.conditions.map(({ id }) => id),
        },
      ]),
    ),
    conditions,
    ...(snapshot ? { truncated: snapshot.truncated } : {}),
    active_task_ids: live
      .filter(({ status }) => status === "running")
      .map(({ taskId }) => taskId),
  };
}

function isLeaf(task: ObservedTask): boolean {
  return (task.children ?? []).length === 0;
}

export function planningObservation(
  tree: ObservedTaskTree,
  limit = 50,
): TaskPlanningObservation {
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
    truncated: tree.truncated === true,
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
      ...(task.agent ? { agent: task.agent } : {}),
      ...(task.outcome ? { outcome: task.outcome } : {}),
    })),
  };
}
