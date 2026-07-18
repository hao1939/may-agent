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
  workspacePath(path: string): string;
  workspaceCwd(): string;
  appPath(path: string): string;
  readJson<T = unknown>(path: string): Promise<T>;
  importModule<T = Record<string, unknown>>(path: string): Promise<T>;
  emit(event: ProjectAppEvent): unknown;
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

export type ProjectAppTaskMode = "achieve" | "maintain";

export type ProjectAppTaskDisposition = "converged" | "progressing" | "waiting" | "needs-owner" | "failed";

export type ProjectAppTaskAction =
  | {
      kind: "create-task";
      id: string;
      parentId: string;
      goal: string;
      outputs: string[];
      acceptance: string[];
      priority?: "P0" | "P1" | "P2" | "P3";
      owner?: string;
      workflow?: string;
    }
  | {
      kind: "update-task";
      taskId: string;
      expectedRevision: number;
      goal?: string;
      outputs?: string[];
      acceptance?: string[];
    }
  | {
      kind: "close-task";
      taskId: string;
      expectedRevision: number;
      summary: string;
    }
  | {
      kind: "unblock-task";
      taskId: string;
      expectedRevision: number;
      reason: string;
    };

export type ProjectAppTaskHandlerResult = {
  disposition: ProjectAppTaskDisposition;
  summary: string;
  evidence: string[];
  actions?: ProjectAppTaskAction[];
  conditions?: Array<Record<string, unknown>>;
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
};

export type ProjectAppTaskCapability = {
  workflow: string;
  agent?: string;
  task: string;
  timeoutMs: number;
  context: string[];
};

export type ProjectAppTaskRoute = {
  name: string;
  enabled: boolean;
  description: string;
  maxConcurrentTriggers?: number;
  accepts: EventSelector[];
  resolve(event: Record<string, unknown>): ProjectAppTaskIntent | null;
};

export type ProjectAppOnEvent = (ctx: ProjectAppContext, event: Record<string, unknown>) => Promise<unknown>;

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
    emits: ProjectAppEvent[];
  }>;
  /**
   * First-class owner entry for task reconciliation. A task without a bound
   * workflow, or a workflow that cannot handle its input, falls back here.
   */
  ownerEntry?: ProjectAppTaskCapability;
  /** Reusable workflow capabilities addressable from task.workflow. */
  taskWorkflows?: Record<string, ProjectAppTaskCapability>;
  /** Event-to-task correlation. Task routes organize work; they do not execute it. */
  taskRoutes?: ProjectAppTaskRoute[];
  /** Selectors delivered to onEvent. Task events belong in taskRoutes. */
  events?: EventSelector[];
  eventGraph?: {
    /** Task-route output declarations for integrity checking. */
    routes?: Record<string, { emits?: string[]; description?: string }>;
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
      maxRoutesPerEvent?: number;
    };
  };
  actions: Record<string, ProjectAppAction>;
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
