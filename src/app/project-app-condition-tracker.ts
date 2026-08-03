import {
  readTaskState,
  saveTaskState,
  withTaskStateLock,
  type ProjectAppCondition,
  type TaskStateConfig,
  type TaskTree,
} from "@may-agent/sdk";

export type ProjectAppConditionWake = {
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

function isCondition(value: unknown): value is ProjectAppCondition {
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

function isFreshLevelObservation(condition: ProjectAppCondition, event: Record<string, unknown>): boolean {
  const levelObservation =
    condition.spec.type === "aks.repo-ref.observed" ||
    condition.spec.type.endsWith(".state") ||
    condition.spec.type.endsWith(".check");
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

function matches(condition: ProjectAppCondition, event: Record<string, unknown>): boolean {
  if (condition.spec.type !== event.type) return false;
  // A repo-ref event is a level observation, not an immutable historical fact.
  // A newly declared `notEquals` wait must not be satisfied by an older commit
  // observation replayed from the event journal. The workflow inspected the ref
  // immediately before establishing this Condition; only an observation made at
  // or after that point can prove that the ref subsequently changed.
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
  wakes: Map<string, ProjectAppConditionWake>,
): boolean {
  const now = new Date().toISOString();
  let changed = false;
  const eventWakes = new Map<string, ProjectAppConditionWake>();

  for (const [id, condition] of Object.entries(tree.conditions ?? {})) {
    if (!isCondition(condition)) continue;
    if (!matches(condition, event)) continue;
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
    for (const resource of Object.values(tree.resources ?? {})) {
      if (resource.status.phase !== "waiting" || !resource.status.conditionIds?.includes(id)) continue;
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
export function applyProjectAppConditionEvent(
  tree: TaskTree,
  event: Record<string, unknown>,
): ProjectAppConditionWake[] {
  const wakes = new Map<string, ProjectAppConditionWake>();
  applyConditionEvent(tree, event, wakes);
  return [...wakes.values()];
}

/** Correlate semantic observations with durable Conditions in one state transaction. */
export function trackProjectAppConditionEvents(
  config: TaskStateConfig,
  events: Iterable<Record<string, unknown>>,
): ProjectAppConditionWake[] {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const wakes = new Map<string, ProjectAppConditionWake>();
    let changed = false;
    for (const event of events) {
      changed = applyConditionEvent(tree, event, wakes) || changed;
    }

    if (changed) saveTaskState(config, tree);
    return [...wakes.values()];
  });
}

/** Correlate one semantic observation with durable Conditions; never observes the domain source itself. */
export function trackProjectAppConditionEvent(
  config: TaskStateConfig,
  event: Record<string, unknown>,
): ProjectAppConditionWake[] {
  return trackProjectAppConditionEvents(config, [event]);
}
