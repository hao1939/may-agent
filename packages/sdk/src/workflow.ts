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
  /** Owner ended execution; a prior accepted result alone does not close the Task. */
  closed?: boolean;
  /** Current work phase. `done` means an accepted outcome; inspect `closed` for owner closure. */
  status: "pending" | "running" | "waiting" | "attention" | "done";
  generation: number;
  outcome: string;
  summary?: string;
  response?: string;
  result?: Record<string, unknown>;
  facts?: string[];
};

/** Exact desired Task detail returned only by an explicitly scoped get. */
export type TaskDetail = TaskView & {
  parentId: string;

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
  /** Exact phases to include. Omitted means every phase, including closed history. */
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

/** Opt-in, read-only shadow grouping. Legacy Task identities remain the traceability authority. */
export type TaskOutcomeProjection = {
  /** Include accepted outcomes and closed history. Omitted means active work only. */
  includeDone?: boolean;
  /** Return only the reviewed outcome containing this exact Task. */
  taskId?: string;
};

export type TaskOutcomeView = {
  id: string;
  outcome: string;
  status: TaskView["status"];
  memberCount: number;
  memberTaskIds: string[];
  /** Exact legacy views; callers may use tasks.get(id) for full detail and linked records. */
  members: TaskView[];
  /** True when no reviewed manifest mapping exists; lossless fallback prevents hidden Tasks. */
  ungrouped?: boolean;
};

export type TaskOutcomePage = {
  projection: "outcomes";
  manifestVersion: number | null;
  sourceCount: number;
  outcomeCount: number;
  outcomes: TaskOutcomeView[];
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
  /** Latest retained observation, not definition update time or an assurance of health. */
  measuredAt?: number | null;
  sampleSize?: number | null;
  note?: string | null;
  measureInterval?: number | null;
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
  sourceQuery?: string;
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
  /** Restrict this bounded call to observation tools plus finish(). */
  tools?: "full" | "readonly";
  /** Explicit skill used by this bounded call. */
  skill?: string;
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
    /** Opt-in shadow view. Omission keeps every existing list/get behavior unchanged. */
    /** Optional Host reporting capability; rejects when not installed. */
    outcomes(options?: TaskOutcomeProjection): Promise<TaskOutcomePage>;
    get(taskId: string): Promise<TaskDetail | null>;
  };
  execution(executionId: string): Promise<ExecutionView | null>;
  /** Null means no matching metric; an absent reporting capability rejects. */
  metric(metricId: string): Promise<MetricView | null>;
};

/** Disposable provider observation memory, never Task state or a delivery queue. */
export type ObserverSnapshot =
  null | boolean | number | string | ObserverSnapshot[] | { [key: string]: ObserverSnapshot };

/** Counts of retained executions, not unique Tasks or accepted App outcomes. */
export type HostExecutionHealth = {
  running: number;
  /** Rows with endedAt in the snapshot window, including unrecognized statuses. */
  ended: number;
  done: number;
  error: number;
  blocked: number;
  interrupted: number;
  other: number;
  /** Terminal rows started in the window but missing endedAt; excluded above. */
  undated: number;
  /** At most 20 error executions, newest first. No transcripts or private payloads. */
  recentErrors: Array<{ executionId: string; endedAt: number }>;
  errorsTruncated: boolean;
};

/** Observed Host facts, not a healthy/unhealthy verdict or a recovery command. */
export type HostHealthSnapshot = {
  generatedAt: number;
  window: { start: number; end: number };
  coverage: { retainedOnly: true; executionScope: "all" };
  executions: { agents: HostExecutionHealth; workflows: HostExecutionHealth };
  /** Selected Host-boundary failure events; counts are events, not incidents. */
  runtimeFailures: {
    total: number;
    byType: Array<{ type: string; count: number }>;
    recent: Array<{ eventId: number; type: string; timestamp: number }>;
    truncated: boolean;
  };
};

export type ObserverContext = {
  /** Defensive copy of the last published snapshot; absent after startup/reload. */
  previousObservation?: ObserverSnapshot;
  read: AppRead & {
    /** Optional Host reporting; rejects when absent. Default last hour, at most one day.
     * Observers receive aggregates and bounded diagnostic IDs, never global SQL. */
    hostHealth(options?: { lookbackMs?: number }): Promise<HostHealthSnapshot>;
  };
  log: Logger;
  /** Paths scoped to this App declaration and its configured workspace. */
  workspace: {
    appRoot: string;
    projectRoot: string;
  };
};

/** Host-recorded terminal CLI call, not an agent's completion claim or a durable Task. */
export type CliCallFacts = {
  sessionId: string;
  toolCallId: string;
  taskId: string;
  tool: "codex" | "claude";
  status: "completed" | "failed";
  failureCategory?: string;
  resultPath: string;
  structuredResultPath: string;
  eventsPath: string;
};

/** One terminal result vocabulary for bounded Agent and workflow execution. */
export type ExecutionResult<T = unknown> = {
  id: string;
  kind: "agent" | "workflow";
  status: "done" | "blocked" | "error" | "interrupted";
  summary: string;
  output?: T;
  facts?: unknown;
  /** Up to 64 CLI results from this session's retained transcript tail. Positive
   * facts only: absence does not prove a call never ran. Old Hosts omit it. */
  cliCalls?: CliCallFacts[];
};

/** The input is App/workflow-owned; the runtime only carries it across the boundary. */
export type WorkflowInput<T = unknown> = T;

export type TaskReconciliationChild = {
  taskId: string;
  parentId: string;
  generation: number;
  outcome: string;
  summary?: string;
  facts: string[];
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
 * facts, and attempt detail stay behind read.tasks.get(taskId).
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
  /** Earlier asks whose awaited facts are being considered now; not new input or new authority. */
  continuedInputs?: TaskReconciliationEvent[];
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
  /**
   * Best-effort resource-control signal for this exact attempt. Durable Task
   * state remains authoritative; executors should stop promptly when aborted.
   */
  signal: AbortSignal;
  /** Task resource version observed when this attempt was claimed. */
  resourceVersion: number;
  /** Runtime-resolved role shared unchanged by every executor adapter. */
  role: {
    agent: string;
    instructions: string;
  };
  task: TaskDetail;
  /** Latest earlier attempt of this Task. Facts to inspect, not authority to repeat its effects. */
  previousAttempt?: {
    attemptId: string;
    generation: number;
    state: "running" | "completed" | "failed" | "interrupted";
    summary?: string;
    failureReason?: string;
    sessionId?: string;
    workspacePath?: string;
    /** Exact admitted report, when one exists. An execution error need not have one. */
    acceptedResult?: {
      state: "converged" | "waiting" | "incomplete";
      summary: string;
      response?: string;
      result?: Record<string, unknown>;
      facts: string[];
    };
  };
  /** Attempt-scoped working directory selected by Runtime. */
  cwd: string;
  /** App-declared paths this attempt may intentionally produce. */
  declaredOutputPaths: string[];
  /** Bounded direct-child facts needed to reconcile parent work. */
  children: {
    live: TaskReconciliationChild[];
    /** Archived outcomes from the retired completion protocol, not current readiness. */
    completed: TaskReconciliationChild[];
    /** Owner closure history (legacy field name). Closure alone proves neither success nor failure. */
    cancelled?: Array<{
      kind?: "closed" | "cancelled";
      taskId: string;
      parentId: string;
      generation: number;
      outcome: string;
      summary: string;
      facts: string[];
      cancelledAt: string;
    }>;
  };
  /** Exact accepted waits for inputs still awaiting feedback; other inputs may be answered. */
  waits: {
    open: Array<{
      conditionId: string;
      type: string;
      subject: string;
      state: string;
      dependency?: {
        requestId: string;
        appId: string;
        status: string;
        targetTaskId?: string;
        resolvedTaskId?: string;
      };
    }>;
    note: string;
  };
  /** Ordered durable Task input not yet accepted by this Task generation. */
  events: TaskReconciliationEvents;
  /** Runtime-selected schema for the one admitted executor result. */
  resultSchema: Record<string, unknown>;
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

  outcome: string;
  acceptance: string[];
  input: TInput;
  children: TaskAttempt["children"];
  /** Same exact saved waits supplied to registered executors. */
  waits: TaskAttempt["waits"];
  previousAttempt?: TaskAttempt["previousAttempt"];
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
  /**
   * Aborted on caller cancellation, the run/parent deadline, or run completion.
   * Pass to cooperative I/O helpers and check before starting another operation.
   * Does not preempt arbitrary JavaScript or undo completed external effects.
   */
  signal: AbortSignal;
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
    /**
     * Verified original publication in this Task generation, including large bodies.
     * Null means no publication; missing/corrupt facts throws. Task-owned workflows only.
     */
    read(type: string, localKey: string): Promise<{ eventId: number; data: Record<string, unknown> } | null>;
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
  blocked(reason: string, facts?: unknown): ExecutionResult;
};
