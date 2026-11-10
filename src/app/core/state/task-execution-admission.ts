import { ExecutionDeferredError } from "@may-agent/sdk";
import type { SqliteDb } from "../../../lib/db.js";
import { stateTransaction } from "../../../lib/db/transaction.js";
import { currentProcessInstance } from "../../../lib/process-identity.js";
import { executionRecipientKey, type ExecutionRecipient } from "../../../lib/execution-recipient.js";
import { AppTaskResourceStore, type AppTaskResourceMutation } from "./app-task-resource-store.js";
import { TaskBudgetStore, type BudgetTaskRef } from "./task-budget-store.js";
import {
  TaskExecutionStore, type ExecutionScope, type ExecutionRequest,
  type ExecutionReservation, type ExecutionRelease,
  type HostExecutionOptions,
} from "./task-execution-store.js";

export type TaskExecutionAdmissionContext = {
  /** Captured from the same immutable definitions used for execution. */
  recipient(agent: string): ExecutionRecipient | null;
  lane: ExecutionRequest["lane"];
};
export type TaskExecutionConstraint = {
  kind: "deferred";
  reason: "execution-policy" | "execution-capacity" | "execution-recipient";
  task: BudgetTaskRef;
  /** Minimum simultaneous places for the denied method, including its caller. */
  requiredSlots?: number;
  /** A revised method rechecks admission instead of inheriting an obsolete hold. */
  generation?: number;
  scope: ExecutionScope | { kind: "recipient"; agent: string };
  scopeKey: string;
  lane: ExecutionRequest["lane"];
  /** Mechanical recheck only; a release can wake it sooner without a model. */
  retryAt: number;
};
export class TaskExecutionDeferredError extends ExecutionDeferredError {
  constructor(readonly constraint: TaskExecutionConstraint, root: BudgetTaskRef | null) {
    super({ resource: "execution-capacity", reason: constraint.reason, retryAt: constraint.retryAt,
      task: constraint.task, root, scope: constraint.scope.kind, ...(constraint.requiredSlots ? { requiredSlots: constraint.requiredSlots } : {}) });
    this.name = "TaskExecutionDeferredError";
  }
}
function scopeKey(scope: TaskExecutionConstraint["scope"]): string {
  return scope.kind === "host" ? JSON.stringify(["host"])
    : scope.kind === "agent" ? JSON.stringify(["agent", scope.recipient.kind, scope.recipient.id])
    : scope.kind === "root" ? JSON.stringify(["root", scope.root.appId, scope.root.taskId])
    : JSON.stringify(["recipient", scope.agent]);
}

/** Private claim admission. Installed limits are still unavailable for production
 * activation until managed starts and complete descendant recovery are wired. */
function reserveTaskAttemptExecution(
  db: SqliteDb, input: { task: BudgetTaskRef; attemptId: string; generation: number; agent: string; execution?: TaskExecutionAdmissionContext },
  now = Date.now(),
): ExecutionReservation | null {
  const store = new TaskExecutionStore(db);
  if (!store.configured()) return null;
  const recipient = input.execution?.recipient(input.agent) ?? null;
  const lane = input.execution?.lane ?? "background";
  const root = new TaskBudgetStore(db).binding(input.task);
  const defer = (reason: TaskExecutionConstraint["reason"], scope: TaskExecutionConstraint["scope"]): never => {
    throw new TaskExecutionDeferredError({ kind: "deferred", reason, task: input.task,
      scope, scopeKey: scopeKey(scope), lane, requiredSlots: 1, generation: input.generation, retryAt: now + 60_000 }, root);
  };
  if (!recipient) return defer("execution-recipient", { kind: "recipient", agent: input.agent });
  const result = store.reserve({
    operation: { kind: "attempt", task: input.task, attemptId: input.attemptId },
    recipient, lane, ownerId: currentProcessInstance().processIdentity,
  }, now);
  if (result.kind === "unavailable") throw new Error("Execution policy disappeared during fenced admission");
  if (result.kind === "deferred") return defer(result.reason, result.scope);
  if (result.replay) throw new Error("A new Task claim cannot reuse an admitted execution operation");
  return result.receipt;
}

/** Called by the canonical resource commit after its fences and credit admission.
 * It adds only accounting; deferrals use the reconciler's existing input lifecycle. */
export function admitTaskMutationExecution(db: SqliteDb, appId: string, mutation: AppTaskResourceMutation): void {
  if (!new TaskExecutionStore(db).configured()) return;
  for (const attempt of mutation.attempts ?? []) {
    if (attempt.state !== "running" || db.prepare(
      "SELECT 1 FROM app_task_attempts WHERE app_id = ? AND attempt_id = ?",
    ).get(appId, attempt.metadata.id)) continue;
    const resource = mutation.tasks?.find(write => write.resource.metadata.id === attempt.taskId)?.resource;
    if (!resource || resource.status.currentAttemptId !== attempt.metadata.id || resource.metadata.generation !== attempt.taskGeneration)
      throw new Error("Execution admission requires its exact resource claim");
    reserveTaskAttemptExecution(db, { task: { appId, taskId: attempt.taskId },
      attemptId: attempt.metadata.id, generation: attempt.taskGeneration, agent: attempt.owner, execution: mutation.execution });
  }
}

/** Authored workflows and managed starts require the same live local receipt.
 * Checking it never acquires another place or retroactively adopts execution. */
export function requireLocalTaskAttemptExecution(
  db: SqliteDb, task: BudgetTaskRef, attemptId: string,
): ExecutionReservation | null {
  const store = new TaskExecutionStore(db);
  if (!store.configured()) return null;
  const saved = store.read({ kind: "attempt", task, attemptId });
  if (!saved || saved.released || saved.receipt.owner?.processIdentity !== currentProcessInstance().processIdentity)
    throw new Error("Execution requires its active local claim reservation; historical execution needs explicit adoption");
  return saved.receipt;
}

/** Managed start joins the same transaction as its existing invocation debit.
 * The paid primary adopts the claim; every later/helper invocation reserves anew. */
export function reserveManagedTaskExecution(
  db: SqliteDb,
  input: { task: BudgetTaskRef; attemptId: string; generation: number; invocationId: string; sessionId: string;
    primaryCovered: boolean; recipient: ExecutionRecipient | null; agent: string },
  now = Date.now(),
): ExecutionReservation | null {
  const store = new TaskExecutionStore(db);
  const saved = requireLocalTaskAttemptExecution(db, input.task, input.attemptId);
  if (!saved) return null;
  const lane = saved.request.lane;
  const root = new TaskBudgetStore(db).binding(input.task);
  const defer = (reason: TaskExecutionConstraint["reason"], scope: TaskExecutionConstraint["scope"]): never => {
    throw new TaskExecutionDeferredError({ kind: "deferred", reason, task: input.task,
      scope, scopeKey: scopeKey(scope), lane, generation: input.generation,
      requiredSlots: 1 + store.activeForAttempt(input.task, input.attemptId).filter(receipt =>
        scope.kind === "host" || scope.kind === "root" ||
        (scope.kind === "agent" && executionRecipientKey(receipt.request.recipient) === executionRecipientKey(scope.recipient)),
      ).length, retryAt: now + 60_000 }, root);
  };
  if (!input.recipient) return defer("execution-recipient", { kind: "recipient", agent: input.agent });
  if (input.primaryCovered) {
    if (executionRecipientKey(saved.request.recipient) !== executionRecipientKey(input.recipient))
      throw new Error("Primary execution recipient does not match its pinned claim recipient");
    return saved;
  }
  const reserved = store.reserve({ operation: { kind: "helper", task: input.task, attemptId: input.attemptId,
    invocationId: input.invocationId, sessionId: input.sessionId }, recipient: input.recipient,
    lane, ownerId: currentProcessInstance().processIdentity }, now);
  if (reserved.kind === "deferred") return defer(reserved.reason, reserved.scope);
  if (reserved.kind === "unavailable" || reserved.replay) throw new Error("A managed invocation requires fresh execution admission");
  return reserved.receipt;
}

export function executionStillConstrained(db: SqliteDb, constraint: TaskExecutionConstraint): boolean {
  const store = new TaskExecutionStore(db);
  if (!store.configured()) return false;
  return constraint.scope.kind === "recipient" || store.blocked(constraint.scope, constraint.lane, constraint.requiredSlots ?? 1) !== null;
}

/** Reuse canonical fenced resources and recovery indexes, not a second queue. */
function wakeExecutionConstraints(db: SqliteDb, scopes: TaskExecutionConstraint["scope"][], now: number): void {
  for (const key of new Set(scopes.map(scopeKey))) {
    const rows = db.prepare(`SELECT app_id, task_id FROM app_tasks
      WHERE json_valid(resource_json)
        AND json_extract(resource_json, '$.status.executionConstraint.scopeKey') = ?`).all(key);
    for (const row of rows) {
      const tasks = AppTaskResourceStore.inspectFromDb(db, row.app_id as string);
      const taskId = row.task_id as string;
      const resource = tasks.readTask(taskId);
      const constraint = resource?.status.executionConstraint;
      if (!resource || !constraint || tasks.isCancelled(taskId) || executionStillConstrained(db, constraint)) continue;
      const version = resource.metadata.resourceVersion++;
      delete resource.status.executionConstraint;
      if (!tasks.commit({ fences: [{ taskId, resourceVersion: version }], tasks: [{ resource,
        trigger: tasks.readTrigger(taskId) ?? undefined, ready: true, nextCheckAt: now }] }))
        throw new Error("Execution wake lost its exact resource fence");
    }
  }
}

/** A trusted installation operation; no Task/model authority or default cap. */
export function installTaskExecutionLimit(
  db: SqliteDb, scope: ExecutionScope, slots: number, nowOrOptions: number | HostExecutionOptions = Date.now(),
): void {
  const now = typeof nowOrOptions === "number" ? nowOrOptions : Date.now();
  stateTransaction(db, () => {
    new TaskExecutionStore(db).installLimit(scope, slots, typeof nowOrOptions === "number" ? undefined : nowOrOptions);
    wakeExecutionConstraints(db, [scope], now);
  });
}

export function releaseTaskExecutionReservation(
  db: SqliteDb, receipt: ExecutionReservation, evidence: ExecutionRelease, now = Date.now(),
): boolean {
  return stateTransaction(db, () => {
    const released = new TaskExecutionStore(db).confirmReleased(receipt.operationId, receipt.token, evidence, now);
    if (released) {
      const task = receipt.request.operation.task;
      const root = task ? new TaskBudgetStore(db).binding(task) : null;
      wakeExecutionConstraints(db, [{ kind: "host" }, { kind: "agent", recipient: receipt.request.recipient },
        ...(root ? [{ kind: "root" as const, root }] : [])], now);
    }
    return released;
  });
}
