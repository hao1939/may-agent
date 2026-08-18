import {
  readTaskState,
  saveTaskState,
  withTaskStateLock,
  type TaskStateConfig,
  type TaskTree,
} from "./app-task-store.js";
import type { AppTaskCondition as AppTaskCondition } from "./app-task-state.js";
import {
  appTaskConditionRoutesByEventType,
  readAppTaskConditionRoutes,
  writeAppTaskConditionRouteIndex,
} from "./app-task-condition-index.js";

export type AppTaskConditionWake = {
  conditionId: string;
  taskId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]),
  );
}

function isCondition(value: unknown): value is AppTaskCondition {
  if (!isRecord(value) || !isRecord(value.metadata) || !isRecord(value.spec) || !isRecord(value.status)) {
    return false;
  }
  return (
    typeof value.metadata.id === "string" &&
    Number.isInteger(value.metadata.generation) &&
    Number.isInteger(value.metadata.resourceVersion) &&
    typeof value.spec.type === "string" &&
    typeof value.spec.subject === "string" &&
    ["unknown", "false", "true"].includes(String(value.status.state))
  );
}

function eventField(event: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) {
    if (event[name] !== undefined) return event[name];
  }
  const target = isRecord(event.target) ? event.target : {};
  for (const name of names) {
    if (target[name] !== undefined) return target[name];
  }
  return undefined;
}

function normalizedState(value: unknown): string {
  const state = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (["converged", "complete", "completed", "success", "succeeded"].includes(state)) return "done";
  return state;
}

function stableEquals(left: unknown, right: unknown): boolean {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function orderedComparablePair(left: unknown, right: unknown): [number | string, number | string] | null {
  const leftNumber = typeof left === "number" ? left : typeof left === "string" ? Number(left) : NaN;
  const rightNumber = typeof right === "number" ? right : typeof right === "string" ? Number(right) : NaN;
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return [leftNumber, rightNumber];
  if (typeof left === "string" && typeof right === "string") return [left, right];
  return null;
}

function matchesComparator(actual: unknown, expected: unknown): boolean {
  if (!isRecord(expected)) return false;
  const operators = ["gt", "gte", "lt", "lte"].filter((key) => key in expected);
  if (operators.length === 0) return false;
  const pair = operators
    .map((operator) => [operator, orderedComparablePair(actual, expected[operator])] as const)
    .every(([, comparable]) => comparable !== null);
  if (!pair) return false;
  return operators.every((operator) => {
    const comparable = orderedComparablePair(actual, expected[operator]);
    if (!comparable) return false;
    const [left, right] = comparable;
    switch (operator) {
      case "gt":
        return left > right;
      case "gte":
        return left >= right;
      case "lt":
        return left < right;
      case "lte":
        return left <= right;
      default:
        return false;
    }
  });
}

function typedSubject(subject: string): { field: string; value: string } | null {
  const separator = subject.indexOf(":");
  if (separator <= 0 || separator === subject.length - 1) return null;
  const kind = subject.slice(0, separator);
  const field =
    (
      {
        task: "taskId",
        session: "sessionId",
        "workflow-run": "workflowRunId",
        metric: "metricId",
        alert: "alertId",
        project: "project",
        "pipeline-run": "pipelineRunId",
        "pull-request": "pullRequestId",
      } as Record<string, string>
    )[kind] ?? (/^[A-Za-z][A-Za-z0-9_.-]*$/.test(kind) ? kind : "");
  return field ? { field, value: subject.slice(separator + 1) } : null;
}

function fieldAliases(field: string): string[] {
  return (
    {
      taskId: ["taskId", "task_id"],
      sessionId: ["sessionId", "session_id"],
      workflowRunId: ["workflowRunId", "workflow_run_id", "runId"],
      metricId: ["metricId", "metric_id"],
      alertId: ["alertId", "alert_id"],
      project: ["project", "projectId", "project_id"],
      pipelineRunId: ["pipelineRunId", "pipeline_run_id", "runId", "run_id"],
      pullRequestId: ["pullRequestId", "pull_request_id", "prId", "pr_id"],
    }[field] ?? [field]
  );
}

function timestampMillis(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isFreshLevelObservation(condition: AppTaskCondition, event: Record<string, unknown>): boolean {
  const levelObservation =
    condition.spec.type === "aks.repo-ref.observed" ||
    condition.spec.type.endsWith(".state") ||
    condition.spec.type.endsWith(".check") ||
    condition.spec.type.endsWith(".pulse") ||
    condition.spec.type.endsWith("-pulse");
  if (!levelObservation) return true;
  const conditionEstablishedAt = timestampMillis(condition.status.observedAt);
  const eventObservedAt = timestampMillis(event.timestamp);
  if (conditionEstablishedAt === null || eventObservedAt === null) return true;
  return eventObservedAt >= conditionEstablishedAt;
}

function matchesExpectedField(expected: Record<string, unknown>, event: Record<string, unknown>): boolean {
  const expectedField = expected.field;
  if (typeof expectedField !== "string" || !expectedField.trim()) return true;
  const actual = eventField(event, ...fieldAliases(expectedField));
  const anyOf = expected.anyOf;
  if (Array.isArray(anyOf)) {
    return anyOf.some((candidate) => stableEquals(candidate, actual));
  }
  if ("equals" in expected) {
    return stableEquals(expected.equals, actual);
  }
  if ("notEquals" in expected) {
    return actual !== undefined && !stableEquals(expected.notEquals, actual);
  }
  return matchesComparator(actual, expected);
}

function matchesExpectedRecord(expected: Record<string, unknown>, event: Record<string, unknown>): boolean {
  if (!matchesExpectedField(expected, event)) return false;
  return Object.entries(expected).every(([field, value]) => {
    if (
      field === "field" ||
      field === "anyOf" ||
      field === "equals" ||
      field === "notEquals" ||
      field === "gt" ||
      field === "gte" ||
      field === "lt" ||
      field === "lte"
    ) {
      return true;
    }
    if ((field === "allowedDecisions" || field === "acceptedDecisions") && Array.isArray(value)) {
      const actualDecision = eventField(event, "decision");
      return value.some((candidate) => stableEquals(candidate, actualDecision));
    }
    const actual = eventField(event, ...fieldAliases(field));
    return matchesComparator(actual, value) || stableEquals(actual, value);
  });
}

function matches(condition: AppTaskCondition, event: Record<string, unknown>): boolean {
  if (condition.spec.type !== event.type) return false;
  // Level observations are not immutable historical facts. A newly declared
  // wait must not be satisfied by an older state, check, or pulse replayed from
  // the event journal. Only an observation made at or after the Condition was
  // established can prove that the external level subsequently changed.
  if (!isFreshLevelObservation(condition, event)) return false;
  const subject = typedSubject(condition.spec.subject);
  if (!subject) return false;
  if (String(eventField(event, ...fieldAliases(subject.field)) ?? "") !== subject.value) return false;

  if (isRecord(condition.spec.expected)) {
    return matchesExpectedRecord(condition.spec.expected, event);
  }

  const actual = eventField(event, "state", "status", "disposition", "result", "outcome");
  if (typeof condition.spec.expected === "string") {
    return normalizedState(actual) === normalizedState(condition.spec.expected);
  }
  return stableEquals(actual, condition.spec.expected);
}

function observation(event: Record<string, unknown>): Record<string, unknown> {
  return {
    eventType: event.type,
    source: event.source,
    taskId: eventField(event, "taskId", "task_id"),
    sessionId: eventField(event, "sessionId", "session_id"),
    workflowRunId: eventField(event, "workflowRunId", "workflow_run_id", "runId"),
    pipelineRunId: eventField(event, "pipelineRunId", "pipeline_run_id", "runId", "run_id"),
    pullRequestId: eventField(event, "pullRequestId", "pull_request_id", "prId", "pr_id"),
    sourceCommit: eventField(event, "sourceCommit", "source_commit"),
    state: eventField(event, "state", "status", "disposition", "result", "outcome"),
    timestamp: event.timestamp,
  };
}

function applyConditionEvent(
  tree: TaskTree,
  event: Record<string, unknown>,
  wakes: Map<string, AppTaskConditionWake>,
  allowedTaskIds?: ReadonlySet<string>,
): boolean {
  const now = new Date().toISOString();
  let changed = false;
  const eventWakes = new Map<string, AppTaskConditionWake>();

  for (const [id, condition] of Object.entries(tree.conditions ?? {})) {
    if (!isCondition(condition)) continue;
    if (!matches(condition, event)) continue;
    const waitingResources = Object.values(tree.resources ?? {}).filter(
      (resource) =>
        resource.status.phase === "waiting" &&
        resource.status.conditionIds?.includes(id) &&
        (!allowedTaskIds || allowedTaskIds.has(resource.metadata.id)),
    );
    if (allowedTaskIds && waitingResources.length === 0) continue;
    if (condition.status.state !== "true") {
      condition.metadata.resourceVersion += 1;
      condition.status = {
        observedGeneration: condition.metadata.generation,
        state: "true",
        observed: observation(event),
        observedAt: now,
        evidence: [`event:${String(event.type)}`, ...(event.source ? [`source:${String(event.source)}`] : [])],
      };
      changed = true;
    }
    for (const resource of waitingResources) {
      const taskId = resource.metadata.id;
      if (eventWakes.has(taskId)) continue;
      eventWakes.set(taskId, {
        conditionId: id,
        taskId,
      });
    }
  }

  for (const wake of eventWakes.values()) {
    const resource = tree.resources?.[wake.taskId];
    if (!resource) continue;
    const previous = tree.taskTriggers?.[wake.taskId];
    tree.taskTriggers = {
      ...(tree.taskTriggers ?? {}),
      [wake.taskId]: {
        taskId: wake.taskId,
        taskGeneration: resource.metadata.generation,
        resourceVersion: (previous?.resourceVersion ?? 0) + 1,
        event: structuredClone(event),
        observedAt: now,
      },
    };
    wakes.set(wake.taskId, wake);
    changed = true;
  }

  return changed;
}

/**
 * Re-evaluate one already-persisted event against the current Condition level.
 *
 * The task reconciler uses this when an event arrived while a task was running
 * and the task only declared its next wait at the end of that attempt.
 */
export function applyAppTaskConditionEvent(tree: TaskTree, event: Record<string, unknown>): AppTaskConditionWake[] {
  const wakes = new Map<string, AppTaskConditionWake>();
  applyConditionEvent(tree, event, wakes);
  return [...wakes.values()];
}

/** Correlate semantic observations with durable Conditions in one state transaction. */
export function trackAppTaskConditionEvents(
  config: TaskStateConfig,
  events: Iterable<Record<string, unknown>>,
): AppTaskConditionWake[] {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const wakes = new Map<string, AppTaskConditionWake>();
    let changed = false;
    for (const event of events) {
      changed = applyConditionEvent(tree, event, wakes) || changed;
    }

    if (changed) saveTaskState(config, tree);
    return [...wakes.values()];
  });
}

/** Correlate one semantic observation with durable Conditions; never observes the domain source itself. */
export function trackAppTaskConditionEvent(
  config: TaskStateConfig,
  event: Record<string, unknown>,
): AppTaskConditionWake[] {
  return trackAppTaskConditionEvents(config, [event]);
}

/** Read-only canonical-state preflight used before the App router chooses a route. */
export function matchingAppTaskConditionTaskIds(
  config: TaskStateConfig,
  event: Record<string, unknown>,
  allowedTaskIds?: Iterable<string>,
): string[] {
  const allowed = allowedTaskIds ? new Set(allowedTaskIds) : undefined;
  const eventType = typeof event.type === "string" ? event.type : "";
  let routes = readAppTaskConditionRoutes(config, eventType);
  if (routes === null) {
    const tree = readTaskState(config);
    routes = appTaskConditionRoutesByEventType(tree)[eventType] ?? [];
    // Repair missing projections lazily for task states created before this
    // index existed. This does not mutate canonical task state.
    writeAppTaskConditionRouteIndex(config, tree);
  }
  const matched = new Set<string>();
  for (const { condition, taskIds } of routes) {
    if (!isCondition(condition) || !matches(condition, event)) continue;
    for (const taskId of taskIds) {
      if (allowed && !allowed.has(taskId)) continue;
      matched.add(taskId);
    }
  }
  return [...matched].sort();
}

/** Persist one fact only for the exact task Conditions selected in preflight. */
export function trackAppTaskConditionEventForTasks(
  config: TaskStateConfig,
  event: Record<string, unknown>,
  taskIds: Iterable<string>,
): AppTaskConditionWake[] {
  const allowed = new Set(taskIds);
  if (allowed.size === 0) return [];
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const wakes = new Map<string, AppTaskConditionWake>();
    if (applyConditionEvent(tree, event, wakes, allowed)) saveTaskState(config, tree);
    return [...wakes.values()];
  });
}
