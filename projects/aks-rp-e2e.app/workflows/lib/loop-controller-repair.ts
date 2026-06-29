import {
  markTaskDone,
  peekTaskAssignments,
  requeueStaleActiveTasks,
  type TaskAssignment,
} from "./task-tree-tools.ts";
import { readTaskTree, type TaskNode } from "./task-tree-store.ts";
import type { TaskTreeConfig } from "./task-tree-tools.ts";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

function taskStatus(task: TaskNode): string {
  return String(task.status ?? task.state ?? "");
}

function taskTrace(task: TaskNode): Record<string, unknown> {
  return task.trace &&
    typeof task.trace === "object" &&
    !Array.isArray(task.trace)
    ? (task.trace as Record<string, unknown>)
    : {};
}

function traceString(task: TaskNode, key: string): string {
  const value = taskTrace(task)[key];
  return typeof value === "string" ? value : "";
}

function timestampMs(value: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function assignmentOutboxPath(config: TaskTreeConfig): string {
  return join(config.appDir, ".state", "task-assignments.jsonl");
}

export function consumeDispatchedAssignments(
  config: TaskTreeConfig,
  assignments: TaskAssignment[],
): number {
  if (assignments.length === 0) return 0;
  const path = assignmentOutboxPath(config);
  if (!existsSync(path)) return 0;

  const consumedKeys = new Set(
    assignments.map(
      (assignment) => `${assignment.taskId}:${assignment.attemptId}`,
    ),
  );
  let consumed = 0;
  const keptLines = readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .filter((line) => {
      try {
        const assignment = JSON.parse(line) as TaskAssignment;
        const key = `${assignment.taskId}:${assignment.attemptId}`;
        if (!consumedKeys.has(key)) return true;
        consumed += 1;
        return false;
      } catch {
        return true;
      }
    });

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    keptLines.length ? `${keptLines.join("\n")}\n` : "",
    "utf8",
  );
  return consumed;
}

export function requeueOrphanedActiveChildren(
  config: TaskTreeConfig,
  input: {
    loopTaskId: string;
    isChild: (task: TaskNode) => boolean;
    minAgeMs?: number;
    now?: Date;
    reason?: string;
  },
): string[] {
  const tree = readTaskTree(config);
  const loopTask = tree.tasks[input.loopTaskId];
  if (!loopTask) return [];

  const queuedAssignments = new Set(
    peekTaskAssignments(config).map(
      (assignment) => `${assignment.taskId}:${assignment.attemptId}`,
    ),
  );
  const nowMs = (input.now ?? new Date()).getTime();
  const minAgeMs = Math.max(0, input.minAgeMs ?? 600_000);
  const orphanedTaskIds: string[] = [];

  for (const childId of loopTask.children ?? []) {
    const child = tree.tasks[childId];
    if (!child || !input.isChild(child) || taskStatus(child) !== "active") {
      continue;
    }

    const attemptId = traceString(child, "current_attempt_id");
    const startedAttemptId = traceString(child, "worker_started_attempt_id");
    if (attemptId && startedAttemptId === attemptId) continue;
    if (attemptId && queuedAssignments.has(`${child.id}:${attemptId}`))
      continue;

    const assignedAtMs = timestampMs(traceString(child, "assigned_at"));
    if (assignedAtMs !== null && nowMs - assignedAtMs < minAgeMs) continue;

    orphanedTaskIds.push(child.id);
  }

  if (orphanedTaskIds.length === 0) return [];
  return requeueStaleActiveTasks(config, {
    taskIds: orphanedTaskIds,
    reason:
      input.reason ??
      "loop-controller found active child assignment with no queued assignment and no worker start",
  });
}

export function acceptDoneReviewChildren(
  config: TaskTreeConfig,
  input: {
    loopTaskId: string;
    isChild: (task: TaskNode) => boolean;
    summaryPrefix: string;
  },
): string[] {
  return acceptReviewChildren(config, {
    ...input,
    shouldAcceptResult: (result) => result === "done",
  });
}

export function acceptTerminalReviewChildren(
  config: TaskTreeConfig,
  input: {
    loopTaskId: string;
    isChild: (task: TaskNode) => boolean;
    summaryPrefix: string;
  },
): string[] {
  const terminalResults = new Set([
    "done",
    "partial",
    "blocked",
    "fail",
    "error",
  ]);
  return acceptReviewChildren(config, {
    ...input,
    shouldAcceptResult: (result) => terminalResults.has(result),
    resolutionForResult: (result) =>
      result === "done" ? "completed" : "terminal",
  });
}

function acceptReviewChildren(
  config: TaskTreeConfig,
  input: {
    loopTaskId: string;
    isChild: (task: TaskNode) => boolean;
    summaryPrefix: string;
    shouldAcceptResult: (result: string) => boolean;
    resolutionForResult?: (result: string) => string;
  },
): string[] {
  const tree = readTaskTree(config);
  const loopTask = tree.tasks[input.loopTaskId];
  if (!loopTask) return [];

  const reviewTaskIds = (loopTask.children ?? []).filter((childId) => {
    const child = tree.tasks[childId];
    if (!child || !input.isChild(child) || taskStatus(child) !== "review") {
      return false;
    }
    return input.shouldAcceptResult(traceString(child, "last_worker_result"));
  });

  const accepted: string[] = [];
  for (const taskId of reviewTaskIds) {
    const latest = readTaskTree(config).tasks[taskId];
    if (!latest || taskStatus(latest) !== "review") continue;
    const result = traceString(latest, "last_worker_result");
    const lastSummary = traceString(latest, "last_worker_summary");
    markTaskDone(config, {
      taskId,
      summary: `${input.summaryPrefix}${lastSummary ? ` ${lastSummary}` : ""}`,
      resolution: input.resolutionForResult?.(result),
    });
    accepted.push(taskId);
  }
  return accepted;
}
