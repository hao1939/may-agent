import {
  readTaskState,
  saveTaskState,
  withTaskStateLock,
  type ProjectAppCondition,
  type TaskStateConfig,
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

function matches(condition: ProjectAppCondition, event: Record<string, unknown>): boolean {
  if (condition.spec.type !== event.type) return false;
  const subject = typedSubject(condition.spec.subject);
  if (!subject) return false;
  if (String(eventField(event, ...fieldAliases(subject.field)) ?? "") !== subject.value) return false;

  if (isRecord(condition.spec.expected)) {
    const expectedField = condition.spec.expected.field;
    if (typeof expectedField === "string" && expectedField.trim()) {
      const actual = eventField(event, ...fieldAliases(expectedField));
      const anyOf = condition.spec.expected.anyOf;
      if (Array.isArray(anyOf)) {
        return anyOf.some((candidate) => stableEquals(candidate, actual));
      }
      if ("equals" in condition.spec.expected) {
        return stableEquals(condition.spec.expected.equals, actual);
      }
      if ("notEquals" in condition.spec.expected) {
        return actual !== undefined && !stableEquals(condition.spec.expected.notEquals, actual);
      }
    }
    return Object.entries(condition.spec.expected).every(([field, expected]) => {
      if ((field === "allowedDecisions" || field === "acceptedDecisions") && Array.isArray(expected)) {
        const actualDecision = eventField(event, "decision");
        return expected.some((candidate) => stableEquals(candidate, actualDecision));
      }
      return stableEquals(eventField(event, ...fieldAliases(field)), expected);
    });
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

/** Correlate a semantic observation with durable Conditions; never observes the domain source itself. */
export function trackProjectAppConditionEvent(
  config: TaskStateConfig,
  event: Record<string, unknown>,
): ProjectAppConditionWake[] {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const now = new Date().toISOString();
    let changed = false;
    const wakes = new Map<string, ProjectAppConditionWake>();

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
        if (wakes.has(taskId)) continue;
        wakes.set(taskId, {
          conditionId: id,
          taskId,
        });
      }
    }

    for (const wake of wakes.values()) {
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
      changed = true;
    }

    if (changed) saveTaskState(config, tree);
    return [...wakes.values()];
  });
}
