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

export type ProjectAppContext = {
  projectPath(path: string): string;
  appPath(path: string): string;
  readJson<T = unknown>(path: string): Promise<T>;
  importModule<T = Record<string, unknown>>(path: string): Promise<T>;
  startSession(input: { agent: string; task: string; timeoutMs?: number }): unknown;
  emit(event: Record<string, unknown>): unknown;
  noop(reason: string): unknown;
};

export type ProjectAppAction =
  | {
      type: "sync";
      readOnly: true;
      description: string;
      run(ctx: ProjectAppContext, params: unknown): Promise<unknown>;
    }
  | {
      type: "async";
      description: string;
      event(params: unknown): ProjectAppEvent;
    };

export type ProjectWorkflowHandler = {
  name: string;
  type: "job";
  enabled: boolean;
  description: string;
  maxConcurrentTriggers?: number;
  /**
   * Declarative selectors accepted by this generated workflow handler.
   * Use this for new project apps. Runtime lowers these selectors to cron
   * event-type subscriptions while preserving target intent in the manifest.
   */
  accepts?: EventSelector[];
  /**
   * Compatibility shorthand for accepts: ["event.type"].
   * Prefer accepts[] in new manifests.
   */
  on?: string[];
  emits?: string[];
  handler: {
    workflow: string;
    agent?: string;
    projectId?: string;
    includeEvent?: boolean;
    task: string;
    timeoutMs: number;
  };
  context: string[];
};

export type GeneratedProjectEventHandlers<T extends ProjectWorkflowHandler[] = ProjectWorkflowHandler[]> = {
  kind: "generated-workflow-handlers";
  handlers: T;
};

export type ProjectAppOnEvent =
  | ((ctx: ProjectAppContext, event: Record<string, unknown>) => Promise<unknown>)
  | GeneratedProjectEventHandlers;

export type ProjectApp = {
  id: string;
  version: 1;
  owner?: string;
  description: string;
  workspace: {
    kind: "git" | "local";
    repo?: string;
    localPath: string;
    branch?: string;
  };
  budget: {
    sessionsPerDay: number;
    tokensPerDay: number;
    maxConcurrent: number;
  };
  schedules: Array<{
    id: string;
    enabled: boolean;
    intervalMs?: number;
    cron?: string;
    emits?: ProjectAppEvent[];
    /** Compatibility shorthand for emits: [event]. Prefer emits[]. */
    event?: ProjectAppEvent;
  }>;
  /**
   * Runtime compatibility field. Prefer declaring generated workflow-backed
   * event handlers with `onEvent: workflowHandlers([...])`; defineProjectApp()
   * expands that sugar into this field for the current installer.
   */
  workflowHandlers?: ProjectWorkflowHandler[];
  /**
   * Extra selectors for custom imperative onEvent functions. Generated
   * workflow handlers already declare their own event subscriptions through
   * `onEvent: workflowHandlers([...])`.
   */
  events?: EventSelector[];
  eventGraph?: {
    /** Handler emit declarations for integrity checking. */
    handlers?: Record<string, { emits?: string[]; description?: string }>;
    /** Adapter declarations: event→emits for integrity checking. */
    adapters?: Array<{
      event: string;
      emits?: string[];
      description?: string;
    }>;
    externalEvents?: string[];
    intentionalCycles?: Array<{
      id: string;
      events: string[];
      reason: string;
    }>;
    limits?: {
      maxHandlersPerEvent?: number;
    };
  };
  actions: Record<string, ProjectAppAction>;
  onEvent?: ProjectAppOnEvent;
};

export function defineProjectApp(app: ProjectApp): ProjectApp {
  if (app.onEvent && typeof app.onEvent !== "function" && app.onEvent.kind === "generated-workflow-handlers") {
    return {
      ...app,
      workflowHandlers: app.workflowHandlers ?? app.onEvent.handlers,
    };
  }
  return app;
}

export function workflowHandlers<T extends ProjectWorkflowHandler[]>(handlers: T): GeneratedProjectEventHandlers<T> {
  return {
    kind: "generated-workflow-handlers",
    handlers,
  };
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
