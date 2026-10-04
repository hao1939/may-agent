import { isDeepStrictEqual } from "node:util";
import { getAppInboxItem } from "../state/app-inbox-store.js";
import { listConversationInputRequests } from "../state/conversation-requests.js";
import { readConversationInputTopicId } from "../state/conversations.js";
import { canonicalAppEvent } from "../../canonical-app-event.js";
import type { AgentEvent } from "../events/bus.js";
import type { AppTaskContext, TaskTree } from "./app-task-store.js";
import type { AppTaskInputWait, AppTaskResource, AppTaskTriggerEvent } from "./app-task-state.js";
import { matchesAppTaskConditionFacts } from "./app-task-condition-tracker.js";

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
      admission.taskGeneration <= task.metadata.generation &&
      !admission.resultAttemptId
    ) {
      (task.status.inputWaits ??= {})[key] = structuredClone(wait);
    }
  }
}

/** Continue exact waits, or return obsolete waits to the agent for reconsideration. */
export function continuedTaskInputKeys(
  tree: TaskTree,
  taskId: string,
  events: readonly AppTaskTriggerEvent[],
  readyConditionIds: readonly string[] = [],
): string[] {
  const task = tree.resources?.[taskId];
  if (!task?.status.inputWaits) return [];
  const linkedConditionIds = new Set(task.status.conditionIds ?? []);
  const matchingConditionIds = (task.status.conditionIds ?? []).filter((id) =>
    events.some(({ event }) => matchesAppTaskConditionFacts(tree.conditions?.[id], event)),
  );
  const conditions = new Map(
    [...readyConditionIds, ...matchingConditionIds].flatMap((id) => {
      const condition = tree.conditions?.[id];
      return condition ? [[id, condition.metadata.generation] as const] : [];
    }),
  );
  return Object.entries(task.status.inputWaits).flatMap(([key, wait]) =>
    wait.pending || wait.taskGeneration < task.metadata.generation ||
    (wait.reviewAt !== undefined && wait.reviewAt <= Date.now()) ||
    (wait.conditions.length === 0 && wait.reviewAt === undefined && events.length > 0) ||
    wait.conditions.some(
      ({ id, generation }) => !linkedConditionIds.has(id) || tree.conditions?.[id]?.metadata.generation !== generation,
    ) ||
    wait.conditions.some(({ id, generation }) => conditions.get(id) === generation)
      ? [key]
      : [],
  );
}

/** Read one admission for every addressed input; communication is optional context. */
export function readTaskInputs(
  config: AppTaskContext,
  claim: Pick<
    import("./app-task-reconciler.js").AppTaskClaim,
    "taskId" | "generation" | "events" | "continuedInputKeys"
  >,
): import("@may-agent/sdk").TaskInput[] {
  const keys = taskInputAdmissionKeys(claim.events, claim.continuedInputKeys);
  const admissions = config.resourceStore.readTaskContext({ taskIds: [], admissionIds: keys }).appTaskAdmissions;
  return keys.map((key) => {
    const admission = admissions?.[key];
    const request = admission?.inputEvent?.data as { request?: import("@may-agent/sdk").AppTaskInput } | undefined;
    if (
      !admission ||
      admission.taskId !== claim.taskId ||
      admission.taskGeneration > claim.generation ||
      !request?.request
    )
      throw new Error("Task input does not belong to this Task admission");
    const original = request.request;
    // Legacy handoffs used the caller's inbox id with a separate, durable admission.
    // That is contribution context, not authority over the caller's communication.
    const item = key.startsWith("conversation-follow-up:")
      ? null
      : getAppInboxItem(config.resourceStore.db, original.id);
    if (
      item &&
      (item.appId !== config.resourceStore.appId ||
        item.taskAdmissionKey !== key ||
        (item.executionTaskId ?? (item.waitingOn?.kind === "task" ? item.waitingOn.id : undefined)) !== claim.taskId ||
        !isDeepStrictEqual(item.source, original.source) ||
        !isDeepStrictEqual(item.input, original.input))
    )
      throw new Error("Task input does not match its saved communication or return context");
    return {
      ...structuredClone(original),
      key,
      ...(item?.conversationId
        ? {
            communication: {
              conversationId: item.conversationId,
              replyTo: item.source.id,
              topicId: readConversationInputTopicId(config.resourceStore.db, item),
              ...(item.replyToSourceId ? { inReplyTo: item.replyToSourceId } : {}),
              requestIds: listConversationInputRequests(config.resourceStore.db, item.appId, item.conversationId, [
                item.id,
              ]).map(({ id }) => id),
            },
          }
        : {}),
    };
  });
}
