import { requireLocalTaskAttemptExecution, reserveManagedTaskExecution } from "./task-execution-admission.js";
import { TaskExecutionStore, type ExecutionReservation, type ExecutionRecipient } from "./task-execution-store.js";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { SqliteDb } from "../../../lib/db.js";
import { stateTransaction } from "../../../lib/db/transaction.js";
import type { TaskBinding } from "../../../lib/persistence.js";
import { assertCurrentTaskActor } from "../tasks/task-actor.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { TaskBudgetAdmissionStore, TaskBudgetDeferredError } from "./task-budget-admission.js";
import { workloadEnforcementEnabled } from "./task-workload-enforcement.js";

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

type ManagedSessionPolicy = {
  binding?: TaskBinding;
  retainedBinding?: TaskBinding;
  persistentChat?: boolean;
};

function taskExecutionPolicy(db: SqliteDb, input: ManagedSessionPolicy) {
  const bound = input.binding ?? input.retainedBinding;
  if (!workloadEnforcementEnabled(db)) {
    // Withdrawal removes resource enforcement, never current Task authority.
    if (bound) {
      const store = AppTaskResourceStore.activeFromDb(db, bound.appId);
      if (!store) throw new Error("Task execution requires canonical authority after workload withdrawal");
      assertCurrentTaskActor({ resourceStore: store }, bound, "execution");
    }
    return null;
  }
  if (!bound) {
    if (new TaskExecutionStore(db).configured())
      throw new Error("Shared execution limits require a bounded Task binding; unbound execution is not configured");
    return null;
  }
  const admission = new TaskBudgetAdmissionStore(db);
  const task = { appId: bound.appId, taskId: bound.taskId };
  if (!admission.requiresAccounting(task)) {
    if (new TaskExecutionStore(db).configured())
      throw new Error("Shared execution limits require explicit adoption of historical Task funding");
    return null;
  }
  if (input.persistentChat) throw new Error("Budgeted Task execution requires a bounded managed session");
  if (!input.binding) throw new Error("Budgeted session start requires a current Task binding");
  return { admission, task, bound };
}

/** Shared authority for authored workflow code and managed agent starts.
 * It validates the existing claim; it never charges or reserves another start. */
function admittedTaskAttempt(
  db: SqliteDb,
  policy: NonNullable<ReturnType<typeof taskExecutionPolicy>>,
  operation: string,
) {
  const { admission, task, bound } = policy;
  const store = AppTaskResourceStore.activeFromDb(db, task.appId);
  if (!store || store.appId !== task.appId) throw new Error("Budgeted start requires canonical Task authority");
  assertCurrentTaskActor({ resourceStore: store }, bound, operation);
  if (!admission.budget.binding(task))
    throw new TaskBudgetDeferredError({ kind: "deferred", reason: "adoption-required", task, root: task, retryAt: null });
  const paidAttempt = admission.budget.receipt({ task, kind: "attempt", attemptId: bound.attemptId });
  if (!paidAttempt || paidAttempt.credits !== 1)
    throw new Error("Budgeted execution requires its exact paid attempt");
  if (paidAttempt.purpose !== "ordinary") {
    const attempt = store.readAttempt(bound.attemptId)!;
    admission.assertProtectedTask(task, store.readTask(task.taskId)!, attempt.owner, attempt.handler);
  }
  return { store, paidAttempt };
}

/** Pure workflow code can execute without a managed helper. Under installed
 * policy it still belongs to the current paid local Task attempt. Nested
 * methods reuse that attempt; unbound starts and live historical resumes fail
 * closed. Reading an already saved terminal result does not call this gate. */
export function assertTaskWorkflowStart(db: SqliteDb, binding?: TaskBinding): void {
  const policy = taskExecutionPolicy(db, { binding });
  if (!policy) return;
  stateTransaction(db, () => {
    admittedTaskAttempt(db, policy, "workflow start");
    requireLocalTaskAttemptExecution(db, policy.task, policy.bound.attemptId);
  });
}

/** Steering an admitted execution spends no new credit or place. It cannot
 * adopt a pre-policy session, revive stale authority, or start persistent work. */
export function assertManagedTaskContinuation(
  db: SqliteDb,
  input: ManagedSessionPolicy & { admitted?: ManagedTaskStartAdmission | null; running: boolean },
): void {
  const policy = taskExecutionPolicy(db, input);
  if (!policy && (input.binding || input.retainedBinding) && !workloadEnforcementEnabled(db) && !input.running)
    throw new Error("Task continuation requires a running managed execution");
  if (!policy) return;
  if (!input.running) throw new Error("Task continuation requires a running managed execution");
  const store = AppTaskResourceStore.activeFromDb(db, policy.task.appId);
  if (!store) throw new Error("Budgeted continuation requires canonical Task authority");
  assertCurrentTaskActor({ resourceStore: store }, policy.bound, "continuation");
  if (!input.admitted || (new TaskExecutionStore(db).configured() && !input.admitted.reservation))
    throw new Error("Task continuation requires its active managed admission; historical execution needs explicit adoption");
}

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
  // Unconfigured installations keep their existing start path. Relevant starts
  // recheck authority and accounting under the shared write transaction.
  const policy = taskExecutionPolicy(db, input);
  if (!policy) return null;
  const { admission, task, bound } = policy;
  return stateTransaction(db, () => {
    const { store, paidAttempt } = admittedTaskAttempt(db, policy, "managed start");
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
