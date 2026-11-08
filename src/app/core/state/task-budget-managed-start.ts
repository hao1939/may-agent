import { reserveManagedTaskExecution } from "./task-execution-admission.js";
import { TaskExecutionStore, type ExecutionReservation, type ExecutionRecipient } from "./task-execution-store.js";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { SqliteDb } from "../../../lib/db.js";
import { stateTransaction } from "../../../lib/db/transaction.js";
import type { TaskBinding } from "../../../lib/persistence.js";
import { assertCurrentTaskActor } from "../tasks/task-actor.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { TaskBudgetAdmissionStore, TaskBudgetDeferredError } from "./task-budget-admission.js";

declare const primaryStart: unique symbol;
export type TaskPrimaryStart = { readonly [primaryStart]: true };
const primaryScopes = new WeakMap<TaskPrimaryStart, TaskBinding>();

/** Host adapter capability, never serialized, inherited by helpers, or selected
 * by source labels. Durable admission permits one covered primary per attempt. */
export function taskPrimaryStart(binding: TaskBinding): TaskPrimaryStart {
  const permit = Object.freeze({}) as TaskPrimaryStart;
  primaryScopes.set(permit, structuredClone(binding));
  return permit;
}

export type ManagedTaskStartAdmission = { invocationId: string; primaryCovered: boolean; reservation: ExecutionReservation | null };

/** Every actual managed start, including a resumed session, gets a fresh Host
 * invocation identity. Commit evidence before external dispatch; uncertainty
 * after admission remains charged. Session identity never grants free replay. */
export function admitManagedTaskStart(
  db: SqliteDb,
  input: {
    sessionId: string;
    binding?: TaskBinding;
    retainedBinding?: TaskBinding;
    primary?: TaskPrimaryStart;
    persistentChat?: boolean;
    recipient?: ExecutionRecipient | null;
    agent?: string;
  },
  now = Date.now(),
): ManagedTaskStartAdmission | null {
  const bound = input.binding ?? input.retainedBinding;
  if (!bound) {
    if (new TaskExecutionStore(db).configured())
      throw new Error("Shared execution limits require a bounded Task binding; direct-session admission is not configured");
    return null;
  }
  const admission = new TaskBudgetAdmissionStore(db);
  const task = { appId: bound.appId, taskId: bound.taskId };
  // Unconfigured installations keep their existing start path. Relevant starts
  // recheck authority and accounting under the shared write transaction.
  if (!admission.policy(task.appId) && !admission.budget.binding(task)) {
    if (new TaskExecutionStore(db).configured())
      throw new Error("Shared execution limits require explicit adoption of historical Task funding");
    return null;
  }
  return stateTransaction(db, () => {
    if (input.persistentChat) throw new Error("Budgeted Task execution requires a bounded managed session");
    if (!input.binding) throw new Error("Budgeted session start requires a current Task binding");
    const store = AppTaskResourceStore.activeFromDb(db, task.appId);
    if (!store || store.appId !== task.appId) throw new Error("Budgeted start requires canonical Task authority");
    assertCurrentTaskActor({ resourceStore: store }, bound, "managed start");
    if (!admission.budget.binding(task))
      throw new TaskBudgetDeferredError({
        kind: "deferred",
        reason: "adoption-required",
        task,
        root: task,
        retryAt: null,
      });
    const paidAttempt = admission.budget.receipt({ task, kind: "attempt", attemptId: bound.attemptId });
    if (!paidAttempt || paidAttempt.credits !== 1)
      throw new Error("Budgeted managed start requires its exact paid attempt");
    if (paidAttempt.purpose !== "ordinary") {
      const attempt = store.readAttempt(bound.attemptId)!;
      admission.assertProtectedTask(task, store.readTask(task.taskId)!, attempt.owner, attempt.handler);
    }
    if (input.primary && !isDeepStrictEqual(primaryScopes.get(input.primary), bound))
      throw new Error("Primary start capability does not match the live Task attempt");
    const covered =
      !!input.primary &&
      !db
        .prepare(
          `SELECT 1 FROM task_budget_managed_starts
       WHERE app_id = ? AND task_id = ? AND attempt_id = ? AND primary_covered = 1`,
        )
        .get(task.appId, task.taskId, bound.attemptId);
    const invocationId = randomUUID();
    const operationId = covered ? paidAttempt.operationId : admission.admitHelper(task, invocationId, now);
    const reservation = reserveManagedTaskExecution(db, { task, attemptId: bound.attemptId, generation: bound.generation,
      invocationId, sessionId: input.sessionId, primaryCovered: covered,
      recipient: input.recipient ?? null, agent: input.agent ?? store.readAttempt(bound.attemptId)!.owner }, now);
    db.prepare(
      `INSERT INTO task_budget_managed_starts(invocation_id, app_id, task_id, generation,
       attempt_id, session_id, primary_covered, operation_id, admitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      invocationId,
      task.appId,
      task.taskId,
      bound.generation,
      bound.attemptId,
      input.sessionId,
      covered ? 1 : 0,
      operationId,
      now,
    );
    return { invocationId, primaryCovered: covered, reservation };
  });
}
