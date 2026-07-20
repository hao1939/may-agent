import type { Static, TSchema } from "@earendil-works/pi-ai";

export type ProjectAppEventUrgency = "low" | "normal" | "high" | "immediate";

export type ProjectAppEventTarget = {
  project?: string;
  taskId?: string;
  owner?: string;
  sessionId?: string;
  human?: boolean;
};

export type ProjectAppEvent<TData extends Record<string, unknown> = Record<string, unknown>> = {
  type: string;
  target?: ProjectAppEventTarget;
  source?: string;
  owner?: string;
  urgency?: ProjectAppEventUrgency;
  ttlMs?: number;
  ttl_ms?: number;
  data?: TData;
  params?: Record<string, unknown>;
  [key: string]: unknown;
};

export type EventSelector =
  | string
  | {
      type: string;
      target?: ProjectAppEventTarget;
      project?: string;
      owner?: string;
      urgency?: ProjectAppEventUrgency;
      actions?: string[];
      metricIds?: string[];
    };

function selectorRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function selectorValue(event: Record<string, unknown>, ...keys: string[]): unknown {
  const details = eventDetails(event);
  const target = selectorRecord(event.target);
  for (const key of keys) {
    if (details[key] !== undefined) return details[key];
    if (target[key] !== undefined) return target[key];
  }
  return undefined;
}

function normalizedOwner(value: unknown): string {
  const owner = typeof value === "string" ? value.trim() : "";
  return owner.startsWith("agent:") ? owner.slice("agent:".length) : owner;
}

/** Canonical selector matching used by app loading, integrity checks, and tests. */
export function matchesEventSelector(selector: EventSelector, event: Record<string, unknown>): boolean {
  if (typeof selector === "string") return event.type === selector;
  if (event.type !== selector.type) return false;

  const expectedProject = selector.target?.project ?? selector.project;
  if (expectedProject && selectorValue(event, "project", "projectId", "project_id") !== expectedProject) return false;

  if (selector.target?.taskId && selectorValue(event, "taskId", "task_id") !== selector.target.taskId) return false;
  if (selector.target?.sessionId && selectorValue(event, "sessionId", "session_id") !== selector.target.sessionId) {
    return false;
  }

  if (selector.owner) {
    if (normalizedOwner(selectorValue(event, "owner")) !== normalizedOwner(selector.owner)) return false;
  }
  if (selector.target?.owner) {
    const target = selectorRecord(event.target);
    if (normalizedOwner(target.owner) !== normalizedOwner(selector.target.owner)) return false;
  }

  if (selector.target?.human !== undefined) {
    const target = selectorRecord(event.target);
    if (target.human !== selector.target.human) return false;
  }
  if (selector.urgency && selectorValue(event, "urgency") !== selector.urgency) return false;

  if (selector.actions?.length) {
    const action = selectorValue(event, "action");
    if (typeof action !== "string" || !selector.actions.includes(action)) return false;
  }
  if (selector.metricIds?.length) {
    const metricId = selectorValue(event, "metricId", "metric_id");
    if (typeof metricId !== "string" || !selector.metricIds.includes(metricId)) return false;
  }
  return true;
}

export type ProjectAppContext = {
  appPath(path: string): string;
  emit(event: ProjectAppEvent): unknown;
  noop(reason: string): unknown;
  /** Read-only host projection for deterministic app observers/watchers. */
  query?: {
    sql(statement: string, params?: unknown[], options?: { limit?: number }): unknown;
    metrics(filter?: Record<string, unknown>): unknown;
    workflowRuns(filter?: Record<string, unknown>): unknown;
    events(filter?: Record<string, unknown>): unknown;
  };
};

export type ProjectAppAction<TInputSchema extends TSchema = TSchema> = {
  type: "async";
  description: string;
  inputSchema: TInputSchema;
  event(params: Static<TInputSchema>): ProjectAppEvent;
};

export type ProjectAppTaskMode = "achieve" | "maintain";

export type ProjectAppTaskHandlerState = "converged" | "waiting" | "needs-owner";

export type ProjectAppConditionSpec = {
  id: string;
  type: string;
  subject: string;
  expected: unknown;
  owner?: string;
};

export type ProjectAppCondition = {
  metadata: {
    id: string;
    generation: number;
    resourceVersion: number;
  };
  spec: Omit<ProjectAppConditionSpec, "id">;
  status: {
    observedGeneration: number;
    state: "unknown" | "false" | "true";
    observed?: unknown;
    observedAt?: string;
    evidence?: string[];
  };
};

export type ProjectAppTaskAction =
  | {
      kind: "create-task";
      id: string;
      parentId: string;
      outcome: string;
      mode: ProjectAppTaskMode;
      outputs: string[];
      acceptance: string[];
      priority: "P0" | "P1" | "P2" | "P3";
      owner?: string;
      workflow?: string;
      input?: Record<string, unknown>;
      dependsOn?: string[];
      category?: string;
    }
  | {
      kind: "update-task";
      taskId: string;
      expectedGeneration: number;
      parentId?: string;
      outcome?: string;
      mode?: ProjectAppTaskMode;
      outputs?: string[];
      acceptance?: string[];
      priority?: "P0" | "P1" | "P2" | "P3";
      owner?: string | null;
      workflow?: string | null;
      input?: Record<string, unknown>;
      dependsOn?: string[];
      category?: string | null;
    }
  | {
      kind: "close-task";
      taskId: string;
      expectedGeneration: number;
      summary: string;
    }
  | {
      kind: "unblock-task";
      taskId: string;
      expectedGeneration: number;
      reason: string;
    };

export type ProjectAppTaskHandlerResult = {
  state: ProjectAppTaskHandlerState;
  summary: string;
  evidence: string[];
  actions?: ProjectAppTaskAction[];
  conditions?: ProjectAppConditionSpec[];
};

export type ProjectAppTaskAcceptanceBasis = {
  method: "deterministic" | "workflow-contract" | "owner-judgment";
  verifier?: string;
  evidence: string[];
};

export type ProjectAppTaskVerificationResult = {
  accepted: boolean;
  summary: string;
  evidence: string[];
};

export type ProjectAppTaskVerificationContext = {
  appId: string;
  taskId: string;
  generation: number;
  appDir: string;
  projectDir: string;
  workspaceDir: string;
  intent: Readonly<ProjectAppTaskIntent>;
};

export type ProjectAppTaskVerifier = (
  context: ProjectAppTaskVerificationContext,
  result: ProjectAppTaskHandlerResult,
) => Promise<ProjectAppTaskVerificationResult>;

/** Model/authoring input before task-action convention defaults are applied. */
export type ProjectAppTaskHandlerInput = {
  state: ProjectAppTaskHandlerState;
  summary: string;
  evidence: string[];
  actions?: unknown[];
  conditions?: ProjectAppConditionSpec[];
};

export type ProjectAppTaskIntent = {
  id: string;
  parentId: string;
  outcome: string;
  acceptance: string[];
  mode: ProjectAppTaskMode;
  owner?: string;
  workflow?: string;
  input?: Record<string, unknown>;
  outputs?: string[];
  dependsOn?: string[];
  priority?: "P0" | "P1" | "P2" | "P3";
  /** Domain classification for views; distinct from reconciliation mode. */
  category?: string;
};

export type ProjectAppTaskResource = {
  metadata: {
    id: string;
    generation: number;
    resourceVersion: number;
  };
  spec: Omit<ProjectAppTaskIntent, "id">;
  status: {
    observedGeneration: number;
    phase: "pending" | "running" | "converged" | "waiting" | "attention";
    currentAttemptId?: string;
    summary?: string;
    evidence?: string[];
    conditionIds?: string[];
    updatedAt: string;
  };
};

export type ProjectAppTaskAttempt = {
  metadata: {
    id: string;
    resourceVersion: number;
  };
  taskId: string;
  taskGeneration: number;
  specHash: string;
  owner: string;
  handler: string;
  runtimeId: string;
  state: "running" | "completed" | "failed" | "interrupted";
  reason: string;
  trigger?: Record<string, unknown>;
  startedAt: string;
  finishedAt?: string;
  summary?: string;
  failureReason?: string;
  attentionNotifiedAt?: string;
};

export type ProjectAppTaskTrigger = {
  taskId: string;
  taskGeneration: number;
  resourceVersion: number;
  event: Record<string, unknown>;
  observedAt: string;
};

/** Convention-first event correlation. Targeted task and Condition events bypass this resolver. */
export type ProjectAppTasks = {
  accepts: EventSelector[];
  resolve(event: Record<string, unknown>): ProjectAppTaskIntent | null;
  resyncIntervalMs?: number;
};

export type ProjectAppOnEvent = (ctx: ProjectAppContext, event: Record<string, unknown>) => Promise<unknown>;

export type ProjectApp = {
  id: string;
  version: 1;
  owner: string;
  description: string;
  workspace?: {
    kind: "git" | "local";
    repo?: string;
    localPath: string;
    branch?: string;
  };
  budget?: {
    sessionsPerDay: number;
    tokensPerDay: number;
    maxConcurrent: number;
  };
  schedules?: Array<{
    id: string;
    enabled: boolean;
    intervalMs: number;
    emits: ProjectAppEvent[];
  }>;
  /** The app's single event-to-desired-task correlation surface. */
  tasks?: ProjectAppTasks;
  /** Selectors delivered to onEvent. Task events belong in tasks.accepts. */
  events?: EventSelector[];
  actions?: Record<string, ProjectAppAction>;
  onEvent?: ProjectAppOnEvent;
};

export function defineProjectApp(app: ProjectApp): ProjectApp {
  return app;
}

export function eventData(event: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const key of ["data", "payload", "params"]) {
    const value = event[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(merged, value);
    }
  }
  return merged;
}

export function eventString(event: Record<string, unknown>, key: string): string {
  const data = eventData(event);
  const value = data[key] ?? event[key];
  return typeof value === "string" ? value : "";
}

export function eventDetails(event: Record<string, unknown>): Record<string, unknown> {
  return {
    ...eventData(event),
    ...Object.fromEntries(
      Object.entries(event).filter(
        ([key, value]) =>
          !["data", "payload", "params"].includes(key) && value !== undefined && typeof value !== "function",
      ),
    ),
  };
}
