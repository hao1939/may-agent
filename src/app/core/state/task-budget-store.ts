import { isDeepStrictEqual } from "node:util";
import type { SqliteDb } from "../../../lib/db.js";
import { stateTransaction } from "../../../lib/db/transaction.js";

export type BudgetTaskRef = { appId: string; taskId: string };
export type BudgetSponsor = { appId: string; agent: string };
export type BudgetPurpose = "ordinary" | "coordination";
export type BudgetRoot = {
  root: BudgetTaskRef;
  sponsor: BudgetSponsor;
  purpose: BudgetPurpose;
  credits: number;
  renewal: "lifetime" | "utc-day";
};
/** Host-private installation command, never Task or model-supplied authority. */
export type RootBudgetFundingChange = {
  changeId: string;
  expected: BudgetRoot;
  credits: number;
  reason: string;
};
export type RootBudgetFundingReceipt = {
  change: RootBudgetFundingChange;
  rootPeriod: string;
  changedAt: number;
};
export type BudgetOperation = { task: BudgetTaskRef } & (
  | { kind: "task" }
  | { kind: "attempt"; attemptId: string }
  | { kind: "helper"; invocationId: string }
  | { kind: "adoption"; adoptionId: string; reason: string }
);
export type BudgetReceipt = {
  operationId: string;
  operation: BudgetOperation;
  root: BudgetTaskRef;
  sponsor: BudgetSponsor;
  purpose: BudgetPurpose;
  period: string;
  rootPeriod: string;
  credits: 0 | 1;
  chargedAt: number;
};
export type BudgetAdmission =
  | { kind: "admitted"; receipt: BudgetReceipt; replay: boolean }
  | {
      kind: "deferred";
      reason: "sponsor-credit" | "root-credit";
      task: BudgetTaskRef;
      root: BudgetTaskRef;
      retryAt: number | null;
    };

function exact(value: string): void {
  if (typeof value !== "string" || !value || value !== value.trim() || Buffer.byteLength(value) > 1024)
    throw new Error("Budget identities require an exact non-empty bounded string");
}
function taskRef(task: BudgetTaskRef): void {
  exact(task.appId);
  exact(task.taskId);
}
function credits(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Budget credits must be a non-negative safe integer");
}
export function utcBudgetPeriod(now: number): string {
  if (!Number.isSafeInteger(now) || now < 1) throw new Error("Budget time must be a positive epoch millisecond");
  return new Date(now).toISOString().slice(0, 10);
}
function period(value: string): void {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  )
    throw new Error("A budget grant requires an exact UTC date");
}
function purpose(value: BudgetPurpose): void {
  if (value !== "ordinary" && value !== "coordination") throw new Error("Unknown budget purpose");
}
export function budgetOperationId(operation: BudgetOperation): string {
  taskRef(operation.task);
  const reference =
    operation.kind === "attempt"
      ? operation.attemptId
      : operation.kind === "helper"
        ? operation.invocationId
        : operation.kind === "adoption"
          ? operation.adoptionId
          : null;
  if (reference !== null) exact(reference);
  if (!["task", "attempt", "helper", "adoption"].includes(operation.kind)) throw new Error("Unknown budget operation");
  return JSON.stringify([operation.kind, operation.task.appId, operation.task.taskId, reference]);
}

/** Host-private, synchronous accounting on the existing installation database.
 * Callers join the resource/claim transaction. No model-facing funding capability,
 * automatic historical adoption, refund, lifecycle mutation or second queue. */
export class TaskBudgetStore {
  constructor(readonly db: SqliteDb) {}

  grant(input: { sponsor: BudgetSponsor; purpose: BudgetPurpose; period: string; credits: number }): void {
    exact(input.sponsor.appId);
    exact(input.sponsor.agent);
    purpose(input.purpose);
    period(input.period);
    credits(input.credits);
    stateTransaction(this.db, () => {
      const previous = this.db
        .prepare(
          `SELECT credits FROM task_credit_grants
        WHERE sponsor_app_id = ? AND sponsor_agent = ? AND purpose = ? AND period = ?`,
        )
        .get(input.sponsor.appId, input.sponsor.agent, input.purpose, input.period);
      if (previous) {
        if (previous.credits !== input.credits)
          throw new Error("Changing an existing grant requires an explicit funding operation");
        return;
      }
      this.db
        .prepare(
          `INSERT INTO task_credit_grants(sponsor_app_id, sponsor_agent, purpose, period, credits)
        VALUES (?, ?, ?, ?, ?)`,
        )
        .run(input.sponsor.appId, input.sponsor.agent, input.purpose, input.period, input.credits);
    });
  }

  registerRoot(input: BudgetRoot): void {
    taskRef(input.root);
    exact(input.sponsor.appId);
    exact(input.sponsor.agent);
    purpose(input.purpose);
    credits(input.credits);
    if (input.renewal !== "lifetime" && input.renewal !== "utc-day") throw new Error("Unknown root renewal policy");
    stateTransaction(this.db, () => {
      const previous = this.root(input.root);
      if (previous && !isDeepStrictEqual(previous, input))
        throw new Error("Root attribution and allowance require an explicit funding operation to change");
      if (!previous)
        this.db
          .prepare(
            `INSERT INTO task_budget_roots(
        root_app_id, root_task_id, sponsor_app_id, sponsor_agent, purpose, renewal, credits) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            input.root.appId,
            input.root.taskId,
            input.sponsor.appId,
            input.sponsor.agent,
            input.purpose,
            input.renewal,
            input.credits,
          );
      this.bind(input.root, input.root);
    });
  }

  /** Change only the allowance, retaining attribution and every spent credit.
   * Exact receipt replay cannot apply the command again after a later change. */
  setRootCredits(
    input: RootBudgetFundingChange,
    now: number,
  ): {
    receipt: RootBudgetFundingReceipt;
    replay: boolean;
  } {
    exact(input.changeId);
    exact(input.reason);
    credits(input.credits);
    const period = utcBudgetPeriod(now);
    taskRef(input.expected.root);
    return stateTransaction(this.db, () => {
      const saved = this.db
        .prepare("SELECT receipt_json FROM task_budget_funding_receipts WHERE change_id = ?")
        .get(input.changeId);
      if (saved) {
        const receipt = JSON.parse(saved.receipt_json as string) as RootBudgetFundingReceipt;
        if (!isDeepStrictEqual(receipt.change, input))
          throw new Error("Funding change identity was reused for a different command");
        return { receipt, replay: true };
      }
      const current = this.root(input.expected.root);
      if (!current || !isDeepStrictEqual(current, input.expected))
        throw new Error("Root funding requires the exact current attribution and allowance");
      const view = this.view(current.root, now)!;
      if (input.credits < view.rootCharged) throw new Error("Root allowance cannot be lower than its charged credits");
      const receipt: RootBudgetFundingReceipt = {
        change: structuredClone(input),
        rootPeriod: current.renewal === "lifetime" ? "lifetime" : period,
        changedAt: now,
      };
      this.db
        .prepare("UPDATE task_budget_roots SET credits = ? WHERE root_app_id = ? AND root_task_id = ?")
        .run(input.credits, current.root.appId, current.root.taskId);
      this.db
        .prepare(
          `INSERT INTO task_budget_funding_receipts(change_id, root_app_id, root_task_id, changed_at, receipt_json)
        VALUES (?, ?, ?, ?, ?)`,
        )
        .run(input.changeId, current.root.appId, current.root.taskId, now, JSON.stringify(receipt));
      return { receipt, replay: false };
    });
  }

  root(ref: BudgetTaskRef): BudgetRoot | null {
    taskRef(ref);
    const row = this.db
      .prepare("SELECT * FROM task_budget_roots WHERE root_app_id = ? AND root_task_id = ?")
      .get(ref.appId, ref.taskId);
    return row
      ? {
          root: { ...ref },
          sponsor: { appId: row.sponsor_app_id as string, agent: row.sponsor_agent as string },
          purpose: row.purpose as BudgetPurpose,
          credits: row.credits as number,
          renewal: row.renewal as BudgetRoot["renewal"],
        }
      : null;
  }

  binding(task: BudgetTaskRef): BudgetTaskRef | null {
    taskRef(task);
    const row = this.db
      .prepare("SELECT root_app_id, root_task_id FROM task_budget_bindings WHERE app_id = ? AND task_id = ?")
      .get(task.appId, task.taskId);
    return row ? { appId: row.root_app_id as string, taskId: row.root_task_id as string } : null;
  }

  bind(task: BudgetTaskRef, root: BudgetTaskRef): void {
    taskRef(task);
    taskRef(root);
    stateTransaction(this.db, () => {
      if (!this.root(root)) throw new Error("Task budget root is not configured");
      const existing = this.binding(task);
      if (existing && !isDeepStrictEqual(existing, root)) throw new Error("Task budget binding is immutable");
      if (!existing)
        this.db
          .prepare("INSERT INTO task_budget_bindings(app_id, task_id, root_app_id, root_task_id) VALUES (?, ?, ?, ?)")
          .run(task.appId, task.taskId, root.appId, root.taskId);
    });
  }

  /** Balances are indexed counters, never sums over unbounded operation history. */
  view(task: BudgetTaskRef, now: number) {
    this.db.exec("SAVEPOINT task_budget_read");
    try {
      const result = this.readView(task, now);
      this.db.exec("RELEASE task_budget_read");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK TO task_budget_read");
      this.db.exec("RELEASE task_budget_read");
      throw error;
    }
  }

  private readView(task: BudgetTaskRef, now: number) {
    const rootRef = this.binding(task);
    if (!rootRef) return null;
    const root = this.root(rootRef)!;
    const period = utcBudgetPeriod(now);
    const rootPeriod = root.renewal === "lifetime" ? "lifetime" : period;
    const balance = this.db
      .prepare(
        `SELECT charged FROM task_budget_root_balances
      WHERE root_app_id = ? AND root_task_id = ? AND period = ?`,
      )
      .get(rootRef.appId, rootRef.taskId, rootPeriod);
    const grant = this.db
      .prepare(
        `SELECT credits, charged FROM task_credit_grants
      WHERE sponsor_app_id = ? AND sponsor_agent = ? AND purpose = ? AND period = ?`,
      )
      .get(root.sponsor.appId, root.sponsor.agent, root.purpose, period);
    return {
      ...root,
      period,
      rootPeriod,
      rootCharged: (balance?.charged as number | undefined) ?? 0,
      grant: grant ? { credits: grant.credits as number, charged: grant.charged as number } : null,
    };
  }

  /** Read an exact committed operation without creating a debit. */
  receipt(operation: BudgetOperation): BudgetReceipt | null {
    const row = this.db
      .prepare("SELECT receipt_json FROM task_budget_operations WHERE operation_id = ?")
      .get(budgetOperationId(operation));
    if (!row) return null;
    const receipt = JSON.parse(row.receipt_json as string) as BudgetReceipt;
    if (!isDeepStrictEqual(receipt.operation, operation))
      throw new Error("Budget operation identity was reused for different work");
    return receipt;
  }

  /** Replay retains its original debit/period; uncertain admitted starts stay paid. */
  charge(operation: BudgetOperation, now: number): BudgetAdmission {
    const operationId = budgetOperationId(operation);
    const currentPeriod = utcBudgetPeriod(now);
    if (operation.kind === "adoption") {
      exact(operation.reason);
    }
    return stateTransaction(this.db, () => {
      const previous = this.receipt(operation);
      if (previous) return { kind: "admitted", receipt: previous, replay: true };
      const view = this.view(operation.task, now);
      if (!view) throw new Error("Historical or unbound Task requires explicit budget adoption");
      const charge = operation.kind === "adoption" ? 0 : 1;
      const retryAt = Date.parse(`${currentPeriod}T00:00:00Z`) + 86_400_000;
      if (charge && view.rootCharged >= view.credits)
        return {
          kind: "deferred",
          reason: "root-credit",
          task: { ...operation.task },
          root: view.root,
          retryAt: view.renewal === "utc-day" ? retryAt : null,
        };
      if (charge && (!view.grant || view.grant.charged >= view.grant.credits))
        return { kind: "deferred", reason: "sponsor-credit", task: { ...operation.task }, root: view.root, retryAt };
      const receipt: BudgetReceipt = {
        operationId,
        operation: structuredClone(operation),
        root: view.root,
        sponsor: view.sponsor,
        purpose: view.purpose,
        period: view.period,
        rootPeriod: view.rootPeriod,
        credits: charge,
        chargedAt: now,
      };
      if (charge) {
        this.db
          .prepare(
            `INSERT INTO task_budget_root_balances(root_app_id, root_task_id, period, charged) VALUES (?, ?, ?, 1)
          ON CONFLICT(root_app_id, root_task_id, period) DO UPDATE SET charged = charged + 1`,
          )
          .run(view.root.appId, view.root.taskId, view.rootPeriod);
        this.db
          .prepare(
            `UPDATE task_credit_grants SET charged = charged + 1
          WHERE sponsor_app_id = ? AND sponsor_agent = ? AND purpose = ? AND period = ?`,
          )
          .run(view.sponsor.appId, view.sponsor.agent, view.purpose, view.period);
      }
      this.db
        .prepare(
          `INSERT INTO task_budget_operations(operation_id, app_id, task_id, root_app_id, root_task_id,
        kind, period, credits, charged_at, receipt_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          operationId,
          operation.task.appId,
          operation.task.taskId,
          view.root.appId,
          view.root.taskId,
          operation.kind,
          view.period,
          charge,
          now,
          JSON.stringify(receipt),
        );
      return { kind: "admitted", receipt, replay: false };
    });
  }
}
