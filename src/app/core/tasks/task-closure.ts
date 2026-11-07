import type { TaskClosure } from "@may-agent/sdk";
import { inStateTransaction, stateTransaction } from "../../../lib/db/transaction.js";
import type { AppTaskContext } from "./app-task-store.js";
import { closeAppTask } from "./app-task-reconciler.js";
import { assertCurrentTaskActor, type TaskControlActor } from "./task-actor.js";

/** Explicit creator disposition; never inferred from an attempt's convergence. */
export function closeCreatedAppTask(input: {
  source: AppTaskContext;
  target: AppTaskContext;
  actor: TaskControlActor;
  change: TaskClosure;
}): ReturnType<typeof closeAppTask> {
  const { source, target, actor, change } = input;
  const db = source.resourceStore.db;
  if (db !== target.resourceStore.db || target.resourceStore.appId !== change.appId)
    throw new Error("Task closure must use the current Host and exact Apps");
  if (actor.appId === change.appId && actor.taskId === change.taskId)
    throw new Error("A worker cannot close its own assignment; return feedback to its creator");
  if (inStateTransaction(db)) throw new Error("Task closure must run outside result settlement");
  if (
    !Number.isSafeInteger(change.expectedGeneration) ||
    change.expectedGeneration < 1 ||
    !Number.isSafeInteger(change.expectedResourceVersion) ||
    change.expectedResourceVersion < 1
  )
    throw new Error("Task closure requires positive expectedGeneration and expectedResourceVersion");
  if (!change.reason.trim()) throw new Error("Task closure requires an owner disposition reason");
  return stateTransaction(db, () => {
    assertCurrentTaskActor(source, actor, "closure");
    return closeAppTask(target, { ...change, actor: { appId: actor.appId, taskId: actor.taskId } });
  });
}
