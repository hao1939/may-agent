/**
 * Public may-agent SDK contract.
 *
 * This package is the stable interface exported by infra to app-owned agents,
 * handlers, workflows, and tests. Keep this file as pure types/contracts so
 * package consumers do not depend on private src/lib/* layout.
 */

import type { Static, TSchema } from "@earendil-works/pi-ai";

// ── SQLite-like DB surface ────────────────────────────────────────────

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export interface Statement {
  get(...params: unknown[]): Record<string, unknown> | null;
  all(...params: unknown[]): Record<string, unknown>[];
  run(...params: unknown[]): RunResult;
}

export interface SqliteDb {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  run(sql: string, params?: unknown[]): RunResult;
  close(): void;
}

// ── Query API ─────────────────────────────────────────────────────────

export interface QueryResult<Row extends Record<string, unknown> = Record<string, unknown>> {
  rows: Row[];
  rowCount: number;
  limit: number;
  truncated: boolean;
}

export interface QueryOptions {
  limit?: number;
}

export interface TimeFilter extends QueryOptions {
  since?: number;
  until?: number;
}

export interface SessionQuery extends TimeFilter {
  agent?: string;
  status?: string;
  kind?: string;
  source?: string;
  projectId?: string;
  parentSessionId?: string;
  workflowRunId?: string;
}

export interface EventQuery extends TimeFilter {
  type?: string;
  owner?: string;
  source?: string;
}

export interface MetricQuery extends QueryOptions {
  id?: string;
  owner?: string;
  status?: string;
  project?: string;
  priority?: string;
}

export interface AlertQuery extends TimeFilter {
  metricId?: string;
  resolved?: boolean;
}

export interface ProjectQuery extends QueryOptions {
  id?: string;
  owner?: string;
  status?: string;
  workflow?: string;
}

export interface WorkflowRunQuery extends TimeFilter {
  workflow?: string;
  status?: string;
  projectId?: string;
  parentSessionId?: string;
  parentWorkflowRunId?: string;
}

export interface MetricAlertContextQuery {
  metricId: string;
  alertId?: number | null;
  relatedEventTypes?: string[];
  since?: number;
  snapshotLimit?: number;
  eventLimit?: number;
}

export interface MetricAlertContext {
  alert: Record<string, unknown> | null;
  metric: Record<string, unknown> | null;
  snapshots: Record<string, unknown>[];
  relatedEvents: Record<string, unknown>[];
  metricId: string;
  alertId: number | null;
}

export interface MetricAlertReactorStateQuery {
  metricId: string;
  owner?: string;
  since?: number;
  alertId?: number | null;
}

export interface MetricAlertReactorState {
  metric: Record<string, unknown> | null;
  alert: Record<string, unknown> | null;
  latestJudgment: Record<string, unknown> | null;
  latestSnapshot: Record<string, unknown> | null;
  recentTriageRun: Record<string, unknown> | null;
  recentTriageJudgment: Record<string, unknown> | null;
  recentOwnerSession: Record<string, unknown> | null;
  recentOwnerSessionJudgment: Record<string, unknown> | null;
  metricId: string;
  alertId: number | null;
}

export interface ClosedLoopStewardContextQuery {
  lookbackMs?: number;
  alertLimit?: number;
  deliveryFailureLimit?: number;
  now?: number;
}

export interface ClosedLoopStewardAlertContext {
  alert: Record<string, unknown>;
  latestJudgment: Record<string, unknown> | null;
  latestSnapshot: Record<string, unknown> | null;
  activeTriageRun: Record<string, unknown> | null;
}

export interface ClosedLoopStewardContext {
  now: number;
  schemaBrief: string[];
  runningStewardRun: Record<string, unknown> | null;
  alerts: ClosedLoopStewardAlertContext[];
  deliveryFailures: Record<string, unknown>[];
  recentStewardRuns: Record<string, unknown>[];
}

export interface EventDeliveryHealthQuery {
  now?: number;
  lookbackMs?: number;
  limit?: number;
}

export interface EventDeliveryHealth {
  now: number;
  since: number;
  ownerInboxOpenCount: number;
  unhandledEvents: Record<string, unknown>[];
  overduePendingEvents: Record<string, unknown>[];
  orphanPairs: Record<string, unknown>[];
  overdueOpenPairs: Record<string, unknown>[];
}

export interface HeartbeatContextQuery {
  agent: string;
  now?: number;
  inboxLookbackMs?: number;
  metricLimit?: number;
  metricSnapshotLimit?: number;
  alertLimit?: number;
  inboxLimit?: number;
}

export interface HeartbeatContext {
  now: number;
  metrics: Record<string, unknown>[];
  alerts: Record<string, unknown>[];
  inbox: Record<string, unknown>[];
}

export interface EvaluatorDeepEvalScanQuery {
  now?: number;
  backfillHours?: number;
  fallbackDelayMs?: number;
  activeWindowMs?: number;
}

export interface EvaluatorDeepEvalScanContext {
  now: number;
  activeDeepEval: boolean;
  candidate: Record<string, unknown> | null;
}

export interface EvaluatorAftermathContextQuery {
  sessionId: string;
}

export interface EvaluatorAftermathContext {
  sessionId: string;
  session: Record<string, unknown> | null;
  evaluation: Record<string, unknown> | null;
}

export interface QueryAPI {
  sessions(filter?: SessionQuery): QueryResult;
  events(filter?: EventQuery): QueryResult;
  metrics(filter?: MetricQuery): QueryResult;
  alerts(filter?: AlertQuery): QueryResult;
  projects(filter?: ProjectQuery): QueryResult;
  workflowRuns(filter?: WorkflowRunQuery): QueryResult;
  metricAlertContext(filter: MetricAlertContextQuery): MetricAlertContext;
  metricAlertReactorState(filter: MetricAlertReactorStateQuery): MetricAlertReactorState;
  closedLoopStewardContext(filter?: ClosedLoopStewardContextQuery): ClosedLoopStewardContext;
  eventDeliveryHealth(filter?: EventDeliveryHealthQuery): EventDeliveryHealth;
  heartbeatContext(filter: HeartbeatContextQuery): HeartbeatContext;
  evaluatorDeepEvalScan(filter?: EvaluatorDeepEvalScanQuery): EvaluatorDeepEvalScanContext;
  evaluatorAftermathContext(filter: EvaluatorAftermathContextQuery): EvaluatorAftermathContext;
  sql(sql: string, params?: unknown[], opts?: QueryOptions): QueryResult;
}

export interface CommandAPI {
  reviewInboxEvents(eventIds: number[], reviewedBy?: string): number;
  expireStaleMessages(olderThanMs: number): number;
  expireStaleSignalEvents(olderThanMs: number): number;
}

// ── Metrics API ───────────────────────────────────────────────────────

export type MetricType = "gauge" | "counter" | "health" | "derived";
export type MetricPriority = "P0" | "P1" | "P2" | "P3";
export type MetricAlertOp = "<" | ">" | "above" | "below";

export interface MetricDefinition {
  id: string;
  name?: string;
  owner?: string;
  type?: MetricType;
  target?: number;
  threshold?: number;
  unit?: string;
  priority?: MetricPriority;
  status?: "active" | "retired" | string;
  blocker?: string;
  project?: string;
  source?: string;
  sourceQuery?: string;
  sourceCommand?: string;
  sensitivity?: number;
  measureInterval?: number;
  alertOp?: MetricAlertOp;
  speed?: string;
  description?: string;
  direction?: string;
  config?: Record<string, unknown>;
}

export interface MetricRecordOptions {
  sampleSize?: number;
  note?: string;
  measuredBy?: string;
  measuredAt?: number;
}

export interface ManualAlertOptions {
  priority?: MetricPriority;
  alertType?: string;
  evidence?: string;
}

export interface MetricFilter {
  owner?: string;
  project?: string;
  status?: string;
}

export interface Metric {
  id: string;
  name: string | null;
  owner: string | null;
  type: string | null;
  current: number | null;
  target: number | null;
  threshold: number | null;
  unit: string | null;
  priority: string | null;
  status: string | null;
  project: string | null;
  alert_op: string | null;
  config?: string | null;
}

export interface MetricEvaluationResult {
  metricId: string;
  status: "breached" | "recovered" | "ok" | "stalled";
  alertId?: number;
  message?: string;
}

export interface MetricService {
  define(def: MetricDefinition): void;
  defineMany(defs: MetricDefinition[]): void;
  record(id: string, value: number, opts?: MetricRecordOptions): void;
  evaluate(id?: string): MetricEvaluationResult[];
  alert(id: string, message: string, opts?: ManualAlertOptions): void;
  resolveAlert(alertId: number, reason?: string): void;
  get(id: string): Metric | null;
  list(filter?: MetricFilter): Metric[];
}

// ── Core SDK ──────────────────────────────────────────────────────────

export interface RunOpts {
  source?: string;
  projectId?: string;
  timeout?: number;
}

export interface SDKTaskResult {
  sessionId: string;
  status: string;
  lastAssistantText: string;
}

export interface DoneOpts {
  deliverables?: Deliverable[];
  contextUpdates?: string[];
  nextSteps?: string[];
}

export interface Deliverable {
  path: string;
  description?: string;
}

export interface SDKWorkflowResult {
  status: "done" | "blocked";
  summary: string;
  runId?: string;
}

export interface AgentSDK {
  runAgent(agent: string, task: string, opts?: RunOpts): Promise<SDKTaskResult>;
  runWorkflow(name: string, task: string, opts?: RunOpts): Promise<SDKWorkflowResult>;
  emit(type: string, data?: Record<string, unknown>, envelope?: EventEnvelopeOptions): void;
  getDb(): SqliteDb;
  query: QueryAPI;
  commands: CommandAPI;
  metrics: MetricService;
  log(level: "info" | "warn" | "error", msg: string): void;
  message(target: string, content: string): void;
  escalate(reason: string, opts?: EscalationOptions): EscalationRef;
  paths: {
    persist: string;
    root: string;
    agents: string;
    shared: string;
    projects: string;
  };
}

export type WorkflowSDK = Omit<AgentSDK, "escalate"> & {
  task: string;
  agent: string;
  done(summary: string, opts?: DoneOpts): SDKWorkflowResult;
  blocked(reason: string, context?: unknown): SDKWorkflowResult;
};

export interface EventEnvelopeOptions {
  owner?: string;
  source?: string;
  target?: Record<string, unknown>;
  action?: string;
  urgency?: "low" | "normal" | "high" | "immediate";
  ttl_ms?: number;
  visibility?: "default" | "detail";
  trace?: {
    traceId: string;
    parentEventId?: number;
    links?: Array<{ eventId: number; type?: "reference" | "closure"; label?: string }>;
  };
}

export interface EscalationOptions extends EventEnvelopeOptions {
  requestedAction?: string;
  evidence?: Record<string, unknown>;
  severity?: "P0" | "P1" | "P2" | "P3";
  projectId?: string;
  sourceSessionId?: string;
  resume?: Record<string, unknown>;
  dedupKey?: string;
}

export interface EscalationRef {
  eventId: number;
  compatibilityId: string;
}

// ── Handler / cron contract ───────────────────────────────────────────

export interface PreflightCheck {
  type: "file-has-content" | "new-entries-since";
  path: string;
  stateKey?: string;
  minLines?: number;
}

export interface WorkflowBackedHandler {
  workflow: string;
  agent?: string;
  task: string;
  includeEvent?: boolean;
  projectId?: string;
  timeoutMs?: number;
}

export type CronHandlerSpec = string | WorkflowBackedHandler;

export interface CronEntry {
  name: string;
  intervalMs?: number;
  /** Deprecated config field. Scheduler does not treat message as a trigger mode. */
  message?: string;
  enabled: boolean;
  description?: string;
  context?: string[];
  /** Agent associated with the trigger. Workflow-backed handlers set this inside handler.agent. */
  agent?: string;
  handler?: CronHandlerSpec;
  timeoutMs?: number;
  handlerConfig?: Record<string, unknown>;
  lastModified?: string;
  preflight?: PreflightCheck;
  offsetMs?: number;
  on?: string[];
}

export interface EventEnvelope {
  type: string;
  source: string;
  owner: string;
  timestamp?: number;
  action?: string;
  urgency?: "low" | "normal" | "high" | "immediate";
  ttl_ms?: number;
  visibility?: "default" | "detail";
  trace?: {
    traceId: string;
    parentEventId?: number;
    links?: Array<{ eventId: number; type?: "reference" | "closure"; label?: string }>;
  };
  data: Record<string, unknown>;
}

export type ErrorClass = "infra" | "logic" | "abort" | "overflow";
export type DigestAction = "resume" | "requeue" | "escalate" | "kill" | "nothing";

export interface DigestRow {
  sessionId: string;
  [key: string]: unknown;
}

export interface DigestInput {
  sessionId: string;
  [key: string]: unknown;
}

export interface PersistedSession {
  sessionId?: string;
  agent: string;
  status: string;
  parentSessionId?: string;
  task?: string;
  startedAt?: number;
  endedAt?: number;
  [key: string]: unknown;
}

export interface HandlerContext {
  sdk: AgentSDK;
  agentName: string;
  triggerNow: (entryName: string) => boolean;
  classifyError(error: string | undefined | null): ErrorClass;
  getLastDigest(sessionId: string): DigestRow | null;
  upsertDigest(input: DigestInput): Promise<DigestRow | null>;
  classifyDigest(
    digest: { outcome: string; still_open: string | null; what_happened: string },
    trigger: string,
  ): { action: DigestAction; reason: string };
  readSessionMeta(sessionId: string): PersistedSession | null;
  readSessionMessages(sessionId: string): unknown[];
}

export interface HandlerModule {
  create: (ctx: HandlerContext, entry: CronEntry) => (event?: EventEnvelope) => Promise<void>;
}

type MaybePromise<T> = T | Promise<T>;
type ValueResolver<T> =
  T | ((ctx: HandlerContext, event: EventEnvelope | undefined, entry: CronEntry) => MaybePromise<T>);

export interface WorkflowHandlerOptions {
  workflow: ValueResolver<string>;
  task: ValueResolver<string>;
  source?: ValueResolver<string | undefined>;
  projectId?: ValueResolver<string | undefined>;
  includeEvent?: boolean;
  shouldRun?: (ctx: HandlerContext, event: EventEnvelope | undefined, entry: CronEntry) => boolean | Promise<boolean>;
}

async function resolveValue<T>(
  value: ValueResolver<T>,
  ctx: HandlerContext,
  event: EventEnvelope | undefined,
  entry: CronEntry,
): Promise<T> {
  if (typeof value === "function") {
    return (value as (ctx: HandlerContext, event: EventEnvelope | undefined, entry: CronEntry) => MaybePromise<T>)(
      ctx,
      event,
      entry,
    );
  }
  return value;
}

function appendEvent(task: string, event: EventEnvelope | undefined): string {
  if (!event) return task;
  return `${task}\n\n## Trigger Event\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\``;
}

export function createWorkflowHandler(options: WorkflowHandlerOptions): HandlerModule["create"] {
  return (ctx: HandlerContext, entry: CronEntry) => async (event?: EventEnvelope) => {
    if (options.shouldRun && !(await options.shouldRun(ctx, event, entry))) {
      ctx.sdk.log("info", `[workflow-handler:${entry.name}] skipped`);
      ctx.sdk.emit("handler.skipped", {
        handler: entry.name,
        reason: "shouldRun returned false",
        eventType: event?.type ?? null,
      });
      return;
    }

    if (options.includeEvent && !event) {
      ctx.sdk.log(
        "warn",
        `[workflow-handler:${entry.name}] skipped includeEvent dispatch because no event payload was received`,
      );
      ctx.sdk.emit("handler.skipped", {
        handler: entry.name,
        reason: "includeEvent requested but no event payload received",
        eventType: null,
      });
      return;
    }

    const workflow = await resolveValue(options.workflow, ctx, event, entry);
    const source = await resolveValue(options.source ?? ctx.agentName, ctx, event, entry);
    const projectId = await resolveValue(options.projectId, ctx, event, entry);
    const rawTask = await resolveValue(options.task, ctx, event, entry);
    const task = options.includeEvent ? appendEvent(rawTask, event) : rawTask;
    const runOpts: RunOpts = {};
    if (source) runOpts.source = source;
    if (projectId) runOpts.projectId = projectId;

    ctx.sdk.log(
      "info",
      `[workflow-handler:${entry.name}] Dispatching workflow "${workflow}" for ${source ?? ctx.agentName}`,
    );
    const result = await ctx.sdk.runWorkflow(workflow, task, runOpts);
    ctx.sdk.log(
      "info",
      `[workflow-handler:${entry.name}] Workflow "${workflow}" -> ${result.status}${result.runId ? ` (${result.runId})` : ""}`,
    );
    ctx.sdk.emit("handler.workflow_dispatched", {
      handler: entry.name,
      workflow,
      source: source ?? ctx.agentName,
      projectId: projectId ?? null,
      workflowRunId: result.runId ?? null,
      status: result.status,
    });
  };
}

// ── Workflow contract ─────────────────────────────────────────────────

export type TaskResultStatus = "done" | "error" | "interrupted";

export interface TaskResult {
  sessionId: string;
  status: TaskResultStatus;
  lastAssistantText: string | null;
  messages: unknown[];
  duration: string;
  outputDir: string;
  error?: string;
  turnsUsed?: number;
  finishResult?: Record<string, unknown>;
  structuredResult?: unknown;
  [key: string]: unknown;
}

export interface WorkflowAgentOptions<S extends TSchema = TSchema> {
  timeoutMs?: number;
  skill?: string;
  schema?: S;
}

export type WorkflowAgentTaskResult =
  | (TaskResult & { status: "done"; finishResult: Record<string, unknown> })
  | (TaskResult & { status: "error" | "interrupted" });

export type SchemaBackedTaskResult<S extends TSchema> =
  | (WorkflowAgentTaskResult & { status: "done"; structuredResult: Static<S> })
  | (TaskResult & { status: "error" | "interrupted"; structuredResult?: Static<S> });

export interface CompletedStep {
  step: string;
  sessionId?: string;
  source?: "agent" | "function" | string;
  result?: TaskResult;
  [key: string]: unknown;
}

export interface WorkflowGuardEvent {
  type: string;
  source?: "agent" | "function" | string;
  step?: string;
  sessionId?: string;
  result?: TaskResult;
  completedSteps?: CompletedStep[];
  task?: string;
  workflow?: string;
  summary?: string;
  [key: string]: unknown;
}

export interface Demand {
  type: "run_step" | "block" | "warn";
  reason: string;
  guardName?: string;
  step?: {
    agent: string;
    task: string;
    label?: string;
  };
  [key: string]: unknown;
}

export interface WorkflowGuard {
  name: string;
  events?: string[];
  costTier?: "zero" | "low" | "medium";
  handle(event: WorkflowGuardEvent): Demand[];
}

export interface GuardModule {
  guard: WorkflowGuard;
}

// ── Execution result view ──────────────────────────────────────────────

export type ExecutionKind = "session" | "workflow";
export type ExecutionStatus = "running" | "done" | "error" | "interrupted" | "blocked" | "escalated";

export interface ExecutionResult {
  id: string;
  kind: ExecutionKind;
  status: ExecutionStatus;
  summary: string;
  traceId: string;
  owner?: string;
  parentId?: string;
  projectId?: string;
  startedAt?: number;
  endedAt?: number;
  evidence?: Record<string, unknown>;
}

export interface ResumeDiagnostic {
  kind: ExecutionKind;
  id: string;
  status?: ExecutionStatus;
  reason: string;
  category?: string;
  recoverable?: boolean;
  nextAction?: string;
  owner?: string;
  agent?: string;
  workflow?: string;
  projectId?: string;
  parentId?: string;
}

export interface SessionExecutionRow {
  sessionId: string;
  agent: string;
  task: string;
  status: string;
  kind?: string | null;
  source?: string | null;
  parentSessionId?: string | null;
  workflowRunId?: string | null;
  projectId?: string | null;
  startedAt?: number | null;
  endedAt?: number | null;
  error?: string | null;
  outcome?: string | null;
  opCount?: number | null;
}

export interface WorkflowExecutionRow {
  runId: string;
  workflow: string;
  task: string;
  parentSessionId?: string | null;
  parentWorkflowRunId?: string | null;
  projectId?: string | null;
  depth?: number | null;
  status: string;
  startedAt?: number | null;
  endedAt?: number | null;
  result_summary?: string | null;
  result_reason?: string | null;
  resumedFromRunId?: string | null;
}

function compactExecutionText(text: unknown, fallback: string): string {
  const value = typeof text === "string" ? text.trim() : "";
  if (!value) return fallback;
  return value.length > 500 ? value.slice(0, 497) + "..." : value;
}

function optionalExecutionString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function optionalExecutionNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function normalizeExecutionStatus(kind: ExecutionKind, status: string): ExecutionStatus {
  if (kind === "workflow" && status === "blocked") return "blocked";
  if (kind === "workflow" && status === "escalated") return "blocked";
  if (status === "done") return "done";
  if (status === "error") return "error";
  if (status === "interrupted") return "interrupted";
  if (status === "escalated") return "escalated";
  return "running";
}

export function resumeDiagnosticToExecutionResult(diagnostic: ResumeDiagnostic): ExecutionResult {
  const status = diagnostic.status ?? (diagnostic.recoverable === false ? "error" : "interrupted");
  return {
    id: diagnostic.id,
    kind: diagnostic.kind,
    status,
    summary: compactExecutionText(diagnostic.reason, diagnostic.kind + " resume " + status),
    traceId: diagnostic.id,
    owner: optionalExecutionString(diagnostic.owner ?? diagnostic.agent),
    parentId: optionalExecutionString(diagnostic.parentId),
    projectId: optionalExecutionString(diagnostic.projectId),
    evidence: {
      owner: diagnostic.owner,
      agent: diagnostic.agent,
      workflow: diagnostic.workflow,
      category: diagnostic.category,
      recoverable: diagnostic.recoverable,
      nextAction: diagnostic.nextAction,
    },
  };
}

export function sessionRowToExecutionResult(row: SessionExecutionRow): ExecutionResult {
  const status = normalizeExecutionStatus("session", row.status);
  return {
    id: row.sessionId,
    kind: "session",
    status,
    summary: compactExecutionText(row.error ?? row.outcome, row.agent + " " + status + ": " + row.task),
    traceId: row.workflowRunId ?? row.sessionId,
    owner: row.agent,
    parentId: optionalExecutionString(row.parentSessionId),
    projectId: optionalExecutionString(row.projectId),
    startedAt: optionalExecutionNumber(row.startedAt),
    endedAt: optionalExecutionNumber(row.endedAt),
    evidence: {
      agent: row.agent,
      task: row.task,
      kind: row.kind,
      source: row.source,
      workflowRunId: row.workflowRunId,
      opCount: row.opCount,
    },
  };
}

export function workflowRowToExecutionResult(row: WorkflowExecutionRow): ExecutionResult {
  const status = normalizeExecutionStatus("workflow", row.status);
  return {
    id: row.runId,
    kind: "workflow",
    status,
    summary: compactExecutionText(
      row.result_summary ?? row.result_reason,
      row.workflow + " " + status + ": " + row.task,
    ),
    traceId: row.runId,
    parentId: optionalExecutionString(row.parentWorkflowRunId ?? row.parentSessionId),
    projectId: optionalExecutionString(row.projectId),
    startedAt: optionalExecutionNumber(row.startedAt),
    endedAt: optionalExecutionNumber(row.endedAt),
    evidence: {
      workflow: row.workflow,
      task: row.task,
      depth: row.depth,
      parentSessionId: row.parentSessionId,
      parentWorkflowRunId: row.parentWorkflowRunId,
      resumedFromRunId: row.resumedFromRunId,
    },
  };
}

export type WorkflowResult = { type: "done"; summary: string } | { type: "blocked"; reason: string; context?: unknown };

export interface WorkflowEvent {
  type: string;
  [key: string]: unknown;
}

export interface SessionOptions {
  systemPrompt: string;
  tools: "full" | "readonly";
  label?: string;
}

export interface SessionHandle {
  prompt(message: string): Promise<void>;
  lastText(): string;
  close(): void;
}

export interface WorkflowContext {
  task: string;
  agent: string;
  emit(event: { type: string; [key: string]: unknown }): void;
  dispatchEvent(eventType: string, data?: Record<string, unknown>): void;
  getDb(): unknown;
  query: QueryAPI;
  commands: CommandAPI;
  log(msg: string): void;
  notify(msg: string): void;
  metrics: MetricService;
  persistDir: string;
  projectRoot: string;
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot: string;
  runAgent<S extends TSchema>(
    name: string,
    task: string,
    opts: WorkflowAgentOptions<S> & { schema: S },
  ): Promise<SchemaBackedTaskResult<S>>;
  runAgent(name: string, task: string, opts?: WorkflowAgentOptions): Promise<WorkflowAgentTaskResult>;
  runAgentSession?<S extends TSchema>(
    name: string,
    task: string,
    sessionId: string | undefined,
    opts: WorkflowAgentOptions<S> & { schema: S },
  ): Promise<SchemaBackedTaskResult<S>>;
  runAgentSession?(
    name: string,
    task: string,
    sessionId?: string,
    opts?: WorkflowAgentOptions,
  ): Promise<WorkflowAgentTaskResult>;
  runWorkflow(name: string, task: string): Promise<WorkflowResult>;
  runFunction(label: string, fn: () => Promise<string>): Promise<TaskResult>;
  summarize(result: TaskResult, opts?: Record<string, unknown>): string;
  done(summary: string): WorkflowResult;
  blocked(reason: string, context?: unknown): WorkflowResult;
  createSession(opts: SessionOptions): Promise<SessionHandle>;
}

export interface WorkflowModule {
  name: string;
  description: string;
  execute: (ctx: WorkflowContext) => Promise<WorkflowResult>;
}

// ── Resilience primitives ──────────────────────────────────────
export { checkCircuitBreaker, recordOutcome as recordCircuitOutcome, resetCircuitBreaker } from "./circuit-breaker.js";

export {
  DEFAULT_RUNNING_LEASE_MS,
  shouldDispatch,
  recordDispatch,
  recordOutcome as recordDedupOutcome,
  unblock as unblockDispatch,
  getBlockedTasks,
  withDedupGuard,
  cleanup as cleanupDispatchRecords,
} from "./dispatch-dedup-guard.js";
export type { DispatchRecord } from "./dispatch-dedup-guard.js";

// ── Workflow file cache ───────────────────────────────────
export { WorkflowFileCache, parseSections, extractSectionContent, countPattern } from "./workflow-file-cache.js";
export type { CacheEntry, CacheStats } from "./workflow-file-cache.js";

// ── Project file schema (project.md / discussion.md) ────────────
export {
  parseProjectMeta,
  validateProjectFormat,
  updateField as updateProjectField,
  appendDiscussionComment,
  unreadDiscussionTail,
} from "./project-schema.js";
export type { ProjectMeta } from "./project-schema.js";

export {
  PROJECT_TASK_RESULTS,
  PROJECT_TASK_STATUSES,
  parseProjectTasks,
  planProjectTasks,
  updateProjectTaskFields,
  validateProjectTasks,
} from "./project-tasks.js";
export type {
  PlannedProjectTask,
  ProjectTaskFieldPatch,
  ProjectTask,
  ProjectTaskParseResult,
  ProjectTaskPlan,
  ProjectTaskPlanOptions,
  ProjectTaskResult,
  ProjectTaskStatus,
} from "./project-tasks.js";

// ── Metric ownership (which agents exist; who owns which metric) ────────────
export { listConfiguredAgents, listAutonomousAgents, resolveMetricOwner } from "./metric-ownership.js";

// ── Heartbeat data loaders (used by per-agent heartbeat workflows) ────────
export {
  findRelatedKEs,
  loadMetrics,
  loadProjects,
  loadAlerts,
  loadHeartbeatMd,
  loadInbox,
  runRedMetricCommands,
  formatMetricsBlock,
  shouldSkipHeartbeat,
  genericHeartbeat,
} from "./heartbeat-data.js";

// ── Project-app manifest/event helpers ───────────────────────────────
export { defineProjectApp, eventData, eventDetails, eventString } from "./project-app.js";
export type {
  EventSelector,
  ProjectApp,
  ProjectAppAction,
  ProjectAppContext,
  ProjectAppEvent,
  ProjectAppEventTarget,
  ProjectAppEventUrgency,
  ProjectAppOnEvent,
  ProjectWorkflowHandler,
} from "./project-app.js";

// ── JSON task-tree helpers for project apps ──────────────────────────
export {
  dependenciesSatisfied,
  isClearEnough,
  isLeaf,
  normalizeTaskTreeInPlace,
  normalizeStringArray,
  rawTaskState,
  readTaskTree,
  saveTaskTree,
  setTaskState,
  taskEventSnapshot,
  taskRevision,
  taskState,
  withTreeLock,
} from "./project-task-tree-store.js";
export type { SaveTaskTreeOptions } from "./project-task-tree-store.js";
export type { TaskBlocker, TaskNode, TaskTree, TaskTreeConfig } from "./project-task-tree-store.js";

export {
  ensureTaskTreeState,
  loadProjectReadModel,
  projectRuntimePaths,
  resolveTaskTreePath,
  saveProjectRuntimeState,
} from "./project-runtime-state.js";
export type { EnsureTaskTreeStateResult, ProjectRuntimePaths } from "./project-runtime-state.js";

export {
  acknowledgeTaskAssignments,
  appendPlannerRun,
  appendToolJournal,
  assignRunnableBacklogTasks,
  assignTask,
  compactDoneLeaves,
  completeTask,
  confirmRunnableBacklogLeaves,
  createTask,
  drainTaskAssignments,
  kanbanTaskTreeState,
  listRunnableBacklogTaskIds,
  markTaskDone,
  peekTaskAssignments,
  planningPacket,
  pruneMissingChildren,
  readTask,
  rejectTaskReview,
  requeueStaleActiveTasks,
  rollupParent,
  unblockTask,
  updateTaskOutputs,
  updateTaskText,
  repairTaskTreeRollups,
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  summarizeBlockedFrontier,
  taskKanbanColumn,
  taskIntentFingerprint,
  taskTreeConfig,
  waitingBacklogTaskSnapshots,
  writeKanbanSnapshot,
} from "./project-task-tree.js";
export type {
  CreateTaskInput,
  RunnableBacklogAssignmentResult,
  TaskBlockedFrontierSummary,
  TaskBlockedParentGroup,
  TaskBlockedSignatureGroup,
  TaskAssignment,
  TaskCompletionClaim,
  TaskKanbanColumn,
  TaskKanbanProjection,
  TaskKanbanSnapshot,
  TaskKanbanState,
  TaskTreeCompactResult,
  TaskTreeRepairResult,
  ModelPathStatusEntry,
  ModelStatusSummary,
  RejectTaskReviewInput,
  RollupParentInput,
  TaskTreePruneMissingChildrenResult,
  UpdateTaskTextInput,
  TaskPlanningPacket,
  TaskPlanningSnapshot,
  TaskTreeCompactionCandidate,
  TaskTreeHygieneSummary,
  TaskTreeSummary,
  TaskTreeToolConfig,
  UnblockTaskInput,
  UpdateTaskOutputsInput,
} from "./project-task-tree.js";

export {
  field,
  maxConcurrent,
  parseTriggerEvent,
  readJson,
  resolveAppDir,
  resultText,
  triggerBlock,
  triggerString,
  triggerValue,
} from "./workflow-input.js";
export type { TriggerEvent } from "./workflow-input.js";

export { workflowResult, workflowResultVersion } from "./workflow-result.js";
export type {
  StructuredWorkflowResult,
  WorkflowCheckResult,
  WorkflowIoContract,
  WorkflowProblem,
  WorkflowResultStatus,
  WorkflowSubject,
} from "./workflow-result.js";
