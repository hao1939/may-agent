import type { SqliteDb } from "../../../lib/db.js";
import { stateTransaction } from "../../../lib/db/transaction.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { TaskBudgetStore, type BudgetRoot, type BudgetTaskRef } from "./task-budget-store.js";

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
    budget.registerRoot(input.root);
    budget.bind(input.task, input.root.root);
    const receipt = budget.charge(
      { task: input.task, kind: "adoption", adoptionId: input.adoptionId, reason: input.reason },
      now,
    );
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
