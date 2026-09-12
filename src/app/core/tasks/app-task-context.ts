/**
 * Task execution context: explicit scoped reads followed by pure projections.
 * No runtime registry, database-path lookup, lifecycle writes, or scheduling.
 */
import type { TaskAttempt } from "@may-agent/sdk";
import type { SqliteDb } from "../../../lib/db.js";
import { getAppInboxItem, type AppInboxItem } from "../state/app-inbox-store.js";
import type { AppTaskChildContext, AppTaskClaim } from "./app-task-reconciler.js";
import type { AppTaskCondition } from "./app-task-state.js";
import type { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { canonicalAppEvent } from "../../canonical-app-event.js";
import type { AgentEvent } from "../events/bus.js";
import type { AppTaskContext } from "./app-task-store.js";
import { continuedTaskInputKeys } from "./app-task-inputs.js";
type TaskReconciliationEvents = TaskAttempt["events"];

/** Project the exact persisted attempt batch onto the public workflow contract. */
export function projectAppTaskReconciliationEvents(claim: Pick<AppTaskClaim, "events" | "eventsTruncated">): {
  items: Array<{
    eventId?: number;
    observedAt: string;
    event: ReturnType<typeof canonicalAppEvent>;
  }>;
  throughEventId?: number;
  truncated: boolean;
} {
  const items = claim.events.map((entry) => {
    const eventId = Number(entry.event.eventId);
    return {
      ...(Number.isSafeInteger(eventId) && eventId > 0 ? { eventId } : {}),
      observedAt: entry.observedAt,
      event: canonicalAppEvent(entry.event as AgentEvent),
    };
  });
  const eventIds = items.flatMap((item) => (item.eventId === undefined ? [] : [item.eventId]));
  return {
    items,
    ...(eventIds.length === items.length && eventIds.length > 0 ? { throughEventId: Math.max(...eventIds) } : {}),
    truncated: claim.eventsTruncated,
  };
}

/** Resolve durable return links before asking the executor to judge their facts. */
export function readAppTaskReconciliationEvents(
  store: Pick<AppTaskResourceStore, "readAttempt" | "readTask" | "readTaskContext">,
  claim: Pick<AppTaskClaim, "taskId" | "events" | "eventsTruncated" | "continuedInputKeys">,
): TaskReconciliationEvents {
  const projected: TaskReconciliationEvents = projectAppTaskReconciliationEvents(claim);
  if (claim.continuedInputKeys?.length) {
    const admissions = store.readTaskContext({ taskIds: [], admissionIds: claim.continuedInputKeys }).appTaskAdmissions;
    const generation = store.readTask(claim.taskId)?.metadata.generation;
    projected.continuedInputs = claim.continuedInputKeys.flatMap((key) => {
      const admission = admissions?.[key];
      return admission?.taskId === claim.taskId && admission.taskGeneration === generation &&
        !admission.resultAttemptId && admission.inputEvent
        ? [{ observedAt: admission.admittedAt, event: canonicalAppEvent(admission.inputEvent as AgentEvent) }] : [];
    });
  }
  return projected;
}

/** Live feedback carries the same original ask and accepted dependency facts as a later attempt. */
export function readAppTaskLiveEvent(config: AppTaskContext, taskId: string, event: AgentEvent) {
  const tree = config.resourceStore.readTaskContext({ taskIds: [taskId] });
  const events = [{ event: event as Record<string, unknown>, observedAt: new Date().toISOString() }];
  const projected = readAppTaskReconciliationEvents(config.resourceStore, {
    taskId, events, eventsTruncated: false,
    continuedInputKeys: continuedTaskInputKeys(tree, taskId, events),
  });
  const incoming = projected.items[0]!.event;
  const data = { ...incoming.data };
  delete data.continuedInputs;
  if (projected.continuedInputs?.length) data.continuedInputs = projected.continuedInputs;
  return Object.freeze({ ...incoming, data: Object.freeze(data) });
}

type AppTaskWaitObservation = {
  conditionId: string;
  condition: AppTaskCondition;
  dependency?: Pick<AppInboxItem, "appId" | "status" | "targetTaskId" | "waitingOn"> | null;
};

/** Read only this Task's accepted waits and their exact correlated requests. */
export function readAppTaskWaitPromptContext(
  resourceStore: Pick<AppTaskResourceStore, "readTaskContext">,
  db: SqliteDb | null,
  taskId: string,
) {
  const tree = resourceStore.readTaskContext({ taskIds: [taskId] });
  const resource = tree.resources?.[taskId];
  const waits = (resource?.status.conditionIds ?? []).flatMap((conditionId) => {
    const condition = tree.conditions?.[conditionId];
    if (!condition || condition.status.state === "true") return [];
    const requestId =
      condition.spec.type === "app.dependency.updated" && condition.spec.subject.startsWith("id:")
        ? condition.spec.subject.slice(3)
        : "";
    return [
      {
        conditionId,
        condition,
        dependency: requestId && db ? getAppInboxItem(db, requestId) : null,
      },
    ];
  });
  return projectAppTaskWaitPromptContext(waits);
}

/** Current accepted waits supplied to every executor before it judges feedback. */
export function projectAppTaskWaitPromptContext(waits: readonly AppTaskWaitObservation[]): {
  open: Array<{
    conditionId: string;
    type: string;
    subject: string;
    state: string;
    dependency?: {
      requestId: string;
      appId: string;
      status: string;
      targetTaskId?: string;
      resolvedTaskId?: string;
      report?: unknown;
    };
  }>;
  note: string;
} {
  const open = waits.flatMap(({ conditionId, condition, dependency: item }) => {
    if (!condition || condition.status.state === "true") return [];
    const requestId =
      condition.spec.type === "app.dependency.updated" && condition.spec.subject.startsWith("id:")
        ? condition.spec.subject.slice(3)
        : "";
    return [
      {
        conditionId,
        type: condition.spec.type,
        subject: condition.spec.subject,
        state: condition.status.state,
        ...(item
          ? {
              dependency: {
                requestId,
                appId: item.appId,
                status: item.status,
                ...(item.targetTaskId ? { targetTaskId: item.targetTaskId } : {}),
                ...(item.waitingOn?.kind === "task" ? { resolvedTaskId: item.waitingOn.id } : {}),
                ...(condition.status.state === "false" && condition.status.observed
                  ? { report: condition.status.observed } : {}),
              },
            }
          : {}),
      },
    ];
  });
  return {
    open,
    note: "These accepted waits remain part of the Task's state. Judge new facts against the goal and these obligations. Return waiting without redeclaring unchanged waits; code retains their identities and observations. Propose new or changed work only when the goal requires it, never merely because a wait was absent from prose or child summaries.",
  };
}

const MAX_PROMPT_CHILD_TEXT = 256;
const MAX_PROMPT_CHILD_FACTS = 2;

function boundedPromptChildText(value: string): string {
  return value.length <= MAX_PROMPT_CHILD_TEXT ? value : `${value.slice(0, MAX_PROMPT_CHILD_TEXT - 3)}...`;
}

/**
 * Keep agent/workflow prompts decision-ready without copying each child Task's
 * full input and Condition definitions into every parent attempt. Exact child
 * resources remain available through the scoped Task read API.
 */
export function projectAppTaskChildPromptContext(context: AppTaskChildContext) {
  const facts = (items: string[]) =>
    items.slice(0, MAX_PROMPT_CHILD_FACTS).map((item) => boundedPromptChildText(item));
  return {
    ...(context.cancelled?.length
      ? {
          cancelled: context.cancelled.map((child) => ({
            ...child,
            outcome: boundedPromptChildText(child.outcome),
            summary: boundedPromptChildText(child.summary),
            facts: facts(child.facts),
          })),
        }
      : {}),
    live: context.live.map((child) => ({
      taskId: child.taskId,
      generation: child.generation,
      phase: child.phase,
      outcome: boundedPromptChildText(child.outcome),
      ...(child.agent ? { agent: child.agent } : {}),
      ...(child.workflow ? { workflow: child.workflow } : {}),
      ...(child.executor ? { executor: child.executor } : {}),
      ...(child.priority ? { priority: child.priority } : {}),
      ...(child.category ? { category: child.category } : {}),
      ...(child.dependsOn?.length ? { dependsOn: child.dependsOn } : {}),
      ...(child.readiness
        ? {
            readiness: {
              ...child.readiness,
              reason: boundedPromptChildText(child.readiness.reason),
            },
          }
        : {}),
      ...(child.latestAttempt
        ? {
            latestAttempt: {
              ...child.latestAttempt,
              ...(child.latestAttempt.failureReason
                ? { failureReason: boundedPromptChildText(child.latestAttempt.failureReason) }
                : {}),
            },
          }
        : {}),
      hasLiveChildren: child.hasLiveChildren,
      ...(child.updatedAt ? { updatedAt: child.updatedAt } : {}),
      ...(child.summary ? { summary: boundedPromptChildText(child.summary) } : {}),
      facts: facts(child.facts),
    })),
    completed: context.completed.map((child) => ({
      taskId: child.taskId,
      generation: child.generation,
      outcome: boundedPromptChildText(child.outcome),
      agent: child.agent,
      ...(child.workflow ? { workflow: child.workflow } : {}),
      ...(child.executor ? { executor: child.executor } : {}),
      ...(child.priority ? { priority: child.priority } : {}),
      summary: boundedPromptChildText(child.summary),
      facts: facts(child.facts),
      completedAt: child.completedAt,
    })),
    note: "This is a bounded status summary. Use tasks.get for a child's exact input or Conditions.",
  };
}
