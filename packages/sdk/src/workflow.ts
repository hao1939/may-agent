import type { AppResult } from "./app.js";
import type { AppEvent } from "./event.js";

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
  generation: number;
  outcome: string;
  summary?: string;
  evidence: string[];
  owner?: string;
  workflow?: string;
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
  trigger?: AppEvent<Record<string, unknown>>;
};

export type WorkflowContext<TInput = unknown> = {
  input: WorkflowInput<TInput>;
  /** Present only when a durable App task owns this workflow attempt. */
  reconciliation?: TaskReconciliationContext<TInput>;
  read: AppRead;
  agents: {
    call(agent: string, task: string): Promise<ExecutionResult>;
  };
  workflows: {
    run(name: string, input: unknown): Promise<ExecutionResult>;
  };
  events: {
    emit(event: AppEvent): Promise<void>;
  };
  metrics: {
    record(id: string, value: number, note?: string): Promise<void>;
  };
  workspace?: {
    root: string;
    output: string;
  };
  log: Logger;
  done<T>(summary: string, output?: T): ExecutionResult<T>;
  blocked(reason: string, evidence?: unknown): ExecutionResult;
};
