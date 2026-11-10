import { isDeepStrictEqual } from "node:util";
import type { SqliteDb } from "../../../lib/db.js";
import { stateTransaction } from "../../../lib/db/transaction.js";
import type { TaskBinding } from "../../../lib/persistence.js";
import { currentProcessInstance, isProcessInstanceAlive } from "../../../lib/process-identity.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import type { BudgetTaskRef } from "./task-budget-store.js";
import { releaseTaskExecutionReservation } from "./task-execution-admission.js";
import { TaskExecutionStore } from "./task-execution-store.js";

type ConfirmSessionStopped = (sessionId: string, binding: TaskBinding) => boolean;

function attemptExecution(db: SqliteDb, task: BudgetTaskRef, attemptId: string) {
  const attempt = AppTaskResourceStore.inspectFromDb(db, task.appId).readAttempt(attemptId);
  if (!attempt || attempt.taskId !== task.taskId) return null;
  const receipts = new TaskExecutionStore(db)
    .activeForAttempt(task, attemptId)
    .sort((a, b) => a.operationId.localeCompare(b.operationId));
  const primary = db
    .prepare(
      `SELECT session_id FROM task_budget_managed_starts
    WHERE app_id = ? AND task_id = ? AND attempt_id = ? AND primary_covered = 1`,
    )
    .get(task.appId, task.taskId, attemptId)?.session_id as string | undefined;
  const sessions = [
    ...new Set(
      [
        attempt.sessionId,
        primary,
        ...receipts.map((receipt) =>
          receipt.request.operation.kind === "helper" ? receipt.request.operation.sessionId : undefined,
        ),
      ].filter((id): id is string => !!id),
    ),
  ].sort();
  return {
    receipts,
    sessions,
    binding: { ...task, generation: attempt.taskGeneration, attemptId },
    attemptVersion: attempt.metadata.resourceVersion,
  };
}

/** Local join and dead-worker recovery use the same exact session/start fences.
 * Session confirmation drains persisted Bash groups through the existing adapter.
 * No lease, runtime ID, Task phase, or terminal result can substitute for exit. */
function releaseAttemptExecution(
  db: SqliteDb,
  task: BudgetTaskRef,
  attemptId: string,
  mode: "joined" | "confirmed-recovery",
  confirmSessionStopped?: ConfirmSessionStopped,
): boolean {
  const snapshot = attemptExecution(db, task, attemptId);
  if (!snapshot?.receipts.length) return false;
  if (mode === "joined") {
    if (
      snapshot.receipts.some(
        (receipt) =>
          receipt.request.operation.kind !== "attempt" ||
          receipt.owner?.processIdentity !== currentProcessInstance().processIdentity,
      )
    )
      return false;
  } else if (snapshot.receipts.some((receipt) => !receipt.owner || isProcessInstanceAlive(receipt.owner))) {
    // Historical receipts without process-instance evidence remain occupied.
    return false;
  }
  for (const id of snapshot.sessions) if (!confirmSessionStopped?.(id, snapshot.binding)) return false;
  return stateTransaction(db, () => {
    // Cleanup runs outside SQL. Fence racing starts, session attachments and
    // concurrent recovery before releasing any place or waking constrained work.
    if (!isDeepStrictEqual(snapshot, attemptExecution(db, task, attemptId))) return false;
    for (const receipt of snapshot.receipts)
      releaseTaskExecutionReservation(db, receipt, { kind: mode, evidenceId: attemptId });
    return true;
  });
}

/** Only the local caller whose execution body has unwound can supply a join. */
export function releaseJoinedTaskAttemptExecution(
  db: SqliteDb,
  task: BudgetTaskRef,
  attemptId: string,
  confirmSessionStopped?: ConfirmSessionStopped,
): boolean {
  return releaseAttemptExecution(db, task, attemptId, "joined", confirmSessionStopped);
}

/** Exact-Task recovery is mechanical and visits active execution only, including
 * ended Tasks. One blocked attempt cannot prevent another from releasing. */
export function recoverDeadTaskExecution(
  db: SqliteDb,
  task: BudgetTaskRef,
  confirmSessionStopped?: ConfirmSessionStopped,
): number {
  const executions = new TaskExecutionStore(db);
  let released = 0;
  for (const attemptId of new Set(
    executions.activeForTask(task).map((receipt) => receipt.request.operation.attemptId!),
  )) {
    try {
      if (releaseAttemptExecution(db, task, attemptId, "confirmed-recovery", confirmSessionStopped)) released++;
    } catch {
      // Failed session/descendant cleanup retains occupancy. The existing
      // indexed recovery scheduler will revisit it without starting a model.
    }
  }
  return released;
}

/** Cheap scheduler preflight only. The worker must still confirm all descendants. */
export function hasDeadTaskExecutionOwner(db: SqliteDb, task: BudgetTaskRef): boolean {
  return new TaskExecutionStore(db)
    .activeForTask(task)
    .some((receipt) => receipt.owner !== undefined && !isProcessInstanceAlive(receipt.owner));
}

export function taskExecutionRecoveryPage(db: SqliteDb, appId: string, limit: number, afterTaskId?: string) {
  const page = new TaskExecutionStore(db).activeTaskPage(appId, limit, afterTaskId);
  return { ...page, taskIds: page.taskIds.filter((taskId) => hasDeadTaskExecutionOwner(db, { appId, taskId })) };
}
