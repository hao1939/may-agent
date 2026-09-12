import { canonicalAppEvent } from "../../canonical-app-event.js";
import type { AgentEvent } from "../events/bus.js";
import type { AppTaskContext, TaskTree } from "./app-task-store.js";
import type { AppTaskInputWait, AppTaskResource, AppTaskTriggerEvent } from "./app-task-state.js";
import { APP_TASK_RECOVERY_OWNER } from "./session-binding.js";
import { matchesAppTaskConditionEvidence } from "./app-task-condition-tracker.js";

export function taskInputAdmissionKeys(
  events: readonly AppTaskTriggerEvent[],
  continued: readonly string[] = [],
): string[] {
  return [
    ...new Set([
      ...continued,
      ...events.flatMap(({ event }) => {
        const input = canonicalAppEvent(event as AgentEvent);
        return input.type === "app.task.requested" && typeof input.data.idempotencyKey === "string"
          ? [input.data.idempotencyKey]
          : [];
      }),
    ]),
  ];
}

export function retainTaskInputWait(
  config: AppTaskContext,
  task: AppTaskResource,
  keys: readonly string[],
  wait: AppTaskInputWait,
): void {
  if (!keys.length) return;
  const admissions = config.resourceStore.readTaskContext({ taskIds: [], admissionIds: [...keys] }).appTaskAdmissions;
  for (const key of keys) {
    const admission = admissions?.[key];
    if (
      admission?.taskId === task.metadata.id &&
      admission.taskGeneration === task.metadata.generation &&
      !admission.resultAttemptId
    ) {
      (task.status.inputWaits ??= {})[key] = structuredClone(wait);
    }
  }
}

/** Only evidence from an input's own saved wait can continue it in another attempt. */
export function continuedTaskInputKeys(
  config: AppTaskContext,
  tree: TaskTree,
  taskId: string,
  events: readonly AppTaskTriggerEvent[],
  readyConditionIds: readonly string[] = [],
): string[] {
  const task = tree.resources?.[taskId];
  if (!task?.status.inputWaits) return [];
  const children = new Set<string>();
  for (const { event } of events) {
    const input = canonicalAppEvent(event as AgentEvent);
    if (input.type !== "project.task.child-transitioned" || input.source !== APP_TASK_RECOVERY_OWNER) continue;
    const childId = input.data.childTaskId;
    if (typeof childId !== "string") continue;
    const child = tree.resources?.[childId];
    if (child?.spec.parentId !== taskId) continue;
    if (typeof input.data.resultAttemptId === "string") {
      const attempt = config.resourceStore.readAttempt(input.data.resultAttemptId);
      if (attempt?.taskId !== childId || !attempt.acceptedResult) continue;
      children.add(JSON.stringify([childId, attempt.taskGeneration]));
    } else {
      // Summary-only failure/closure wakes ask the owner to judge current child state.
      children.add(JSON.stringify([childId, child.metadata.generation]));
    }
  }
  const matchingConditionIds = (task.status.conditionIds ?? []).filter((id) =>
    events.some(({ event }) => matchesAppTaskConditionEvidence(tree.conditions?.[id], event)),
  );
  const conditions = new Map(
    [...readyConditionIds, ...matchingConditionIds].flatMap((id) => {
      const condition = tree.conditions?.[id];
      return condition ? [[id, condition.metadata.generation] as const] : [];
    }),
  );
  return Object.entries(task.status.inputWaits).flatMap(([key, wait]) =>
    wait.taskGeneration === task.metadata.generation &&
    ((wait.children.length === 0 && wait.conditions.length === 0 && events.length > 0) ||
      wait.children.some(({ id, generation }) => children.has(JSON.stringify([id, generation]))) ||
      wait.conditions.some(({ id, generation }) => conditions.get(id) === generation))
      ? [key]
      : [],
  );
}
