import type { AppResult } from "./app.js";
import type { AppEvent } from "./event.js";
import type { Condition, TaskExecutorName, TaskPriority, TaskReconcileResult } from "./task.js";
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
  response?: string;
  result?: Record<string, unknown>;
  evidence?: string[];
};

/** Exact desired Task detail returned only by an explicitly scoped get. */
export type TaskDetail = TaskView & {
  parentId: string;
  mode?: "achieve" | "maintain";
  acceptance: string[];
  input: Record<string, unknown>;
  /** Agent selected for the next bounded attempt. */
  agent?: string;
  /** @deprecated Use `agent`. */
  owner?: string;
  workflow?: string;
  executor?: TaskExecutorName;
  priority?: TaskPriority;
  category?: string;
  dependsOn?: string[];
  conditions: Condition[];
};

export type TaskListOptions = {
  /** Exact phases to include. Omitted means every phase. */
  status?: TaskView["status"][];
  /** Bounded page size. Runtime caps this at 100. */
  limit?: number;
  /** Opaque continuation returned by the previous page. */
  cursor?: string;
};

export type TaskPage = {
  items: TaskView[];
  nextCursor?: string;
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
  /** Finite positive integer tool-operation allowance before bounded completion is requested. */
  operationAllowance?: number;
  /** Exact source classification persisted on the execution session. */
  source?: string;
};

/** Bounded stable projections. It intentionally has no list or SQL escape hatch. */
export type AppRead = {
  appResult(itemId: string): Promise<AppResult | null>;
  tasks: {
    list(options?: TaskListOptions): Promise<TaskPage>;
    get(taskId: string): Promise<TaskDetail | null>;
  };
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
  agent?: string;
  /** @deprecated Use `agent`. */
  owner?: string;
  workflow?: string;
  executor?: TaskExecutorName;
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

/**
 * Small App-wide planning projection. Exact Task input, acceptance, result
 * evidence, and attempt detail stay behind read.tasks.get(taskId).
 */
export type TaskReconciliationSnapshotTask = {
  taskId: string;
  parentId: string;
  generation: number;
  outcome: string;
  agent?: string;
  /** @deprecated Use `agent`. */
  owner?: string;
  executor?: TaskExecutorName;
  priority?: TaskPriority;
  category?: string;
  dependsOn?: string[];
  conditions: Array<Pick<Condition, "id" | "type" | "subject" | "requestedAction" | "owner" | "reviewAfterMs">>;
  readiness?: TaskReconciliationChild["readiness"];
  hasLiveChildren: boolean;
  updatedAt?: string;
  status: "pending" | "running" | "waiting" | "attention" | "done";
};

/** One durable event linked to the task before this attempt was claimed. */
export type TaskReconciliationEvent = {
  /** Host event identity. Optional only while legacy trigger state is migrated. */
  eventId?: number;
  observedAt: string;
  event: AppEvent<Record<string, unknown>>;
};

/** Ordered, bounded work input that this reconciliation result will observe. */
export type TaskReconciliationEvents = {
  items: TaskReconciliationEvent[];
  /** Highest durable event identity in items, when every item has one. */
  throughEventId?: number;
  /** More linked events remain pending for the same task. */
  truncated: boolean;
};

export type TaskEventReceipt = { eventId: number };

/** The complete bounded contract shared by every Task executor adapter. */
export type TaskAttempt = {
  /** App scope makes Task ids unambiguous to a reusable executor. */
  appId: string;
  /** Runtime-owned identity for this fenced execution attempt. */
  attemptId: string;
  /** Task resource version observed when this attempt was claimed. */
  resourceVersion: number;
  task: TaskDetail;
  /** Attempt-scoped working directory selected by Runtime. */
  cwd: string;
  /** App-declared paths this attempt may intentionally produce. */
  declaredOutputPaths: string[];
  /** Bounded direct-child facts needed to reconcile parent work. */
  children: {
    live: TaskReconciliationChild[];
    completed: TaskReconciliationChild[];
  };
  /** Ordered durable Task input not yet accepted by this Task generation. */
  events: TaskReconciliationEvents;
  /** Publish a durable Task-scoped progress, finding, request, or other fact with a retry-stable local key. */
  publish(localKey: string, event: AppEvent<Record<string, unknown>>): Promise<TaskEventReceipt>;
  /**
   * Observe live feedback, approval, steering, or cancellation addressed to
   * this Task. `accept` only marks the event for atomic consumption if this
   * attempt later returns an admitted result; otherwise durable replay wins.
   */
  onEvent(listener: (event: AppEvent<Record<string, unknown>>, accept: () => void) => void): () => void;
};

export type TaskExecutor = (attempt: TaskAttempt) => Promise<TaskReconcileResult>;

/** Bounded task-attempt facts supplied without exposing task storage or prompt packets. */
export type TaskReconciliationContext<TInput = unknown> = {
  appId: string;
  taskId: string;
  generation: number;
  resourceVersion: number;
  /** Agent selected for this bounded attempt. The App owns the Task. */
  agent: string;
  /** @deprecated Use `agent`. */
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
    live: TaskReconciliationSnapshotTask[];
    truncated: boolean;
  };
  events: TaskReconciliationEvents;
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
    /** Live convenience for events addressed to the current Task; durable replay remains authoritative. */
    onEvent(listener: (event: AppEvent<Record<string, unknown>>) => void): () => void;
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
