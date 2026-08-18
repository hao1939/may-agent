export type AppEventTarget = {
  appId?: string;
  project?: string;
  taskId?: string;
  executionId?: string;
  sessionId?: string;
  metricId?: string;
  owner?: string;
  human?: boolean;
};

/** Canonical fact published by App-authored observers and workflows. */
export type AppEvent<TData = unknown> = {
  type: string;
  data: TData;
  source?: string;
  owner?: string;
  target?: AppEventTarget;
  action?: string;
  urgency?: "low" | "normal" | "high" | "immediate";
};

/** Declarative event subscription. Matching and durable delivery belong to the host. */
export type EventSelector =
  | string
  | {
      type: string;
      target?: AppEventTarget;
      project?: string;
      source?: string;
      owner?: string;
      urgency?: AppEvent["urgency"];
      actions?: string[];
      metricIds?: string[];
      agents?: string[];
      lanes?: string[];
      verdicts?: string[];
      intents?: string[];
    };

function normalizedOwner(value: unknown): string {
  const owner = typeof value === "string" ? value.trim() : "";
  return owner.startsWith("agent:") ? owner.slice("agent:".length) : owner;
}

function selectedValue(event: AppEvent<Record<string, unknown>>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (key === "action" && event.action !== undefined) return event.action;
    if (event.data[key] !== undefined) return event.data[key];
    if (event.target?.[key as keyof AppEventTarget] !== undefined) {
      return event.target[key as keyof AppEventTarget];
    }
  }
  return undefined;
}

/** Canonical pure selector matching used by App subscription admission. */
export function matchesEventSelector(selector: EventSelector, event: AppEvent<Record<string, unknown>>): boolean {
  if (typeof selector === "string") return event.type === selector;
  if (event.type !== selector.type) return false;

  const expectedProject = selector.target?.project ?? selector.project;
  if (expectedProject && selectedValue(event, "project", "projectId", "project_id") !== expectedProject) return false;
  if (selector.source && event.source !== selector.source) return false;
  if (selector.target?.taskId && selectedValue(event, "taskId", "task_id") !== selector.target.taskId) return false;
  if (selector.target?.sessionId && selectedValue(event, "sessionId", "session_id") !== selector.target.sessionId) {
    return false;
  }
  if (selector.owner && normalizedOwner(event.owner) !== normalizedOwner(selector.owner)) return false;
  if (selector.target?.owner && normalizedOwner(event.target?.owner) !== normalizedOwner(selector.target.owner)) {
    return false;
  }
  if (selector.target?.human !== undefined && event.target?.human !== selector.target.human) return false;
  if (selector.urgency && event.urgency !== selector.urgency) return false;

  const includes = (values: string[] | undefined, ...keys: string[]): boolean => {
    if (!values?.length) return true;
    const value = selectedValue(event, ...keys);
    return typeof value === "string" && values.includes(value);
  };
  return (
    includes(selector.actions, "action") &&
    includes(selector.metricIds, "metricId", "metric_id") &&
    includes(selector.agents, "agent") &&
    includes(selector.lanes, "lane") &&
    includes(selector.verdicts, "reviewedVerdict", "verdict") &&
    includes(selector.intents, "intent")
  );
}
