import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { SqliteDb } from "../../../lib/db.js";
import { stateTransaction } from "../../../lib/db/transaction.js";
import { currentProcessInstance, type ProcessInstance } from "../../../lib/process-identity.js";
import { assertWorkloadEnforcementInstallable, workloadEnforcementEnabled } from "./task-workload-enforcement.js";
import { executionRecipientKey as recipientKey, type ExecutionRecipient } from "../../../lib/execution-recipient.js";
import { TaskBudgetStore, type BudgetTaskRef } from "./task-budget-store.js";

/** Resolved installation identity, not an alias or a source-release directory.
 * Programmatic definitions require an explicit stable Host identity. */
export type { ExecutionRecipient } from "../../../lib/execution-recipient.js";
export type ExecutionOperation =
  | { kind: "attempt"; task: BudgetTaskRef; attemptId: string }
  | { kind: "helper"; invocationId: string; sessionId: string; task?: BudgetTaskRef; attemptId?: string };
export type ExecutionRequest = {
  operation: ExecutionOperation;
  recipient: ExecutionRecipient;
  /** Trusted scheduling provenance, never selected by Task input or priority. */
  lane: "background" | "human" | "coordination";
  ownerId: string;
};
export type ExecutionReservation = {
  operationId: string;
  token: string;
  request: ExecutionRequest;
  /** Root at admission. Live occupancy follows the canonical Task binding,
   * including subsequent explicit historical adoption. */
  root: BudgetTaskRef | null;
  admittedAt: number;
  /** Historical receipts may have no process evidence; recovery must retain them. */
  owner?: ProcessInstance;
};
export type ExecutionRelease = {
  kind: "joined" | "confirmed-nonstart" | "confirmed-recovery";
  evidenceId: string;
};
export type ExecutionScope =
  { kind: "host" } | { kind: "agent"; recipient: ExecutionRecipient } | { kind: "root"; root: BudgetTaskRef };
/** Trusted Host policy. Leave enough places for the complete protected method,
 * including its workflow and inline helpers; total execution stays bounded. */
export type HostExecutionOptions = { backgroundSlots: number };
export type ExecutionReservationResult =
  | { kind: "unavailable" }
  | { kind: "deferred"; reason: "execution-policy" | "execution-capacity"; scope: ExecutionScope }
  | { kind: "admitted"; receipt: ExecutionReservation; replay: boolean; released: boolean };

const MAX_IDENTITY_BYTES = 1024;
// Three components, each with up to six JSON escape bytes, plus tuple syntax.
const MAX_OPERATION_BYTES = 3 * 6 * MAX_IDENTITY_BYTES + 64;
function exact(value: string, maxBytes = MAX_IDENTITY_BYTES): void {
  if (typeof value !== "string" || !value || value !== value.trim() || Buffer.byteLength(value) > maxBytes)
    throw new Error("Execution identities require exact bounded strings");
}
function taskKey(task: BudgetTaskRef): string {
  exact(task.appId);
  exact(task.taskId);
  return JSON.stringify([task.appId, task.taskId]);
}
function scopeKey(scope: ExecutionScope): string {
  return scope.kind === "host" ? "host" : scope.kind === "agent" ? recipientKey(scope.recipient) : taskKey(scope.root);
}
function operationKey(operation: ExecutionOperation): string {
  if (operation.task) taskKey(operation.task);
  if (operation.kind === "attempt") {
    taskKey(operation.task);
    exact(operation.attemptId);
    return JSON.stringify([operation.kind, operation.task.appId, operation.task.taskId, operation.attemptId]);
  }
  if (operation.kind !== "helper") throw new Error("Unknown execution operation");
  exact(operation.invocationId);
  exact(operation.sessionId);
  if (operation.task) exact(operation.attemptId!);
  else if (operation.attemptId !== undefined) throw new Error("A helper attempt requires its exact Task");
  return JSON.stringify([operation.kind, operation.invocationId]);
}

/** Shared execution accounting; installation activation remains private.
 * All runtimes share these rows. Callers must join reservation and start-credit
 * admission to their existing fenced transaction, then dispatch outside SQL.
 * Primary execution adopts its attempt reservation; it never acquires twice. */
export class TaskExecutionStore {
  constructor(readonly db: SqliteDb) {}

  configured(): boolean {
    if (!workloadEnforcementEnabled(this.db)) return false;
    return !!this.db.prepare("SELECT 1 FROM task_execution_limits WHERE scope_kind = 'host' AND scope_key = 'host'").get();
  }

  read(operation: ExecutionOperation): { receipt: ExecutionReservation; released: boolean } | null {
    const row = this.db.prepare("SELECT receipt_json, released_at FROM task_execution_reservations WHERE operation_id = ?")
      .get(operationKey(operation));
    return row ? { receipt: JSON.parse(row.receipt_json as string), released: row.released_at !== null } : null;
  }

  activeForAttempt(task: BudgetTaskRef, attemptId: string): ExecutionReservation[] {
    taskKey(task);
    exact(attemptId);
    return this.db.prepare(`SELECT receipt_json FROM task_execution_reservations
      WHERE released_at IS NULL AND task_app_id = ? AND task_id = ? AND attempt_id = ?`)
      .all(task.appId, task.taskId, attemptId)
      .map(row => JSON.parse(row.receipt_json as string) as ExecutionReservation);
  }

  activeForTask(task: BudgetTaskRef): ExecutionReservation[] {
    taskKey(task);
    return this.db.prepare(`SELECT receipt_json FROM task_execution_reservations
      WHERE released_at IS NULL AND task_app_id = ? AND task_id = ?`)
      .all(task.appId, task.taskId)
      .map(row => JSON.parse(row.receipt_json as string) as ExecutionReservation);
  }

  /** Execution recovery must also visit ended Tasks, without reading history.
   * The scheduler retains this keyset cursor, so live rows cannot block later work. */
  activeTaskPage(appId: string, limit: number, afterTaskId?: string): { taskIds: string[]; nextTaskId?: string } {
    exact(appId);
    const bounded = Math.max(1, Math.min(256, Math.floor(limit)));
    const rows = this.db.prepare(`SELECT DISTINCT task_id FROM task_execution_reservations
      WHERE released_at IS NULL AND task_app_id = ? ${afterTaskId === undefined ? "" : "AND task_id > ?"}
      ORDER BY task_id LIMIT ?`).all(appId, ...(afterTaskId === undefined ? [] : [afterTaskId]), bounded);
    const taskIds = rows.map(row => row.task_id as string);
    return { taskIds, ...(taskIds.length === bounded ? { nextTaskId: taskIds.at(-1)! } : {}) };
  }

  /** All recovery routes share this prerequisite. Business cancellation and
   * local result settlement remain independent of execution accounting. */
  hasActive(task: BudgetTaskRef, attemptId?: string): boolean {
    return !!this.db.prepare(`SELECT 1 FROM task_execution_reservations
      WHERE released_at IS NULL AND task_app_id = ? AND task_id = ?
      ${attemptId === undefined ? "" : "AND attempt_id = ?"} LIMIT 1`)
      .get(task.appId, task.taskId, ...(attemptId === undefined ? [] : [attemptId]));
  }

  blocked(scope: ExecutionScope, lane: ExecutionRequest["lane"], requiredSlots = 1): "execution-policy" | "execution-capacity" | null {
    if (!Number.isSafeInteger(requiredSlots) || requiredSlots < 1) throw new Error("Execution demand must be positive slots");
    const usage = this.usage(scope);
    if (usage.limit === null) return "execution-policy";
    if (usage.occupied + requiredSlots > usage.limit) return "execution-capacity";
    if (scope.kind === "host" && lane === "background") {
      const occupied = this.backgroundOccupied();
      if (occupied + requiredSlots > this.hostPolicy()!.backgroundMaxConcurrent) return "execution-capacity";
    }
    return null;
  }

  backgroundOccupied(): number {
    return this.db.prepare(`SELECT count(*) AS n FROM task_execution_reservations
      WHERE released_at IS NULL AND lane = 'background'`).get()!.n as number;
  }

  hostPolicy(): { maxConcurrent: number; backgroundMaxConcurrent: number } | null {
    const row = this.db.prepare(`SELECT slots,
      (SELECT slots FROM task_execution_limits WHERE scope_kind = 'host' AND scope_key = 'background') AS background
      FROM task_execution_limits WHERE scope_kind = 'host' AND scope_key = 'host'`).get();
    return row ? { maxConcurrent: row.slots as number,
      backgroundMaxConcurrent: (row.background as number | null) ?? Math.max(1, (row.slots as number) - 1) } : null;
  }

  installLimit(scope: ExecutionScope, slots: number, options?: HostExecutionOptions): void {
    assertWorkloadEnforcementInstallable(this.db);
    if (!Number.isSafeInteger(slots) || slots < 1) throw new Error("Execution limits must be positive safe integers");
    if (options && (scope.kind !== "host" || !Number.isSafeInteger(options.backgroundSlots) ||
      options.backgroundSlots < 1 || options.backgroundSlots > slots))
      throw new Error("Background execution requires a positive Host sublimit within total capacity");
    const key = scopeKey(scope);
    stateTransaction(this.db, () => {
      const existing = this.db
        .prepare("SELECT slots FROM task_execution_limits WHERE scope_kind = ? AND scope_key = ?")
        .get(scope.kind, key);
      if (existing && existing.slots !== slots)
        throw new Error("Execution limit changes require explicit installation authority");
      const background = options?.backgroundSlots ?? Math.max(1, slots - 1);
      if (scope.kind === "host" && existing && this.hostPolicy()!.backgroundMaxConcurrent !== background)
        throw new Error("Execution limit changes require explicit installation authority");
      if (!existing)
        this.db
          .prepare("INSERT INTO task_execution_limits(scope_kind, scope_key, slots) VALUES (?, ?, ?)")
          .run(scope.kind, key, slots);
      if (scope.kind === "host" && options && !existing)
        this.db.prepare("INSERT INTO task_execution_limits(scope_kind, scope_key, slots) VALUES ('host', 'background', ?)")
          .run(background);
    });
  }

  /** One indexed statement; only live reservations, never operation history.
   * Root attribution uses keyed canonical binding reads, so adopting an already
   * running Task cannot turn its existing execution into spare capacity. */
  usage(scope: ExecutionScope): { limit: number | null; occupied: number } {
    const key = scopeKey(scope);
    const predicate =
      scope.kind === "host"
        ? "1 = 1"
        : scope.kind === "agent"
          ? "recipient_key = ?"
          : `EXISTS (
      SELECT 1 FROM task_budget_bindings b
      WHERE b.app_id = r.task_app_id AND b.task_id = r.task_id
        AND b.root_app_id = ? AND b.root_task_id = ?)`;
    const parameters =
      scope.kind === "host" ? [] : scope.kind === "agent" ? [key] : [scope.root.appId, scope.root.taskId];
    const row = this.db
      .prepare(
        `SELECT
      (SELECT slots FROM task_execution_limits WHERE scope_kind = ? AND scope_key = ?) AS slots,
      (SELECT count(*) FROM task_execution_reservations r WHERE released_at IS NULL AND ${predicate}) AS occupied`,
      )
      .get(scope.kind, key, ...parameters)!;
    return { limit: row.slots as number | null, occupied: row.occupied as number };
  }

  reserve(request: ExecutionRequest, now = Date.now()): ExecutionReservationResult {
    const operationId = operationKey(request.operation);
    const recipient = recipientKey(request.recipient);
    exact(request.ownerId);
    if (!["background", "human", "coordination"].includes(request.lane)) throw new Error("Unknown execution lane");
    if (!Number.isSafeInteger(now) || now < 1) throw new Error("Execution time must be a positive epoch millisecond");
    return stateTransaction(this.db, () => {
      const saved = this.db
        .prepare("SELECT receipt_json, released_at FROM task_execution_reservations WHERE operation_id = ?")
        .get(operationId);
      if (saved) {
        const receipt = JSON.parse(saved.receipt_json as string) as ExecutionReservation;
        if (!isDeepStrictEqual(receipt.request, request))
          throw new Error("Execution operation identity was reused for another start");
        return { kind: "admitted", receipt, replay: true, released: saved.released_at !== null };
      }
      const host: ExecutionScope = { kind: "host" };
      if (!this.configured()) return { kind: "unavailable" };
      const hostUsage = this.usage(host);
      if (hostUsage.limit === null) return { kind: "unavailable" };
      const root = request.operation.task ? new TaskBudgetStore(this.db).binding(request.operation.task) : null;
      const scopes: ExecutionScope[] = [
        host,
        { kind: "agent", recipient: request.recipient },
        ...(root ? [{ kind: "root" as const, root }] : []),
      ];
      for (const scope of scopes) {
        const reason = this.blocked(scope, request.lane);
        if (reason) return { kind: "deferred", reason, scope };
      }
      const receipt: ExecutionReservation = {
        operationId,
        token: randomUUID(),
        request: structuredClone(request),
        root,
        admittedAt: now,
        owner: currentProcessInstance(),
      };
      this.db
        .prepare(
          `INSERT INTO task_execution_reservations(operation_id, token, recipient_key,
        task_app_id, task_id, attempt_id, session_id, lane,
        owner_id, admitted_at, receipt_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          operationId,
          receipt.token,
          recipient,
          request.operation.task?.appId ?? null,
          request.operation.task?.taskId ?? null,
          request.operation.attemptId ?? null,
          request.operation.kind === "helper" ? request.operation.sessionId : null,
          request.lane,
          request.ownerId,
          now,
          JSON.stringify(receipt),
        );
      return { kind: "admitted", receipt, replay: false, released: false };
    });
  }

  /** Only a trusted execution/cleanup owner supplies confirmation. Cancellation,
   * transport loss, lease expiry and UTC rollover are never confirmations.
   * A replay returns retained evidence; it never authorizes external redispatch. */
  confirmReleased(operationId: string, token: string, confirmation: ExecutionRelease, now = Date.now()): boolean {
    exact(operationId, MAX_OPERATION_BYTES);
    exact(token);
    exact(confirmation.evidenceId);
    if (!["joined", "confirmed-nonstart", "confirmed-recovery"].includes(confirmation.kind))
      throw new Error("Execution release requires confirmed non-start or joined cleanup");
    if (!Number.isSafeInteger(now) || now < 1) throw new Error("Execution time must be a positive epoch millisecond");
    return stateTransaction(this.db, () => {
      const saved = this.db
        .prepare("SELECT token, released_at FROM task_execution_reservations WHERE operation_id = ?")
        .get(operationId);
      if (!saved || saved.token !== token) throw new Error("Execution release does not match the exact reservation");
      if (saved.released_at !== null) return false;
      this.db
        .prepare(
          "UPDATE task_execution_reservations SET released_at = ?, release_json = ? WHERE operation_id = ? AND token = ? AND released_at IS NULL",
        )
        .run(now, JSON.stringify(confirmation), operationId, token);
      return true;
    });
  }
}
