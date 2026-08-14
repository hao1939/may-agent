/**
 * Test helpers for agent-owned handlers and workflows.
 *
 * This module provides factory functions for test doubles of SDK types
 * (AgentSDK, HandlerContext, WorkflowContext, CronEntry, EventEnvelope).
 *
 * The testing surface owns its default infra wiring so app tests can stay
 * on the public SDK package boundary.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb as defaultGetDb, closeDb as defaultCloseDb } from "../../../src/lib/requests.js";
import { createMetricService as defaultCreateMetricService } from "../../../src/lib/metrics.js";
import { createQueryService as defaultCreateQueryService } from "../../../src/lib/query-service.js";
import { createCommandService as defaultCreateCommandService } from "../../../src/lib/command-service.js";
import type {
  AgentSDK,
  CronEntry,
  DigestAction,
  ErrorClass,
  HandlerContext,
  MetricService,
  QueryAPI,
  SqliteDb,
  TaskResult,
  EventEnvelope,
  WorkflowContext,
} from "./legacy.js";
import type {
  AppRead,
  ExecutionResult as AppExecutionResult,
  Logger as AppLogger,
  ObserverContext,
  WorkflowContext as AppWorkflowContext,
} from "./app.js";

// ── Mock function factory ────────────────────────────────────────────

export type MockFn<T extends (...args: any[]) => any> = T & {
  calls: Parameters<T>[];
  mock: { calls: Parameters<T>[] };
};

export type MockFnFactory = <T extends (...args: any[]) => any>(impl?: T) => T;

let _mockFn: MockFnFactory | undefined;

function localMockFn<T extends (...args: any[]) => any>(impl?: T): MockFn<T> {
  const calls: Parameters<T>[] = [];
  const fn = ((...args: Parameters<T>) => {
    calls.push(args);
    return impl?.(...args);
  }) as MockFn<T>;
  fn.calls = calls;
  fn.mock = { calls };
  return fn;
}

/** Optionally register a test runner mock factory; otherwise SDK uses a local mock. */
export function setMockFn(factory: MockFnFactory): void {
  _mockFn = factory;
}

function getMockFn(): MockFnFactory {
  return _mockFn ?? localMockFn;
}

// ── Infra injection ──────────────────────────────────────────────────

export interface TestInfra {
  /** Open/get a SQLite DB for the given persist directory. */
  getDb(persistDir: string): SqliteDb;
  /** Close and release a cached DB. */
  closeDb(persistDir: string): void;
  /** Create a QueryAPI backed by the given DB getter. */
  createQueryService(opts: { getDb: () => SqliteDb }): QueryAPI;
  /** Create a MetricService backed by the given DB getter. */
  createMetricService(opts: { getDb: () => SqliteDb; emit: AgentSDK["emit"]; measuredBy: string }): MetricService;
}

const defaultInfra: TestInfra = {
  getDb: defaultGetDb as TestInfra["getDb"],
  closeDb: defaultCloseDb,
  createQueryService: defaultCreateQueryService as TestInfra["createQueryService"],
  createMetricService: defaultCreateMetricService as TestInfra["createMetricService"],
};

let _infra: TestInfra | undefined;

/**
 * Override the default infra implementations when a test needs a custom DB,
 * query service, or metric service. Most app tests should use the default.
 */
export function setTestInfra(infra: TestInfra): void {
  _infra = infra;
}

function getInfra(): TestInfra {
  return _infra ?? defaultInfra;
}

// ── Default result factories ─────────────────────────────────────────

function defaultSdkTaskResult(agent: string): Awaited<ReturnType<AgentSDK["runAgent"]>> {
  return {
    sessionId: `s_test_${agent}`,
    status: "done",
    lastAssistantText: "ok",
  };
}

function defaultWorkflowTaskResult(agent: string): TaskResult {
  return {
    sessionId: `s_test_${agent}`,
    status: "done",
    lastAssistantText: "ok",
    messages: [],
    duration: "0s",
    outputDir: "",
    finishResult: { status: "success", summary: "ok" },
  };
}

function defaultWorkflowResult(name: string): Awaited<ReturnType<AgentSDK["runWorkflow"]>> {
  return {
    status: "done",
    summary: "ok",
    runId: `wr_test_${name}`,
  };
}

// ── Test runtime ─────────────────────────────────────────────────────

export interface TestRuntimeOptions {
  root?: string;
  persist?: string;
  agents?: string;
  shared?: string;
  projects?: string;
  measuredBy?: string;
  agentName?: string;
  runAgent?: AgentSDK["runAgent"];
  runWorkflow?: AgentSDK["runWorkflow"];
  emit?: AgentSDK["emit"];
  log?: AgentSDK["log"];
  message?: AgentSDK["message"];
  escalate?: AgentSDK["escalate"];
}

export interface TestRuntime {
  root: string;
  persist: string;
  agents: string;
  shared: string;
  projects: string;
  db: SqliteDb;
  sdk: AgentSDK;
  close(): void;
}

export function createTestRuntime(options: TestRuntimeOptions = {}): TestRuntime {
  const fn = getMockFn();
  const infra = getInfra();
  const root = options.root ?? mkdtempSync(join(tmpdir(), "may-agent-sdk-test-"));
  const persist = options.persist ?? root;
  const agents = options.agents ?? join(root, "agents");
  const shared = options.shared ?? join(root, "shared");
  const projects = options.projects ?? join(root, "projects");
  const db = infra.getDb(persist);
  const emit = options.emit ?? fn();

  const sdk: AgentSDK = {
    runAgent: options.runAgent ?? fn(async (agent: string) => defaultSdkTaskResult(agent)),
    runWorkflow: options.runWorkflow ?? fn(async (name: string) => defaultWorkflowResult(name)),
    emit,
    getDb: () => db,
    query: infra.createQueryService({ getDb: () => db }),
    commands: defaultCreateCommandService({
      getDb: () => db,
      emit: (event) => {
        const data =
          event.data && typeof event.data === "object" && !Array.isArray(event.data)
            ? (event.data as Record<string, unknown>)
            : {};
        emit(String(event.type), data, {
          ...(typeof event.owner === "string" ? { owner: event.owner } : {}),
          ...(typeof event.source === "string" ? { source: event.source } : {}),
          ...(event.target && typeof event.target === "object" && !Array.isArray(event.target)
            ? { target: event.target as Record<string, unknown> }
            : {}),
          ...(event.urgency === "low" ||
          event.urgency === "normal" ||
          event.urgency === "high" ||
          event.urgency === "immediate"
            ? { urgency: event.urgency }
            : {}),
          ...(typeof event.ttl_ms === "number" ? { ttl_ms: event.ttl_ms } : {}),
          ...(event.trace && typeof event.trace === "object" && !Array.isArray(event.trace)
            ? {
                trace: event.trace as {
                  traceId: string;
                  parentEventId?: number;
                  links?: Array<{ eventId: number; type?: "reference" | "closure"; label?: string }>;
                },
              }
            : {}),
        });
      },
    }),
    metrics: infra.createMetricService({
      getDb: () => db,
      emit,
      measuredBy: options.measuredBy ?? "sdk-test",
    }),
    log: options.log ?? fn(),
    message: options.message ?? fn(),
    escalate: options.escalate ?? fn(),
    paths: {
      persist,
      root,
      agents,
      shared,
      projects,
    },
  };

  return {
    root,
    persist,
    agents,
    shared,
    projects,
    db,
    sdk,
    close: () => infra.closeDb(persist),
  };
}

// ── Test handler context ─────────────────────────────────────────────

export interface TestHandlerContextOptions extends TestRuntimeOptions {
  entry?: Partial<CronEntry>;
  agentName?: string;
  triggerNow?: HandlerContext["triggerNow"];
  classifyError?: HandlerContext["classifyError"];
  getLastDigest?: HandlerContext["getLastDigest"];
  upsertDigest?: HandlerContext["upsertDigest"];
  classifyDigest?: HandlerContext["classifyDigest"];
  readSessionMeta?: HandlerContext["readSessionMeta"];
  readSessionMessages?: HandlerContext["readSessionMessages"];
}

export function createTestHandlerContext(options: TestHandlerContextOptions = {}): HandlerContext {
  const fn = getMockFn();
  const runtime = createTestRuntime(options);
  return {
    sdk: runtime.sdk,
    agentName: options.agentName ?? "may",
    triggerNow: options.triggerNow ?? fn(() => true),
    classifyError: options.classifyError ?? fn((): ErrorClass => "infra"),
    getLastDigest: options.getLastDigest ?? fn(() => null),
    upsertDigest: options.upsertDigest ?? fn(async () => null),
    classifyDigest:
      options.classifyDigest ??
      fn((): { action: DigestAction; reason: string } => ({ action: "nothing", reason: "test default" })),
    readSessionMeta: options.readSessionMeta ?? fn(() => null),
    readSessionMessages: options.readSessionMessages ?? fn(() => []),
  };
}

// ── Test cron entry / trigger event ──────────────────────────────────

export function createTestCronEntry(overrides: Partial<CronEntry> = {}): CronEntry {
  return {
    name: "test-handler",
    enabled: true,
    handler: "test-handler",
    ...overrides,
  };
}

export function createTestEventEnvelope(overrides: Partial<EventEnvelope> = {}): EventEnvelope {
  return {
    type: "manual.trigger",
    source: "manual",
    owner: "agent:may",
    timestamp: Date.now(),
    data: {},
    ...overrides,
  };
}

// ── Test workflow context ────────────────────────────────────────────

export interface TestWorkflowContextOptions extends TestRuntimeOptions {
  task?: string;
  agent?: string;
}

export function createTestWorkflowContext(options: TestWorkflowContextOptions = {}): WorkflowContext {
  const fn = getMockFn();
  const runtime = createTestRuntime(options);
  return {
    task: options.task ?? "test task",
    agent: options.agent ?? "may",
    emit: fn(),
    dispatchEvent: fn(),
    getDb: () => runtime.db,
    query: runtime.sdk.query,
    commands: runtime.sdk.commands,
    log: fn(),
    notify: fn(),
    metrics: runtime.sdk.metrics,
    persistDir: runtime.persist,
    projectRoot: runtime.root,
    agentsRoot: runtime.agents,
    sharedRoot: runtime.shared,
    projectsRoot: runtime.projects,
    runAgent: fn(async (agent: string, _task: string, opts?: { schema?: unknown }) => {
      const result = defaultWorkflowTaskResult(agent);
      if (!opts?.schema) return result;
      return {
        ...result,
        status: "error" as const,
        finishResult: undefined,
        error: "Test workflow context has no configured structured result",
      };
    }) as WorkflowContext["runAgent"],
    runWorkflow: fn(async (name: string) => ({ type: "done" as const, summary: `workflow ${name} done` })),
    runFunction: fn(async (label: string) => ({
      sessionId: `fn_${label}`,
      agent: "function",
      status: "done" as const,
      lastAssistantText: "",
      messages: [],
      duration: "0s",
      outputDir: runtime.root,
    })),
    summarize: fn(() => "summary"),
    done: (summary: string) => ({ type: "done", summary }),
    blocked: (reason: string, context?: unknown) => ({ type: "blocked", reason, context }),
    createSession: fn(async () => ({
      prompt: fn(async () => undefined),
      lastText: () => "",
      close: fn(() => undefined),
    })),
  };
}

// ── App authoring contexts ───────────────────────────────────────────

export function createTestAppRead(overrides: Partial<AppRead> = {}): AppRead {
  const fn = getMockFn();
  return {
    appResult: overrides.appResult ?? fn(async () => null),
    task: overrides.task ?? fn(async () => null),
    execution: overrides.execution ?? fn(async () => null),
    metric: overrides.metric ?? fn(async () => null),
  };
}

export function createTestAppLogger(overrides: Partial<AppLogger> = {}): AppLogger {
  const fn = getMockFn();
  return {
    debug: overrides.debug ?? fn(),
    info: overrides.info ?? fn(),
    warn: overrides.warn ?? fn(),
    error: overrides.error ?? fn(),
  };
}

export function createTestObserverContext(
  options: {
    read?: AppRead;
    log?: AppLogger;
    workspace?: ObserverContext["workspace"];
  } = {},
): ObserverContext {
  return {
    read: options.read ?? createTestAppRead(),
    log: options.log ?? createTestAppLogger(),
    workspace: options.workspace ?? {
      appRoot: "/test/apps/example.app",
      projectRoot: "/test/projects/example",
    },
  };
}

export type TestAppWorkflowContextOptions<TInput> = {
  input: TInput;
  reconciliation?: AppWorkflowContext<TInput>["reconciliation"];
  read?: AppRead;
  log?: AppLogger;
  callAgent?: AppWorkflowContext["agents"]["call"];
  runWorkflow?: AppWorkflowContext["workflows"]["run"];
  emit?: AppWorkflowContext["events"]["emit"];
  recordMetric?: AppWorkflowContext["metrics"]["record"];
  workspace?: AppWorkflowContext["workspace"];
  executionId?: string;
};

/** Small fake for new App workflows; it contains no DB, queue, or global paths. */
export function createTestAppWorkflowContext<TInput>(
  options: TestAppWorkflowContextOptions<TInput>,
): AppWorkflowContext<TInput> {
  const fn = getMockFn();
  const executionId = options.executionId ?? "wf_test";
  const terminal = (kind: "agent" | "workflow", id: string): AppExecutionResult => ({
    id,
    kind,
    status: "done",
    summary: "ok",
  });
  return {
    input: options.input,
    ...(options.reconciliation ? { reconciliation: options.reconciliation } : {}),
    read: options.read ?? createTestAppRead(),
    agents: {
      call: options.callAgent ?? fn(async (agent: string) => terminal("agent", `s_test_${agent}`)),
    },
    workflows: {
      run: options.runWorkflow ?? fn(async (name: string) => terminal("workflow", `wf_test_${name}`)),
    },
    events: {
      emit: options.emit ?? fn(async () => undefined),
    },
    metrics: {
      record: options.recordMetric ?? fn(async () => undefined),
    },
    ...(options.workspace ? { workspace: options.workspace } : {}),
    log: options.log ?? createTestAppLogger(),
    done: <T>(summary: string, output?: T) => ({
      id: executionId,
      kind: "workflow",
      status: "done",
      summary,
      ...(output !== undefined ? { output } : {}),
    }),
    blocked: (reason: string, evidence?: unknown) => ({
      id: executionId,
      kind: "workflow",
      status: "blocked",
      summary: reason,
      ...(evidence !== undefined ? { evidence } : {}),
    }),
  };
}
