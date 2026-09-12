import { stateTransaction } from "../../../lib/db/transaction.js";
import { appendTaskTriggerEvent, preferredTriggerFromEvents } from "../tasks/app-task-reconciler.js";
import type { AppTaskContext } from "../tasks/app-task-store.js";
import type { AppTaskInputWait } from "../tasks/app-task-state.js";
import type { AppTaskResourceMutation } from "./app-task-resource-store.js";

/** Offline retirement of implicit child waits. Reconsider the original ask;
 * never invent an exact return link from a child's latest status.
 */
export function migrateTaskCoordination(config: AppTaskContext, input: { oldRuntimeStopped: boolean; now?: number }) {
  if (!input.oldRuntimeStopped) throw new Error("Task coordination cutover requires stopped workers");
  const store = config.resourceStore;
  return stateTransaction(store.db, () => {
    const tree = store.readSnapshot();
    const stamp = new Date(input.now ?? Date.now()).toISOString();
    const mutation: AppTaskResourceMutation = { fences: [], tasks: [] };
    let replayedInputs = 0;
    let reviews = 0;
    for (const resource of Object.values(tree.resources ?? {})) {
      const taskId = resource.metadata.id;
      if (tree.cancellations?.[taskId]) continue;
      if (resource.status.currentAttemptId)
        throw new Error(`Retire running attempts before coordination cutover: ${taskId}`);
      const originalVersion = resource.metadata.resourceVersion;
      const pending = tree.taskTriggers?.[taskId];
      let events = pending?.events ?? (pending ? [{ event: pending.event, observedAt: pending.observedAt }] : []);
      let changed = false;
      let reconsider = false;
      for (const [key, current] of Object.entries(resource.status.inputWaits ?? {})) {
        const wait = current as AppTaskInputWait & { children?: Array<{ id: string; generation: number }> };
        if (!Object.hasOwn(wait, "children")) continue;
        changed = true;
        const hadChildren = Boolean(wait.children?.length);
        delete wait.children;
        if (!hadChildren || wait.taskGeneration !== resource.metadata.generation) continue;
        delete resource.status.inputWaits![key];
        const admission = tree.appTaskAdmissions?.[key];
        if (admission?.resultAttemptId) continue;
        if (
          admission?.taskId !== taskId ||
          admission.taskGeneration !== resource.metadata.generation ||
          !admission.inputEvent
        )
          throw new Error(`Original input missing for structural wait: ${taskId}, ${key}`);
        events = appendTaskTriggerEvent(events, admission.inputEvent, admission.admittedAt);
        replayedInputs++;
        reconsider = true;
      }
      // A seeded parent may have waited implicitly without any admitted input.
      if (resource.status.phase === "waiting" && !resource.status.conditionIds?.length) reconsider = true;
      if (reconsider) {
        events = appendTaskTriggerEvent(
          events,
          {
            type: "app.task.coordination-retired",
            source: "offline-cutover",
            target: { taskId },
            data: {
              reason:
                "Parent links no longer wait for or return child outcomes. Review retained work and declare any required typed dependencies or Conditions.",
            },
          },
          stamp,
        );
        resource.status.phase = "pending";
        reviews++;
        changed = true;
      }
      if (!changed) continue;
      resource.metadata.resourceVersion++;
      resource.status.updatedAt = stamp;
      const trigger = reconsider
        ? {
            taskId,
            taskGeneration: resource.metadata.generation,
            resourceVersion: (pending?.resourceVersion ?? 0) + 1,
            events,
            event: preferredTriggerFromEvents(events, resource.spec.agent ?? config.agent),
            observedAt: stamp,
          }
        : pending;
      const nextCheckAt = store.db
        .prepare("SELECT next_check_at FROM app_tasks WHERE app_id = ? AND task_id = ?")
        .get(store.appId, taskId)?.next_check_at;
      mutation.fences.push({ taskId, resourceVersion: originalVersion });
      mutation.tasks!.push({
        resource,
        trigger,
        ready: resource.status.phase === "pending" || Boolean(trigger),
        nextCheckAt: typeof nextCheckAt === "number" ? nextCheckAt : null,
      });
    }
    if (mutation.fences.length && !store.commit(mutation)) throw new Error("Task coordination cutover lost its fence");
    return { tasks: mutation.fences.length, replayedInputs, reviews };
  });
}
