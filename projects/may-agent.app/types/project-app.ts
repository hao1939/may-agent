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
  startSession(input: {
    agent: string;
    task: string;
    timeoutMs?: number;
  }): unknown;
  emit(event: Record<string, unknown>): unknown;
  noop(reason: string): unknown;
};

export type ProjectApp = {
  id: string;
  version: 1;
  owner: string;
  description: string;
  workspace: {
    kind: "local";
    localPath: string;
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
    event: Record<string, unknown>;
  }>;
  workflowHandlers?: Array<{
    name: string;
    type?: "job";
    enabled: boolean;
    description: string;
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
    handlers?: Record<string, { emits: string[]; description?: string }>;
    adapters?: Array<{ event: string; emits: string[]; description?: string }>;
    externalEvents?: string[];
    intentionalCycles?: Array<{
      id: string;
      events: string[];
      reason: string;
    }>;
  };
  actions: Record<
    string,
    {
      type: "async";
      description: string;
      event(params: unknown): Record<string, unknown>;
    }
  >;
  onEvent(
    ctx: ProjectAppContext,
    event: Record<string, unknown>,
  ): Promise<unknown>;
};
