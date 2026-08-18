import type { AppResult } from "./app.js";
import type { AppEvent } from "./event.js";
import type { Condition, TaskPriority } from "./task.js";
import type { Static, TSchema } from "typebox";

export type Logger = {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
};

export type TaskView = {
  id: string;
  status: "pending" | "running" | "waiting" | "attention" | "done";
  generation: number;
  outcome: string;
  summary?: string;
  evidence?: string[];
};

export type ExecutionView = {
  id: string;
  kind: "agent" | "workflow";
  status: "running" | "done" | "blocked" | "error" | "interrupted";
  summary?: string;
};

export type MetricView = {
  id: string;
  value: number | null;
  status: string | null;
  target: number | null;
  threshold: number | null;
  unit: string | null;
};

export type MetricDefinition = {
  id: string;
  name?: string;
  owner?: string;
  project?: string;
  type?: "gauge" | "counter" | "health" | "derived";
  target?: number;
  threshold?: number;
  unit?: string;
  priority?: "P0" | "P1" | "P2" | "P3";
  status?: "active" | "retired" | string;
  source?: string;
  sourceCommand?: string;
  measureInterval?: number;
  alertOp?: "<" | ">" | "above" | "below";
  speed?: string;
  description?: string;
  config?: Record<string, unknown>;
};

export type MetricRecordOptions = {
  sampleSize?: number;
  note?: string;
  measuredBy?: string;
  measuredAt?: number;
};

export type WorkflowMetricCapability = {
  define(definition: MetricDefinition): void;
  defineMany(definitions: MetricDefinition[]): void;
  record(id: string, value: number, options?: string | MetricRecordOptions): Promise<void> | void;
  evaluate(id?: string): unknown[];
};

export type AgentCallOptions = {
  sessionId?: string;
  timeoutMs?: number;
  /** Exact source classification persisted on the execution session. */
  source?: string;
};

/** Bounded stable projections. It intentionally has no list or SQL escape hatch. */
export type AppRead = {
  appResult(itemId: string): Promise<AppResult | null>;
  task(taskId: string): Promise<TaskView | null>;
  execution(executionId: string): Promise<ExecutionView | null>;
  metric(metricId: string): Promise<MetricView | null>;
};

export type ObserverContext = {
  read: AppRead;
  log: Logger;
  /** Paths scoped to this App declaration and its configured workspace. */
  workspace: {
    appRoot: string;
    projectRoot: string;
  };
};

/** One terminal result vocabulary for bounded Agent and workflow execution. */
export type ExecutionResult<T = unknown> = {
  id: string;
  kind: "agent" | "workflow";
  status: "done" | "blocked" | "error" | "interrupted";
  summary: string;
  output?: T;
  evidence?: unknown;
};

/** The input is App/workflow-owned; the runtime only carries it across the boundary. */
export type WorkflowInput<T = unknown> = T;

export type TaskReconciliationChild = {
  taskId: string;
  parentId: string;
  generation: number;
  outcome: string;
  summary?: string;
  evidence: string[];
  owner?: string;
  workflow?: string;
  input: Record<string, unknown>;
  priority?: TaskPriority;
  category?: string;
  dependsOn?: string[];
  conditions: Condition[];
  readiness?: {
    state:
      | "ready"
      | "dependency-blocked"
      | "condition-blocked"
      | "child-blocked"
      | "capacity-blocked"
      | "paused"
      | "not-applicable";
    reason: string;
    relatedTaskIds: string[];
  };
  latestAttempt?: {
    handler: string;
    failureReason?: string;
  };
  hasLiveChildren: boolean;
  updatedAt?: string;
  status: "pending" | "running" | "waiting" | "attention" | "done";
  completedAt?: string;
};

/** Bounded task-attempt facts supplied without exposing task storage or prompt packets. */
export type TaskReconciliationContext<TInput = unknown> = {
  appId: string;
  taskId: string;
  generation: number;
  resourceVersion: number;
  owner: string;
  mode: "achieve" | "maintain";
  outcome: string;
  acceptance: string[];
  input: TInput;
  children: {
    live: TaskReconciliationChild[];
    completed: TaskReconciliationChild[];
  };
  /**
   * Bounded projection of the App's other live tasks for workflows that review
   * frontier health. The current reconciliation task is intentionally omitted.
   */
  taskSnapshot: {
    live: TaskReconciliationChild[];
    truncated: boolean;
  };
  trigger?: AppEvent<Record<string, unknown>>;
};

export type WorkflowContext<TInput = unknown> = {
  input: WorkflowInput<TInput>;
  /** Present only when a durable App task owns this workflow attempt. */
  reconciliation?: TaskReconciliationContext<TInput>;
  read: AppRead;
  agents: {
    call<S extends TSchema>(
      agent: string,
      task: string,
      options: AgentCallOptions & { schema: S },
    ): Promise<ExecutionResult<Static<S>>>;
    call(agent: string, task: string, options?: AgentCallOptions): Promise<ExecutionResult>;
  };
  workflows: {
    run(name: string, input: unknown): Promise<ExecutionResult>;
  };
  events: {
    emit(event: AppEvent): Promise<void>;
  };
  metrics: WorkflowMetricCapability;
  workspace?: {
    /** Root of the App declaration that owns this workflow. */
    appRoot: string;
    /** Root of the App's configured project workspace. */
    projectRoot: string;
    /** Root of this bounded attempt's writable workspace. */
    root: string;
    /** Output root admitted for this bounded attempt. */
    output: string;
  };
  log: Logger;
  done<T>(summary: string, output?: T): ExecutionResult<T>;
  blocked(reason: string, evidence?: unknown): ExecutionResult;
};
