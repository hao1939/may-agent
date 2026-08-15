#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeVisibleFrontier } from "./lib/task-frontier.ts";

type JsonObject = Record<string, unknown>;

type TaskRecord = Record<string, any>;

type TaskTree = {
  resources?: Record<string, any>;
  tasks?: Record<string, TaskRecord>;
  conditions?: Record<string, any>;
  attempts?: Record<string, any>;
  active_task_ids?: string[];
  [key: string]: any;
};

function usage(): never {
  console.error(`Usage:
  bun run task-tree summary [--json]
  bun run task-tree packet [--json]
  bun run task-tree frontier [--limit N] [--json]
  bun run task-tree show <task-id> [--json]`);
  process.exit(1);
}

function loadTree(appDir: string): TaskTree {
  return JSON.parse(
    readFileSync(join(appDir, ".state", "tasks", "state.json"), "utf8"),
  ) as TaskTree;
}

function taskPhase(tree: TaskTree, taskId: string): string {
  const resourcePhase = (tree.resources?.[taskId] as any)?.status?.phase;
  const projectedState = (tree.tasks?.[taskId] as any)?.state;
  return String(resourcePhase ?? projectedState ?? "unknown");
}

function isLeaf(task: TaskRecord | undefined): boolean {
  return !Array.isArray(task?.children) || task.children.length === 0;
}

function preview(ids: string[], limit = 8): string {
  if (!ids.length) return "[none]";
  if (ids.length <= limit) return `[${ids.join(", ")}]`;
  return `[${ids.slice(0, limit).join(", ")} (+${ids.length - limit} more)]`;
}

function json(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function parseLimit(args: string[], fallback: number): number {
  const index = args.findIndex((arg) => arg === "--limit");
  if (index === -1) return fallback;
  const raw = args[index + 1];
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function cleanTaskView(tree: TaskTree, taskId: string): JsonObject {
  const task = (tree.tasks?.[taskId] ?? null) as TaskRecord | null;
  const resource = ((tree.resources?.[taskId] as any) ??
    null) as JsonObject | null;
  const receipt = ((tree.receipts?.[taskId] as any) ??
    null) as JsonObject | null;
  const conditionIds = [
    ...new Set([
      ...((task?.condition_ids as string[] | undefined) ?? []),
      ...(((resource as any)?.status?.conditionIds as string[] | undefined) ??
        []),
    ]),
  ];
  const conditions = conditionIds.map((conditionId) => ({
    id: conditionId,
    condition: ((tree.conditions as any)?.[conditionId] ?? null) as unknown,
  }));
  return {
    id: taskId,
    phase: taskPhase(tree, taskId),
    isLeaf: isLeaf(task ?? undefined),
    task,
    resource,
    receipt,
    conditions,
  };
}

function showSummary(tree: TaskTree, asJson: boolean): void {
  const frontier = computeVisibleFrontier(tree);
  const summary = {
    project: (tree as any).project ?? null,
    rootTaskId: (tree as any).root_task_id ?? null,
    activeTaskId: (tree as any).active_task_id ?? null,
    updatedAt: (tree as any).updated_at ?? null,
    counts: frontier.counts,
    visiblePacket: {
      active: frontier.active,
      review: frontier.review,
      runnable: frontier.runnable,
      waiting: frontier.waiting,
      blocked: frontier.blocked,
    },
  };
  if (asJson) return json(summary);
  console.log(`Task-tree summary at ${summary.updatedAt ?? "unknown"}`);
  console.log(
    `project=${summary.project ?? "unknown"} root=${summary.rootTaskId ?? "unknown"} active_task_id=${summary.activeTaskId ?? "none"}`,
  );
  console.log(
    `counts: active=${frontier.counts.active} review=${frontier.counts.review} runnable=${frontier.counts.runnable} waiting=${frontier.counts.waiting} blocked=${frontier.counts.blocked}`,
  );
  console.log(`active: ${preview(frontier.active)}`);
  console.log(`review: ${preview(frontier.review)}`);
  console.log(`runnable: ${preview(frontier.runnable)}`);
  console.log(`waiting: ${preview(frontier.waiting)}`);
}

function showPacket(tree: TaskTree, asJson: boolean): void {
  const frontier = computeVisibleFrontier(tree);
  const packet = {
    updatedAt: frontier.observedTreeUpdatedAt,
    activeTaskIds: frontier.active,
    reviewTaskIds: frontier.review,
    runnableTaskIds: frontier.runnable,
    waitingTaskIds: frontier.waiting,
    blockedTaskIds: frontier.blocked,
    allVisibleTaskIds: frontier.allVisible,
    counts: frontier.counts,
  };
  if (asJson) return json(packet);
  console.log(`Task-tree packet at ${packet.updatedAt}`);
  console.log(`active=${JSON.stringify(packet.activeTaskIds)}`);
  console.log(`review=${JSON.stringify(packet.reviewTaskIds)}`);
  console.log(`runnable=${JSON.stringify(packet.runnableTaskIds)}`);
  console.log(`waiting=${JSON.stringify(packet.waitingTaskIds)}`);
  console.log(`blocked=${JSON.stringify(packet.blockedTaskIds)}`);
}

function showFrontier(tree: TaskTree, args: string[], asJson: boolean): void {
  const frontier = computeVisibleFrontier(tree);
  const limit = parseLimit(args, 20);
  const result = {
    updatedAt: frontier.observedTreeUpdatedAt,
    counts: frontier.counts,
    active: frontier.active.slice(0, limit),
    review: frontier.review.slice(0, limit),
    runnable: frontier.runnable.slice(0, limit),
    waiting: frontier.waiting.slice(0, limit),
    blocked: frontier.blocked.slice(0, limit),
    truncated: {
      active: Math.max(0, frontier.active.length - limit),
      review: Math.max(0, frontier.review.length - limit),
      runnable: Math.max(0, frontier.runnable.length - limit),
      waiting: Math.max(0, frontier.waiting.length - limit),
      blocked: Math.max(0, frontier.blocked.length - limit),
    },
  };
  if (asJson) return json(result);
  console.log(`Task-tree frontier at ${result.updatedAt} (limit ${limit})`);
  console.log(
    `active (${frontier.counts.active}): ${preview(result.active, limit)}`,
  );
  console.log(
    `review (${frontier.counts.review}): ${preview(result.review, limit)}`,
  );
  console.log(
    `runnable (${frontier.counts.runnable}): ${preview(result.runnable, limit)}`,
  );
  console.log(
    `waiting (${frontier.counts.waiting}): ${preview(result.waiting, limit)}`,
  );
  console.log(
    `blocked (${frontier.counts.blocked}): ${preview(result.blocked, limit)}`,
  );
}

function showTask(tree: TaskTree, taskId: string, asJson: boolean): void {
  if (
    !tree.tasks?.[taskId] &&
    !tree.resources?.[taskId] &&
    !tree.receipts?.[taskId]
  ) {
    console.error(`Task not found: ${taskId}`);
    process.exit(1);
  }
  const view = cleanTaskView(tree, taskId);
  if (asJson) return json(view);
  const task = view.task as TaskRecord | null;
  const resource = view.resource as TaskRecord | null;
  console.log(`Task ${taskId}`);
  console.log(`phase: ${view.phase}`);
  console.log(`owner: ${task?.owner ?? task?.worker ?? "unknown"}`);
  console.log(`priority: ${task?.priority ?? "unknown"}`);
  console.log(`parent: ${task?.parent_id ?? "none"}`);
  console.log(`children: ${JSON.stringify(task?.children ?? [])}`);
  if (task?.goal) console.log(`goal: ${task.goal}`);
  if (task?.summary) console.log(`summary: ${task.summary}`);
  if (task?.result) console.log(`result: ${task.result}`);
  if (task?.acceptance)
    console.log(`acceptance: ${JSON.stringify(task.acceptance)}`);
  if (task?.context)
    console.log(`context: ${JSON.stringify(task.context, null, 2)}`);
  if (resource?.status)
    console.log(`resource.status: ${JSON.stringify(resource.status, null, 2)}`);
  if (resource?.spec)
    console.log(`resource.spec: ${JSON.stringify(resource.spec, null, 2)}`);
  if (view.receipt)
    console.log(`receipt: ${JSON.stringify(view.receipt, null, 2)}`);
}

function main(): void {
  const [, , command, ...args] = process.argv;
  if (!command) usage();
  const appDir = process.cwd();
  const tree = loadTree(appDir);
  const asJson = hasFlag(args, "--json");

  switch (command) {
    case "summary":
      return showSummary(tree, asJson);
    case "packet":
      return showPacket(tree, asJson);
    case "frontier":
      return showFrontier(tree, args, asJson);
    case "show": {
      const taskId = args.find((arg) => !arg.startsWith("--"));
      if (!taskId) usage();
      return showTask(tree, taskId, asJson);
    }
    default:
      usage();
  }
}

main();
