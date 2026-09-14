import { Check } from "typebox/value";
import type { AppDefinition, TaskIntent, TaskRevision } from "@may-agent/sdk";
import { isDeepStrictEqual } from "node:util";
import { stateTransaction, inStateTransaction } from "../../../lib/db/transaction.js";
import { assertResourceCreator } from "../state/resource-creator.js";
import { admitTaskInput } from "../state/inbox.js";
import type { AppTaskContext } from "./app-task-store.js";
import {
  hasPendingAppTaskFacts,
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
  const recheck = () => {
    if (!isDeepStrictEqual(authorize().spec, before.spec))
      throw new Error("Task requirements changed while mapping input; read the current Task");
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
  recheck();
  if (isDeepStrictEqual(readAppTaskIntent(target, change.taskId), intent))
    return { kind: "observed" as const, taskId: change.taskId, generation: before.metadata.generation, changed: false };
  return stateTransaction(db, () => {
    recheck();
    const key = `task-revision:${JSON.stringify([change.appId, change.taskId, change.expectedGeneration])}`;
    return admitTaskInput(target, {
      appId: change.appId,
      creator: { appId: actor.appId, taskId: actor.taskId },
      creatorRevision: true,
      attachment: { kind: "desired", intent },
      idempotencyKey: key,
      inputContext: { id: key, source: { kind: "app", id: actor.appId }, input: change.input },
    });
  });
}
