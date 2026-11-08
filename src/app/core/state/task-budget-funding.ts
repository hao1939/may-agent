import { isDeepStrictEqual } from "node:util";
import type { SqliteDb } from "../../../lib/db.js";
import { stateTransaction } from "../../../lib/db/transaction.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import {
  TaskBudgetStore,
  type BudgetRoot,
  type BudgetTaskRef,
  type RootBudgetFundingChange,
} from "./task-budget-store.js";

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
    for (const row of tasks) {
      const store = AppTaskResourceStore.inspectFromDb(db, row.app_id as string);
      const taskId = row.task_id as string;
      const resource = store.readTask(taskId);
      if (!resource || store.isCancelled(taskId)) continue;
      const version = resource.metadata.resourceVersion++;
      delete resource.status.funding;
      if (
        !store.commit({
          fences: [{ taskId, resourceVersion: version }],
          tasks: [{ resource, trigger: store.readTrigger(taskId) ?? undefined, ready: true, nextCheckAt: now }],
        })
      )
        throw new Error("Root funding lost its exact resource fence");
    }
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
    const resource = store.readTask(input.task.taskId)!;
    if (resource.status.funding?.reason === "adoption-required") {
      const version = resource.metadata.resourceVersion++;
      delete resource.status.funding;
      if (
        !store.commit({
          fences: [{ taskId: input.task.taskId, resourceVersion: version }],
          tasks: [
            { resource, trigger: store.readTrigger(input.task.taskId) ?? undefined, ready: true, nextCheckAt: now },
          ],
        })
      )
        throw new Error("Budget adoption lost its exact resource fence");
    }
    db.prepare(
      `UPDATE app_inbox_items SET handling = NULL, available_at = ?, changed_at = ?, updated_at = ?
      WHERE status != 'done' AND json_extract(handling, '$.phase') = 'deferred'
        AND json_extract(handling, '$.funding.reason') = 'adoption-required'
        AND json_extract(handling, '$.funding.root.appId') = ?
        AND json_extract(handling, '$.funding.root.taskId') = ?`,
    ).run(now, now, now, input.task.appId, input.task.taskId);
  });
}
