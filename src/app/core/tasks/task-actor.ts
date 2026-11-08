import type { AppTaskContext } from "./app-task-store.js";

/** Host-bound authority of one current attempt, never supplied by an agent payload. */
export type TaskControlActor = { appId: string; taskId: string; generation: number; attemptId: string };

export function assertCurrentTaskActor(
  source: Pick<AppTaskContext, "resourceStore">,
  actor: TaskControlActor,
  operation: string,
): void {
  const resource = source.resourceStore.readTask(actor.taskId);
  const attempt = source.resourceStore.readAttempt(actor.attemptId);
  if (
    source.resourceStore.appId !== actor.appId ||
    !resource ||
    source.resourceStore.isCancelled(actor.taskId) ||
    resource.metadata.generation !== actor.generation ||
    resource.status.currentAttemptId !== actor.attemptId ||
    attempt?.state !== "running" ||
    attempt.taskId !== actor.taskId ||
    attempt.taskGeneration !== actor.generation
  )
    throw new Error(`Task ${operation} caller is no longer current`);
}
