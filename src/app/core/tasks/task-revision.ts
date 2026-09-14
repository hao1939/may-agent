import { Check } from "typebox/value";
import type { AppDefinition, TaskIntent, TaskRevision } from "@may-agent/sdk";
import { isDeepStrictEqual } from "node:util";
import { stateTransaction, inStateTransaction } from "../../../lib/db/transaction.js";
import { assertResourceCreator } from "../state/resource-creator.js";
import { admitTaskInput, linkTaskInput } from "../state/inbox.js";
import { listAppInboxItemsWaitingOnTask } from "../state/app-inbox-store.js";
import type { AppTaskContext } from "./app-task-store.js";
import {
  hasPendingAppTaskFacts,
  readAppTaskAdmissionOutcome,
  readAppTaskIntent,
  validateIntent,
} from "./app-task-reconciler.js";
import { normalizeTaskAgent } from "../../app-agent-selection.js";

export type TaskRevisionActor = { appId: string; taskId: string; generation: number; attemptId: string };

/** One creator operation for every Task executor, independent of its input route. */
export function reviseAppTask(input: {
  source: AppTaskContext;
  target: AppTaskContext;
  app: Readonly<AppDefinition>;
  actor: TaskRevisionActor;
  change: TaskRevision;
  interrupt?: (sessionIds: string[]) => void;
}) {
  const { source, target, app, actor, change } = input;
  const db = source.resourceStore.db;
  if (
    db !== target.resourceStore.db ||
    source.resourceStore.appId !== actor.appId ||
    target.resourceStore.appId !== change.appId ||
    app.id !== change.appId
  )
    throw new Error("Task revision must use the current Host and exact Apps");
  if (actor.appId === change.appId && actor.taskId === change.taskId)
    throw new Error("A worker cannot revise its own assignment; return feedback to its creator");
  if (inStateTransaction(db)) throw new Error("Task revision must run outside result settlement");
  if (!app.task || !Check(app.inputSchema, change.input))
    throw new Error("Invalid revision input for the responsible App");
  const authorize = () => {
    const resource = source.resourceStore.readTask(actor.taskId);
    const attempt = source.resourceStore.readAttempt(actor.attemptId);
    if (
      !resource ||
      source.resourceStore.isCancelled(actor.taskId) ||
      resource.metadata.generation !== actor.generation ||
      resource.status.currentAttemptId !== actor.attemptId ||
      attempt?.state !== "running" ||
      attempt.taskId !== actor.taskId ||
      attempt.taskGeneration !== actor.generation
    )
      throw new Error("Task revision caller is no longer current");
    if (hasPendingAppTaskFacts(source, actor))
      throw new Error("New caller input must be reviewed before revising work");
    const current = target.resourceStore.readTask(change.taskId);
    assertResourceCreator(current?.metadata.creator, { appId: actor.appId, taskId: actor.taskId });
    if (!current || current.metadata.generation !== change.expectedGeneration)
      throw new Error("Task requirements changed; read the current Task before revising it");
    if (target.resourceStore.isCancelled(change.taskId)) throw new Error("Cannot revise a closed Task");
    return current;
  };
  const before = authorize();
  const pendingInputs = () =>
    listAppInboxItemsWaitingOnTask(db, change.appId, change.taskId).filter(
      (item) => !item.taskAdmissionKey || !readAppTaskAdmissionOutcome(target, change.taskId, item.taskAdmissionKey),
    );
  const ownedInputs = () => {
    const items = pendingInputs();
    for (const item of items) {
      if (!isDeepStrictEqual(item.creator, { appId: actor.appId, taskId: actor.taskId }))
        throw new Error("Another caller still awaits this Task's current answer; retry after it finishes");
    }
    return items;
  };
  const attachment = app.task({
    id: change.taskId,
    source: { kind: "app", id: actor.appId },
    input: change.input,
  });
  if (attachment?.kind !== "desired") throw new Error("The App must resolve revised input to desired requirements");
  // The input describes new requirements, never a new Task or a new parent.
  const intent: TaskIntent = normalizeTaskAgent({
    ...attachment.intent,
    id: change.taskId,
    parentId: before.spec.parentId,
  });
  validateIntent(intent);
  if (authorize().metadata.resourceVersion !== before.metadata.resourceVersion)
    throw new Error("Task changed while the App mapped its revised input");
  if (isDeepStrictEqual(readAppTaskIntent(target, change.taskId), intent))
    return { kind: "observed" as const, taskId: change.taskId, generation: before.metadata.generation, changed: false };
  ownedInputs();
  const sessionId = before.status.currentAttemptId
    ? target.resourceStore.readAttempt(before.status.currentAttemptId)?.sessionId
    : undefined;
  if (before.status.currentAttemptId && !sessionId)
    throw new Error("The current execution has no session cleanup capability; retry after it finishes");
  if (sessionId) {
    if (!input.interrupt) throw new Error("Task revision requires execution cleanup");
    input.interrupt([sessionId]);
  }
  return stateTransaction(db, () => {
    const current = authorize();
    if (current.metadata.resourceVersion !== before.metadata.resourceVersion)
      throw new Error("Task changed during revision preparation; read its current state");
    const items = ownedInputs();
    const key = `task-revision:${JSON.stringify([change.appId, change.taskId, change.expectedGeneration, before.metadata.resourceVersion])}`;
    const result = admitTaskInput(target, {
      appId: change.appId,
      creator: { appId: actor.appId, taskId: actor.taskId },
      creatorRevision: true,
      attachment: { kind: "desired", intent },
      idempotencyKey: key,
      inputContext: { id: key, source: { kind: "app", id: actor.appId }, input: change.input },
    });
    // Retain the caller's exact wait and old input evidence. Only its unfinished
    // result link follows the new admission; accepted answers stay immutable.
    for (const item of items) linkTaskInput(db, item.id, change.taskId, key);
    return result;
  });
}
