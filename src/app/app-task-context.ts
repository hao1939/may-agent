/**
 * Task execution context: explicit scoped reads followed by pure projections.
 * No runtime registry, database-path lookup, lifecycle writes, or scheduling.
 */
import type { SqliteDb } from "../lib/db.js";
import { getAppInboxItem, type AppInboxItem } from "./app-inbox-store.js";
import type { AppTaskChildContext, AppTaskClaim } from "./app-task-reconciler.js";
import type { AppTaskCondition } from "./app-task-state.js";
import type { AppTaskResourceStore } from "./app-task-resource-store.js";
import { canonicalAppEvent } from "./canonical-app-event.js";
import type { AgentEvent } from "./core/events/bus.js";

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
      condition.spec.type === "app.dependency.completed" && condition.spec.subject.startsWith("id:")
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
    };
  }>;
  note: string;
} {
  const open = waits.flatMap(({ conditionId, condition, dependency: item }) => {
    if (!condition || condition.status.state === "true") return [];
    const requestId =
      condition.spec.type === "app.dependency.completed" && condition.spec.subject.startsWith("id:")
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
              },
            }
          : {}),
      },
    ];
  });
  return {
    open,
    note: "These are accepted waits on this Task and remain part of its current state. Reconcile new events against the Task goal and these waits. Preserve a still-valid wait by requestId; create or replace work only when the goal requires it, never merely because the wait was absent from prose or child summaries. targetTaskId is the request's original target and must be preserved when redeclaring it. resolvedTaskId is only the Task created or found by that request; do not copy it into taskId when targetTaskId is absent.",
  };
}

const MAX_PROMPT_CHILD_TEXT = 256;
const MAX_PROMPT_CHILD_EVIDENCE = 2;

function boundedPromptChildText(value: string): string {
  return value.length <= MAX_PROMPT_CHILD_TEXT ? value : `${value.slice(0, MAX_PROMPT_CHILD_TEXT - 3)}...`;
}

/**
 * Keep agent/workflow prompts decision-ready without copying each child Task's
 * full input and Condition definitions into every parent attempt. Exact child
 * resources remain available through the scoped Task read API.
 */
export function projectAppTaskChildPromptContext(context: AppTaskChildContext) {
  const evidence = (items: string[]) =>
    items.slice(0, MAX_PROMPT_CHILD_EVIDENCE).map((item) => boundedPromptChildText(item));
  return {
    ...(context.cancelled?.length
      ? {
          cancelled: context.cancelled.map((child) => ({
            ...child,
            outcome: boundedPromptChildText(child.outcome),
            summary: boundedPromptChildText(child.summary),
            evidence: evidence(child.evidence),
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
      evidence: evidence(child.evidence),
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
      evidence: evidence(child.evidence),
      completedAt: child.completedAt,
    })),
    note: "This is a bounded status summary. Use tasks.get for a child's exact input or Conditions.",
  };
}
