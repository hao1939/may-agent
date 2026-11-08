import { isDeepStrictEqual } from "node:util";
import type { SqliteDb } from "../../../lib/db.js";
import { stateTransaction } from "../../../lib/db/transaction.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { TaskBudgetAdmissionStore, type DailyTaskBudgetFundingChange } from "./task-budget-admission.js";
import {
  TaskBudgetStore,
  type BudgetRoot,
  type BudgetTaskRef,
  type RootBudgetFundingChange,
} from "./task-budget-store.js";

/** Shared fenced wake mechanics; queries retain each funding authority's exact scope. */
export function wakeTaskWorkloadConstraints(
  db: SqliteDb, tasks: Array<Record<string, unknown>>, now: number,
  kinds: readonly ("funding" | "executionConstraint")[] = ["funding"],
): void {
  for (const row of tasks) {
    const store = AppTaskResourceStore.inspectFromDb(db, row.app_id as string);
    const taskId = row.task_id as string;
    const resource = store.readTask(taskId);
    if (!resource || store.isCancelled(taskId)) continue;
    const version = resource.metadata.resourceVersion++;
    for (const kind of kinds) delete resource.status[kind];
    if (
      !store.commit({
        fences: [{ taskId, resourceVersion: version }],
        tasks: [{ resource, trigger: store.readTrigger(taskId) ?? undefined, ready: true, nextCheckAt: now }],
      })
    )
      throw new Error("Funding lost its exact resource fence");
  }
}

/** Installation-only daily allowance change; protected funds remain separate. */
export function changeTaskBudgetDailyCredits(db: SqliteDb, input: DailyTaskBudgetFundingChange, now = Date.now()) {
  return stateTransaction(db, () => {
    const result = new TaskBudgetAdmissionStore(db).setDailyCredits(input, now);
    if (result.replay || input.dailyCredits <= input.expected.dailyCredits) return result;
    const sponsor = input.expected.sponsor;
    const tasks = db
      .prepare(
        `SELECT app_id, task_id FROM app_tasks
      WHERE json_valid(resource_json) AND json_extract(resource_json, '$.status.funding.reason') = 'sponsor-credit'
        AND json_extract(resource_json, '$.status.funding.sponsor.appId') = ?
        AND json_extract(resource_json, '$.status.funding.sponsor.agent') = ?
        AND json_extract(resource_json, '$.status.funding.purpose') = 'ordinary'`,
      )
      .all(sponsor.appId, sponsor.agent);
    wakeTaskWorkloadConstraints(db, tasks, now);
    db.prepare(
      `UPDATE app_inbox_items SET handling = NULL, available_at = ?, changed_at = ?, updated_at = ?
      WHERE status != 'done' AND json_extract(handling, '$.phase') = 'deferred'
        AND json_extract(handling, '$.funding.reason') = 'sponsor-credit'
        AND json_extract(handling, '$.funding.sponsor.appId') = ?
        AND json_extract(handling, '$.funding.sponsor.agent') = ?
        AND json_extract(handling, '$.funding.purpose') = 'ordinary'`,
    ).run(now, now, now, sponsor.appId, sponsor.agent);
    return result;
  });
}

/** Trusted installation funding only. No creator, worker or model capability.
 * Join the cap receipt and exact affected recovery wakes in one transaction. */
export function changeTaskBudgetRootCredits(db: SqliteDb, input: RootBudgetFundingChange, now = Date.now()) {
  return stateTransaction(db, () => {
    const result = new TaskBudgetStore(db).setRootCredits(input, now);
    if (result.replay || input.credits <= input.expected.credits) return result;
    const root = input.expected.root;
    const tasks = db
      .prepare(
        `SELECT app_id, task_id FROM app_tasks
      WHERE json_valid(resource_json) AND json_extract(resource_json, '$.status.funding.reason') = 'root-credit'
        AND json_extract(resource_json, '$.status.funding.root.appId') = ?
        AND json_extract(resource_json, '$.status.funding.root.taskId') = ?`,
      )
      .all(root.appId, root.taskId);
    wakeTaskWorkloadConstraints(db, tasks, now);
    db.prepare(
      `UPDATE app_inbox_items SET handling = NULL, available_at = ?, changed_at = ?, updated_at = ?
      WHERE status != 'done' AND json_extract(handling, '$.phase') = 'deferred'
        AND json_extract(handling, '$.funding.reason') = 'root-credit'
        AND json_extract(handling, '$.funding.root.appId') = ?
        AND json_extract(handling, '$.funding.root.taskId') = ?`,
    ).run(now, now, now, root.appId, root.taskId);
    return result;
  });
}

/** Trusted installation adoption only, not a model or creator capability.
 * Account future starts without inventing historical charges, then wake exact
 * affected pending work through the existing resource and Inbox indexes. */
export function adoptTaskBudget(
  db: SqliteDb,
  input: {
    task: BudgetTaskRef;
    root: BudgetRoot;
    adoptionId: string;
    reason: string;
  },
  now = Date.now(),
): void {
  stateTransaction(db, () => {
    const store = AppTaskResourceStore.inspectFromDb(db, input.task.appId);
    if (store.appId !== input.task.appId) throw new Error("Budget adoption requires canonical App scope");
    const rootStore = AppTaskResourceStore.inspectFromDb(db, input.root.root.appId);
    if (rootStore.appId !== input.root.root.appId || !rootStore.readTask(input.root.root.taskId))
      throw new Error("Budget adoption requires an existing exact root Task");
    if (!store.readTask(input.task.taskId)) throw new Error("Budget adoption requires an existing exact Task");
    const budget = new TaskBudgetStore(db);
    const operation = {
      task: input.task,
      kind: "adoption" as const,
      adoptionId: input.adoptionId,
      reason: input.reason,
    };
    const previous = budget.receipt(operation);
    if (previous) {
      const current = budget.root(previous.root);
      // Adoption attributes future work. Its original allowance is bootstrap
      // input, not a command to undo later authorized funding on replay.
      if (!current || !isDeepStrictEqual({ ...input.root, credits: current.credits }, current))
        throw new Error("Replayed adoption cannot change root attribution");
      return;
    }
    budget.registerRoot(input.root);
    budget.bind(input.task, input.root.root);
    const receipt = budget.charge(operation, now);
    if (receipt.kind !== "admitted") throw new Error("Budget adoption must not spend credits");
    // registerRoot binds the root as well as the adopted contribution. Wake
    // both exact identities without changing another account or charging history.
    const identities = isDeepStrictEqual(input.task, input.root.root) ? [input.task] : [input.task, input.root.root];
    for (const task of identities) {
      const target = AppTaskResourceStore.inspectFromDb(db, task.appId);
      if (target.readTask(task.taskId)?.status.funding?.reason === "adoption-required")
        wakeTaskWorkloadConstraints(db, [{ app_id: task.appId, task_id: task.taskId }], now);
      db.prepare(
        `UPDATE app_inbox_items SET handling = NULL, available_at = ?, changed_at = ?, updated_at = ?
        WHERE status != 'done' AND json_extract(handling, '$.phase') = 'deferred'
          AND json_extract(handling, '$.funding.reason') = 'adoption-required'
          AND json_extract(handling, '$.funding.root.appId') = ?
          AND json_extract(handling, '$.funding.root.taskId') = ?`,
      ).run(now, now, now, task.appId, task.taskId);
    }
  });
}
