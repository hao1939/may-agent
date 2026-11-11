/** Test doubles for the canonical App authoring surface. */

import type {
  AgentCallOptions,
  AppRead,
  ExecutionResult,
  Logger,
  ObserverContext,
  TSchema,
  TaskDetail,
  WorkflowContext,
} from "./app.js";
import {
  runWorkflowInvocation,
  type NormalizedWorkflowContribution,
  type WorkflowExecutableModule,
  type WorkflowKernelBindings,
  type WorkflowLogEntry,
  type WorkflowRunReport,
  type WorkflowStepInvocationResult,
  type WorkflowStepTrace,
} from "./workflow-kernel.js";
export {
  WorkflowAllowanceExhaustedError,
  WorkflowUnconfirmedCleanupError,
  WorkflowValidationError,
  createWorkflowAllowance,
  normalizeWorkflowContribution,
  runWorkflowInvocation,
  type NormalizedWorkflowContribution,
  type WorkflowCleanupStatus,
  type WorkflowExecutableModule,
  type WorkflowExecutionAllowance,
  type WorkflowKernelBindings,
  type WorkflowKernelOutcome,
  type WorkflowLogEntry,
  type WorkflowRequiresDeclaration,
  type WorkflowRunReport,
  type WorkflowStepInvocationResult,
  type WorkflowStepTrace,
} from "./workflow-kernel.js";

export type MockFn<T extends (...args: any[]) => any> = T & {
  calls: Parameters<T>[];
  mock: { calls: Parameters<T>[] };
};

export type MockFnFactory = <T extends (...args: any[]) => any>(impl?: T) => T;

let mockFactory: MockFnFactory | undefined;

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

/** Optionally use the active test runner's mock implementation. */
export function setMockFn(factory: MockFnFactory): void {
  mockFactory = factory;
}

function mockFn(): MockFnFactory {
  return mockFactory ?? localMockFn;
}

export function createTestAppRead(overrides: Partial<AppRead> = {}): AppRead {
  const fn = mockFn();
  const getTask = overrides.tasks?.get ?? fn(async () => null);
  return {
    contract:
      overrides.contract ??
      fn(async () => {
        throw new Error("App contract read unavailable in this fixture");
      }),
    appResult: overrides.appResult ?? fn(async () => null),
    tasks: {
      list: overrides.tasks?.list ?? fn(async () => ({ items: [] })),
      outcomes:
        overrides.tasks?.outcomes ??
        fn(async () => ({
          projection: "outcomes" as const,
          manifestVersion: null,
          sourceCount: 0,
          outcomeCount: 0,
          outcomes: [],
        })),
      get: getTask,
    },
    execution: overrides.execution ?? fn(async () => null),
    metric: overrides.metric ?? fn(async () => null),
  };
}

export function createTestAppLogger(overrides: Partial<Logger> = {}): Logger {
  const fn = mockFn();
  return {
    debug: overrides.debug ?? fn(),
    info: overrides.info ?? fn(),
    warn: overrides.warn ?? fn(),
    error: overrides.error ?? fn(),
  };
}

export function createTestObserverContext(
  options: {
    previousObservation?: ObserverContext["previousObservation"];
    read?: AppRead;
    log?: Logger;
    workspace?: ObserverContext["workspace"];
  } = {},
): ObserverContext {
  return {
    previousObservation: structuredClone(options.previousObservation),
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
  signal?: AbortSignal;
  reconciliation?: WorkflowContext<TInput>["reconciliation"];
  reviseTask?: WorkflowContext["reviseTask"];
  closeTask?: WorkflowContext["closeTask"];
  read?: AppRead;
  log?: Logger;
  callAgent?: WorkflowContext["agents"]["call"];
  runWorkflow?: WorkflowContext["workflows"]["run"];
  emit?: WorkflowContext["events"]["emit"];
  readEvent?: WorkflowContext["events"]["read"];
  onEvent?: WorkflowContext["events"]["onEvent"];
  recordMetric?: WorkflowContext["metrics"]["record"];
  workspace?: WorkflowContext["workspace"];
  executionId?: string;
};

/** Small fake with no database, queue, or global runtime paths. */
export function createTestAppWorkflowContext<TInput>(
  options: TestAppWorkflowContextOptions<TInput>,
): WorkflowContext<TInput> {
  const fn = mockFn();
  const executionId = options.executionId ?? "wf_test";
  const terminal = (kind: "agent" | "workflow", id: string): ExecutionResult => ({
    id,
    kind,
    status: "done",
    summary: "ok",
  });
  return {
    input: options.input,
    signal: options.signal ?? new AbortController().signal,
    ...(options.reconciliation ? { reconciliation: options.reconciliation } : {}),
    ...(options.reviseTask ? { reviseTask: options.reviseTask } : {}),
    ...(options.closeTask ? { closeTask: options.closeTask } : {}),
    read: options.read ?? createTestAppRead(),
    agents: {
      call: options.callAgent ?? fn(async (agent: string) => terminal("agent", `s_test_${agent}`)),
    },
    workflows: {
      run: options.runWorkflow ?? fn(async (name: string) => terminal("workflow", `wf_test_${name}`)),
    },
    events: {
      emit: options.emit ?? fn(async () => undefined),
      read: options.readEvent ?? fn(async () => null),
      onEvent: options.onEvent ?? fn(() => () => undefined),
    },
    metrics: {
      define: fn(() => undefined),
      defineMany: fn(() => undefined),
      record: options.recordMetric ?? fn(async () => undefined),
      evaluate: fn(() => []),
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
    blocked: (reason: string, facts?: unknown) => ({
      id: executionId,
      kind: "workflow",
      status: "blocked",
      summary: reason,
      ...(facts !== undefined ? { facts } : {}),
    }),
  };
}

export type ScriptedStepResponse = {
  id?: string;
  status?: ExecutionResult["status"];
  summary?: string;
  output?: unknown;
  facts?: unknown;
  sessionId?: string;
  transcriptPath?: string;
  cleanupConfirmed?: boolean;
};

export type ScriptedAgentCallContext = {
  agent: string;
  task: string;
  options?: AgentCallOptions & { schema?: TSchema };
  signal: AbortSignal;
  timeoutMs: number;
  deadlineAt: number;
  stepIndex: number;
};

export type ScriptedWorkflowCallContext = {
  name: string;
  input: unknown;
  signal: AbortSignal;
  timeoutMs: number;
  deadlineAt: number;
  stepIndex: number;
};

export type ScriptedAgentFixture =
  | ScriptedStepResponse
  | readonly ScriptedStepResponse[]
  | ((call: ScriptedAgentCallContext) => ScriptedStepResponse | Promise<ScriptedStepResponse>);

export type ScriptedWorkflowFixture =
  | ScriptedStepResponse
  | WorkflowExecutableModule
  | readonly ScriptedStepResponse[]
  | ((call: ScriptedWorkflowCallContext) => ScriptedStepResponse | Promise<ScriptedStepResponse>);

export type WorkflowTestOptions<TInput> = {
  input: TInput;
  executionId?: string;
  taskOwned?: boolean;
  task?: TaskDetail;
  reconciliation?: WorkflowContext<TInput>["reconciliation"];
  workspace?: WorkflowContext["workspace"];
  agents?: Record<string, ScriptedAgentFixture>;
  workflows?: Record<string, ScriptedWorkflowFixture>;
  read?: Partial<AppRead>;
  events?: Partial<WorkflowContext["events"]>;
  metrics?: Partial<WorkflowContext["metrics"]>;
  reviseTask?: WorkflowContext["reviseTask"];
  closeTask?: WorkflowContext["closeTask"];
  applyTaskChanges?: WorkflowContext["applyTaskChanges"];
  signal?: AbortSignal;
  timeoutMs?: number;
  deadlineAt?: number;
  maxConcurrentCalls?: number;
  confirmCleanup?: () => boolean | Promise<boolean>;
  onStep?: (step: WorkflowStepTrace) => void | Promise<void>;
  onLog?: (entry: WorkflowLogEntry) => void | Promise<void>;
  /** Fail when scripted array responses remain unused after completion (default: true). */
  assertAllFixturesConsumed?: boolean;
};

export type WorkflowTestRunResult = {
  ok: boolean;
  started: boolean;
  status: WorkflowRunReport["status"];
  result?: NormalizedWorkflowContribution;
  error?: unknown;
  report: WorkflowRunReport;
  steps: WorkflowStepTrace[];
  logs: WorkflowLogEntry[];
  unconsumedFixtures: Array<{ kind: "agent" | "workflow"; target: string; remaining: number }>;
};

function toStepResult(
  kind: "agent" | "workflow",
  target: string,
  stepIndex: number,
  raw: ScriptedStepResponse,
): WorkflowStepInvocationResult {
  const defaultId = kind === "agent" ? `s_test_${target}_${stepIndex}` : `wf_test_${target}_${stepIndex}`;
  return {
    id: raw.id ?? defaultId,
    kind,
    status: raw.status ?? "done",
    summary: raw.summary ?? "ok",
    ...(raw.output !== undefined ? { output: raw.output } : {}),
    ...(raw.facts !== undefined ? { facts: raw.facts } : {}),
    ...(raw.sessionId ? { sessionId: raw.sessionId } : {}),
    ...(raw.transcriptPath ? { transcriptPath: raw.transcriptPath } : {}),
    ...(raw.cleanupConfirmed !== undefined ? { cleanupConfirmed: raw.cleanupConfirmed } : {}),
  };
}

/**
 * Execute an authored workflow module through the real portable kernel with
 * strict schema validation, scripted step consumption checks, and zero Host setup.
 */
export async function runWorkflowTest<TInput = unknown>(
  module: WorkflowExecutableModule<TInput>,
  options: WorkflowTestOptions<TInput>,
): Promise<WorkflowTestRunResult> {
  const agentQueues = new Map<string, ScriptedStepResponse[]>();
  for (const [name, fixture] of Object.entries(options.agents ?? {})) {
    if (Array.isArray(fixture)) {
      agentQueues.set(name, [...fixture]);
    } else if (typeof fixture !== "function") {
      agentQueues.set(name, [fixture as ScriptedStepResponse]);
    }
  }

  const workflowQueues = new Map<string, ScriptedStepResponse[]>();
  for (const [name, fixture] of Object.entries(options.workflows ?? {})) {
    if (Array.isArray(fixture)) {
      workflowQueues.set(name, [...fixture]);
    } else if (typeof fixture !== "function" && !("execute" in fixture && typeof fixture.execute === "function")) {
      workflowQueues.set(name, [fixture as ScriptedStepResponse]);
    }
  }

  const taskDetail = options.task;
  const reconciliation: WorkflowContext<TInput>["reconciliation"] | undefined =
    options.reconciliation ??
    (taskDetail
      ? {
          task: taskDetail,
          appId: "test-app",
          taskId: taskDetail.id,
          generation: taskDetail.generation,
          resourceVersion: taskDetail.resourceVersion ?? 1,
          agent: taskDetail.agent ?? "test-agent",
          owner: taskDetail.agent ?? "test-agent",
          outcome: taskDetail.outcome,
          acceptance: taskDetail.acceptance,
          input: taskDetail.input as TInput,
          children: { live: [], completed: [] },
          waits: { open: [], note: "test snapshot" },
          taskSnapshot: { live: [], truncated: false },
          events: { items: [], truncated: false },
        }
      : undefined);

  const read: AppRead = createTestAppRead({
    ...options.read,
    tasks: {
      list:
        options.read?.tasks?.list ??
        (async () => ({ items: taskDetail ? [taskDetail] : [] })),
      outcomes:
        options.read?.tasks?.outcomes ??
        (async () => ({
          projection: "outcomes" as const,
          manifestVersion: null,
          sourceCount: 0,
          outcomeCount: 0,
          outcomes: [],
        })),
      get:
        options.read?.tasks?.get ??
        (async (id: string) => {
          if (taskDetail && id === taskDetail.id) return structuredClone(taskDetail);
          throw new Error(`Unconfigured task read for "${id}" in runWorkflowTest; supply task or read.tasks.get`);
        }),
      ...(options.read?.tasks?.workload ? { workload: options.read.tasks.workload } : {}),
    },
  });

  const events: WorkflowContext["events"] = {
    emit:
      options.events?.emit ??
      (async () => {
        throw new Error("Unconfigured events.emit in runWorkflowTest; supply events.emit when workflow publishes events");
      }),
    read:
      options.events?.read ??
      (async () => {
        throw new Error("Unconfigured events.read in runWorkflowTest; supply events.read when workflow reads events");
      }),
    onEvent:
      options.events?.onEvent ??
      (() => {
        throw new Error("Unconfigured events.onEvent in runWorkflowTest; supply events.onEvent when workflow observes events");
      }),
  };

  const fn = mockFn();
  const metrics: WorkflowContext["metrics"] = {
    define: options.metrics?.define ?? fn(() => undefined),
    defineMany: options.metrics?.defineMany ?? fn(() => undefined),
    record: options.metrics?.record ?? fn(async () => undefined),
    evaluate: options.metrics?.evaluate ?? fn(() => []),
  };

  const availableCapabilities = {
    agents: new Set(Object.keys(options.agents ?? {})),
    workflows: new Set(Object.keys(options.workflows ?? {})),
  };

  const buildBindings = (
    currentInput: unknown,
    nestedControl?: { signal: AbortSignal; timeoutMs: number; deadlineAt: number; allowance: WorkflowKernelBindings["allowance"] },
  ): WorkflowKernelBindings<any> => ({
    executionId: nestedControl ? undefined : options.executionId,
    input: currentInput,
    taskOwned: options.taskOwned ?? Boolean(options.task || options.reconciliation),
    signal: nestedControl?.signal ?? options.signal,
    timeoutMs: nestedControl?.timeoutMs ?? options.timeoutMs,
    deadlineAt: nestedControl?.deadlineAt ?? options.deadlineAt,
    maxConcurrentCalls: options.maxConcurrentCalls,
    allowance: nestedControl?.allowance,
    availableCapabilities,
    read,
    events,
    metrics,
    workspace: options.workspace,
    reconciliation,
    reviseTask: options.reviseTask,
    closeTask: options.closeTask,
    applyTaskChanges: options.applyTaskChanges,
    confirmCleanup: options.confirmCleanup,
    onStep: options.onStep,
    onLog: options.onLog,
    callAgent: async (agent, task, callOpts, stepControl) => {
      const fixture = options.agents?.[agent];
      if (!fixture) {
        throw new Error(`Unexpected agent call to unconfigured agent "${agent}"`);
      }
      if (typeof fixture === "function") {
        const res = await fixture({ agent, task, options: callOpts, ...stepControl });
        return toStepResult("agent", agent, stepControl.stepIndex, res);
      }
      const queue = agentQueues.get(agent)!;
      const next = queue.shift();
      if (!next) {
        throw new Error(`Exhausted scripted fixture responses for agent "${agent}" on call #${stepControl.stepIndex}`);
      }
      return toStepResult("agent", agent, stepControl.stepIndex, next);
    },
    runWorkflow: async (name, wfInput, stepControl) => {
      const fixture = options.workflows?.[name];
      if (!fixture) {
        throw new Error(`Unexpected workflow call to unconfigured workflow "${name}"`);
      }
      if (typeof fixture === "function") {
        const res = await fixture({
          name,
          input: wfInput,
          signal: stepControl.signal,
          timeoutMs: stepControl.timeoutMs,
          deadlineAt: stepControl.deadlineAt,
          stepIndex: stepControl.stepIndex,
        });
        return toStepResult("workflow", name, stepControl.stepIndex, res);
      }
      if (!Array.isArray(fixture) && "execute" in fixture && typeof fixture.execute === "function") {
        const sub = await runWorkflowInvocation(fixture, buildBindings(wfInput, stepControl));
        if (!sub.ok) {
          throw sub.error instanceof Error ? sub.error : new Error(sub.message);
        }
        return {
          id: sub.report.executionId,
          kind: "workflow",
          status: sub.result.type,
          summary: sub.result.type === "done" ? sub.result.summary : sub.result.reason,
          ...(sub.result.output !== undefined ? { output: sub.result.output } : {}),
          ...(sub.result.facts !== undefined ? { facts: sub.result.facts } : {}),
          cleanupConfirmed: sub.report.cleanup.confirmed,
        };
      }
      const queue = workflowQueues.get(name)!;
      const next = queue.shift();
      if (!next) {
        throw new Error(`Exhausted scripted fixture responses for workflow "${name}" on call #${stepControl.stepIndex}`);
      }
      return toStepResult("workflow", name, stepControl.stepIndex, next);
    },
  });

  const outcome = await runWorkflowInvocation(module, buildBindings(options.input));
  const unconsumedFixtures: WorkflowTestRunResult["unconsumedFixtures"] = [];
  for (const [target, queue] of agentQueues) {
    if (queue.length > 0) unconsumedFixtures.push({ kind: "agent", target, remaining: queue.length });
  }
  for (const [target, queue] of workflowQueues) {
    if (queue.length > 0) unconsumedFixtures.push({ kind: "workflow", target, remaining: queue.length });
  }

  if ((options.assertAllFixturesConsumed ?? true) && outcome.ok && unconsumedFixtures.length > 0) {
    const summary = unconsumedFixtures
      .map((item) => `${item.kind}:${item.target} (${item.remaining} remaining)`)
      .join(", ");
    const unconsumedErr = new Error(`Unconsumed workflow test fixtures: ${summary}`);
    return {
      ok: false,
      started: outcome.started,
      status: "error",
      result: outcome.result,
      error: unconsumedErr,
      report: {
        ...outcome.report,
        status: "error",
        error: { name: unconsumedErr.name, message: unconsumedErr.message },
      },
      steps: outcome.report.steps,
      logs: outcome.report.logs,
      unconsumedFixtures,
    };
  }

  return {
    ok: outcome.ok,
    started: outcome.started,
    status: outcome.report.status,
    ...(outcome.ok ? { result: outcome.result } : { error: outcome.error }),
    report: outcome.report,
    steps: outcome.report.steps,
    logs: outcome.report.logs,
    unconsumedFixtures,
  };
}
