import {
  readTaskTree,
  taskRevision,
  withTreeLock,
  type TaskNode,
  type TaskTreeConfig,
} from "./task-tree-store.ts";
import { saveTaskTreeWithKanbanSnapshot } from "./task-tree-tools.ts";
import {
  pendingActionDeliveryReceiptsFromSourceV2,
  type PendingActionDeliveryReceiptV2,
} from "./project-pending-actions-v2.ts";

function taskAttemptId(task: TaskNode): string | null {
  const trace =
    task.trace && typeof task.trace === "object" && !Array.isArray(task.trace)
      ? task.trace
      : {};
  for (const key of [
    "current_attempt_id",
    "worker_started_attempt_id",
    "previous_attempt_id",
  ]) {
    const value = trace[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function taskState(task: TaskNode): string {
  return String(task.state ?? task.status ?? "backlog");
}

function receiptSource(task: TaskNode): unknown[] {
  const value = task.trace?.pendingActionDeliveryReceiptsV2;
  return Array.isArray(value) ? value : [];
}

export function completionReviewDeliveryReceiptsV2(
  task: TaskNode,
  actionKey: string,
): PendingActionDeliveryReceiptV2[] {
  return pendingActionDeliveryReceiptsFromSourceV2(
    receiptSource(task),
    actionKey,
    "completion-review-delivery",
  );
}

export function appendCompletionReviewDeliveryReceiptV2(
  config: TaskTreeConfig,
  input: {
    taskId: string;
    taskRevision: number;
    attemptId: string;
    receipt: PendingActionDeliveryReceiptV2;
  },
): boolean {
  if (input.receipt.actionKind !== "completion-review-delivery") return false;
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId];
    if (
      !task ||
      taskRevision(task) !== input.taskRevision ||
      taskAttemptId(task) !== input.attemptId ||
      taskState(task) !== "review"
    ) {
      return false;
    }
    const source = receiptSource(task);
    const existing = completionReviewDeliveryReceiptsV2(
      task,
      input.receipt.actionKey,
    );
    if (
      existing.some(
        (receipt) =>
          receipt.attempt === input.receipt.attempt &&
          receipt.status === input.receipt.status,
      )
    ) {
      return true;
    }
    task.trace = {
      ...(task.trace ?? {}),
      pendingActionDeliveryReceiptsV2: [...source, input.receipt],
    };
    saveTaskTreeWithKanbanSnapshot(config, tree);
    return true;
  });
}
