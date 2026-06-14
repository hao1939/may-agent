export type EventSelector =
  | string
  | {
      type: string;
      project?: string;
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
      event(params: unknown): Record<string, unknown>;
    };

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
    event: Record<string, unknown>;
  }>;
  workflowHandlers: Array<{
    name: string;
    type: "job";
    enabled: boolean;
    description: string;
    intervalMs?: number;
    offsetMs?: number;
    maxConcurrentTriggers?: number;
    on: string[];
    handler: {
      workflow: string;
      agent?: string;
      projectId?: string;
      includeEvent?: boolean;
      task: string;
      timeoutMs: number;
    };
    context: string[];
  }>;
  events: EventSelector[];
  eventGraph?: {
    handlers?: Record<
      string,
      {
        emits: string[];
        description?: string;
      }
    >;
    adapters?: Array<{
      event: string;
      emits: string[];
      description?: string;
    }>;
    externalEvents?: string[];
    intentionalCycles?: Array<{
      id: string;
      events: string[];
      reason: string;
    }>;
    limits?: {
      maxDirectHandlersPerEvent?: number;
      maxAdapterEmits?: number;
    };
  };
  actions: Record<string, ProjectAppAction>;
  onEvent(ctx: ProjectAppContext, event: Record<string, unknown>): Promise<unknown>;
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

export function projectOwnerEvent(projectId: string, reason: string, params: unknown = {}): Record<string, unknown> {
  return {
    type: "project.owner.requested",
    project: projectId,
    reason,
    params: params && typeof params === "object" && !Array.isArray(params) ? params : {},
  };
}

export function projectPlanningEvent(projectId: string, reason: string, params: unknown = {}): Record<string, unknown> {
  return projectOwnerEvent(projectId, reason, params);
}
