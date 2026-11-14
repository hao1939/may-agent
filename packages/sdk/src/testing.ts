/** Test doubles for the canonical App authoring surface. */

import type {
  AgentCallOptions,
  AppRead,
  CallOptions,
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
  type WorkflowKernelStepControl,
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
  resolveCallable,
  resolveCallableTarget,
  runWorkflowInvocation,
  type NormalizedWorkflowContribution,
  type PreparedCatalog,
  type PreparedDefinition,
  type PreparedTarget,
  type PreparedTargetCatalog,
  type WorkflowCleanupStatus,
  type WorkflowExecutableModule,
  type WorkflowExecutionAllowance,
  type WorkflowKernelBindings,
  type WorkflowKernelOutcome,
  type WorkflowKernelStepControl,
  type WorkflowLogEntry,
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
      ...(overrides.tasks?.workload ? { workload: overrides.tasks.workload } : {}),
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
  call?: WorkflowContext["call"];
  callAgent?: (agent: string, task: string, options?: CallOptions<any>) => Promise<ExecutionResult<any>>;
  runWorkflow?: (name: string, input: unknown) => Promise<ExecutionResult<any>>;
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
  const callAgent =
    options.callAgent ?? fn(async (agent: string) => terminal("agent", `s_test_${agent}`));
  const runWorkflow =
    options.runWorkflow ?? fn(async (name: string) => terminal("workflow", `wf_test_${name}`));
  const call =
    options.call ??
    (fn(async (target: string, input: unknown, callOpts?: CallOptions<any>) => {
      if (typeof target === "string" && !target.includes("/") && typeof input === "string") {
        return callAgent(target, input, callOpts);
      }
      return runWorkflow(target, input);
    }) as WorkflowContext["call"]);
  return {
    input: options.input,
    signal: options.signal ?? new AbortController().signal,
    ...(options.reconciliation ? { reconciliation: options.reconciliation } : {}),
    ...(options.reviseTask ? { reviseTask: options.reviseTask } : {}),
    ...(options.closeTask ? { closeTask: options.closeTask } : {}),
    read: options.read ?? createTestAppRead(),
    call,
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
  kind?: "agent" | "workflow";
  status?: ExecutionResult["status"];
  summary?: string;
  output?: unknown;
  facts?: unknown;
  sessionId?: string;
  transcriptPath?: string;
  cleanupConfirmed?: boolean;
};

export type ScriptedCallContext = {
  target: string;
  input: unknown;
  agent: string;
  task: string;
  name: string;
  options?: CallOptions<TSchema> & { schema?: TSchema };
  signal: AbortSignal;
  timeoutMs: number;
  deadlineAt: number;
  stepIndex: number;
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
  options?: CallOptions<TSchema> & { schema?: TSchema };
  signal: AbortSignal;
  timeoutMs: number;
  deadlineAt: number;
  stepIndex: number;
};

export type ScriptedTargetFixture =
  | ScriptedStepResponse
  | WorkflowExecutableModule
  | readonly ScriptedStepResponse[]
  | ((call: ScriptedCallContext) => ScriptedStepResponse | Promise<ScriptedStepResponse>);

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
  tools?: "full" | "readonly";
  task?: TaskDetail;
  reconciliation?: WorkflowContext<TInput>["reconciliation"];
  workspace?: WorkflowContext["workspace"];
  /** Unified target fixtures keyed by target name (supports both prompt and code targets). */
  mocks?: Record<string, ScriptedTargetFixture>;
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
  onStep?: (step: WorkflowStepTrace) => void;
  onLog?: (entry: WorkflowLogEntry) => void;
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
  const effectiveKind = raw.kind ?? kind;
  const defaultId =
    effectiveKind === "agent" ? `s_test_${target}_${stepIndex}` : `wf_test_${target}_${stepIndex}`;
  return {
    id: raw.id ?? defaultId,
    kind: effectiveKind,
    status: raw.status ?? "done",
    summary: raw.summary ?? "ok",
    ...(raw.output !== undefined ? { output: raw.output } : {}),
    ...(raw.facts !== undefined ? { facts: raw.facts } : {}),
    ...(raw.sessionId ? { sessionId: raw.sessionId } : {}),
    ...(raw.transcriptPath ? { transcriptPath: raw.transcriptPath } : {}),
    ...(raw.cleanupConfirmed !== undefined ? { cleanupConfirmed: raw.cleanupConfirmed } : {}),
  };
}

function isExecutableModuleFixture(fixture: unknown): fixture is WorkflowExecutableModule {
  return (
    Boolean(fixture) &&
    typeof fixture === "object" &&
    !Array.isArray(fixture) &&
    "execute" in (fixture as Record<string, unknown>) &&
    typeof (fixture as WorkflowExecutableModule).execute === "function"
  );
}

/**
 * Execute an authored workflow module or named target through the real portable
 * kernel with strict schema validation, scripted step consumption checks, and
 * zero Host setup.
 */
export async function runWorkflowTest<TInput = unknown>(
  moduleOrTarget: WorkflowExecutableModule<TInput> | string,
  options: WorkflowTestOptions<TInput>,
): Promise<WorkflowTestRunResult> {
   const module: WorkflowExecutableModule<TInput> =
     typeof moduleOrTarget === "string"
       ? (() => {
           const targetName = moduleOrTarget.trim();
           const mockEntry = options.mocks?.[targetName] ?? options.workflows?.[targetName];
           if (isExecutableModuleFixture(mockEntry)) {
             return mockEntry as WorkflowExecutableModule<TInput>;
           }
           return {
             name: targetName,
             description: `Standalone SDK test invocation for ${targetName}`,
             ...(options.tools === "readonly" ? { readonly: true } : {}),
             async execute(ctx) {
               return ctx.call(targetName, ctx.input, {
                 ...(options.tools ? { tools: options.tools } : {}),
               });
             },
           };
         })()
       : moduleOrTarget;
  const mockQueues = new Map<string, ScriptedStepResponse[]>();
  for (const [name, fixture] of Object.entries(options.mocks ?? {})) {
    if (Array.isArray(fixture)) {
      mockQueues.set(name, [...fixture]);
    } else if (typeof fixture !== "function" && !isExecutableModuleFixture(fixture)) {
      mockQueues.set(name, [fixture as ScriptedStepResponse]);
    }
  }

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
    } else if (typeof fixture !== "function" && !isExecutableModuleFixture(fixture)) {
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

  const resolveMockKind = (target: string, fallbackInput?: unknown): "agent" | "workflow" => {
    const mockFixture = options.mocks?.[target];
    if (mockFixture) {
      if (isExecutableModuleFixture(mockFixture)) return "workflow";
      const queuedKind = mockQueues.get(target)?.[0]?.kind;
      if (queuedKind) return queuedKind;
      if (!Array.isArray(mockFixture) && typeof mockFixture !== "function") {
        const single = mockFixture as ScriptedStepResponse;
        if (single.kind) return single.kind;
      }
      if (target.includes("/")) return "workflow";
      return typeof fallbackInput === "string" ? "agent" : "workflow";
    }
    if (options.workflows && Object.hasOwn(options.workflows, target)) return "workflow";
    if (options.agents && Object.hasOwn(options.agents, target)) return "agent";
    if (target.includes("/")) return "workflow";
    return typeof fallbackInput === "string" ? "agent" : "workflow";
  };

  const executeNestedModuleFixture = async (
    nestedModule: WorkflowExecutableModule,
    wfInput: unknown,
    stepControl: WorkflowKernelStepControl,
    callOpts?: CallOptions<TSchema> & { schema?: TSchema },
  ): Promise<WorkflowStepInvocationResult> => {
    const sub = await runWorkflowInvocation(
      nestedModule,
      buildBindings(wfInput, {
        ...stepControl,
        tools: callOpts?.tools,
      }),
    );
    if (!sub.ok) {
      const thrown = sub.error instanceof Error ? sub.error : new Error(sub.message);
      if (sub.started) {
        (thrown as Error & { executionId?: string }).executionId = sub.report.executionId;
      }
      throw thrown;
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
  };

  const invokeMockTarget = async (
    target: string,
    input: unknown,
    callOpts: (CallOptions<TSchema> & { schema?: TSchema }) | undefined,
    stepControl: WorkflowKernelStepControl,
    preferredKind?: "agent" | "workflow",
  ): Promise<WorkflowStepInvocationResult> => {
    const kind = preferredKind ?? resolveMockKind(target, input);
    const mockFixture = options.mocks?.[target];
    if (mockFixture) {
      if (typeof mockFixture === "function") {
        const promptStr = typeof input === "string" ? input : JSON.stringify(input ?? null);
        const res = await mockFixture({
          target,
          input,
          agent: target,
          task: promptStr,
          name: target,
          options: callOpts,
          signal: stepControl.signal,
          timeoutMs: stepControl.timeoutMs,
          deadlineAt: stepControl.deadlineAt,
          stepIndex: stepControl.stepIndex,
        });
        return toStepResult(kind, target, stepControl.stepIndex, res);
      }
      if (isExecutableModuleFixture(mockFixture)) {
        return executeNestedModuleFixture(mockFixture, input, stepControl, callOpts);
      }
      const queue = mockQueues.get(target)!;
      const next = queue.shift();
      if (!next) {
        throw new Error(`Exhausted scripted fixture responses for "${target}" on call #${stepControl.stepIndex}`);
      }
      return toStepResult(kind, target, stepControl.stepIndex, next);
    }

    if (kind === "workflow" && options.workflows?.[target]) {
      const fixture = options.workflows[target]!;
      if (typeof fixture === "function") {
        const res = await fixture({
          name: target,
          input,
          options: callOpts,
          signal: stepControl.signal,
          timeoutMs: stepControl.timeoutMs,
          deadlineAt: stepControl.deadlineAt,
          stepIndex: stepControl.stepIndex,
        });
        return toStepResult("workflow", target, stepControl.stepIndex, res);
      }
      if (isExecutableModuleFixture(fixture)) {
        return executeNestedModuleFixture(fixture, input, stepControl, callOpts);
      }
      const queue = workflowQueues.get(target)!;
      const next = queue.shift();
      if (!next) {
        throw new Error(`Exhausted scripted fixture responses for workflow "${target}" on call #${stepControl.stepIndex}`);
      }
      return toStepResult("workflow", target, stepControl.stepIndex, next);
    }

    if (options.agents?.[target]) {
      if (typeof input !== "string") {
        throw new Error(`Prompt target "${target}" requires a string prompt input`);
      }
      const fixture = options.agents[target]!;
      if (typeof fixture === "function") {
        const res = await fixture({
          agent: target,
          task: input,
          options: callOpts,
          signal: stepControl.signal,
          timeoutMs: stepControl.timeoutMs,
          deadlineAt: stepControl.deadlineAt,
          stepIndex: stepControl.stepIndex,
        });
        return toStepResult("agent", target, stepControl.stepIndex, res);
      }
      const queue = agentQueues.get(target)!;
      const next = queue.shift();
      if (!next) {
        throw new Error(`Exhausted scripted fixture responses for agent "${target}" on call #${stepControl.stepIndex}`);
      }
      return toStepResult("agent", target, stepControl.stepIndex, next);
    }

    if (options.workflows?.[target]) {
      return invokeMockTarget(target, input, callOpts, stepControl, "workflow");
    }

    throw new Error(
      `Unexpected ${kind} call to unconfigured ${kind} "${target}"`,
    );
  };

  const buildBindings = (
    currentInput: unknown,
    nestedControl?: {
      signal: AbortSignal;
      timeoutMs: number;
      deadlineAt: number;
      allowance: WorkflowKernelBindings["allowance"];
      tools?: "full" | "readonly";
    },
  ): WorkflowKernelBindings<any> => ({
    executionId: nestedControl ? undefined : options.executionId,
    input: currentInput,
    taskOwned: options.taskOwned ?? Boolean(options.task || options.reconciliation),
    tools: nestedControl?.tools ?? options.tools,
    signal: nestedControl?.signal ?? options.signal,
    timeoutMs: nestedControl?.timeoutMs ?? options.timeoutMs,
    deadlineAt: nestedControl?.deadlineAt ?? options.deadlineAt,
    maxConcurrentCalls: options.maxConcurrentCalls,
    allowance: nestedControl?.allowance,
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
    resolveTargetKind: (target, input) => resolveMockKind(target, input),
    callTarget: (target, input, callOpts, stepControl) =>
      invokeMockTarget(target, input, callOpts, stepControl),
  });

  const outcome = await runWorkflowInvocation(module, buildBindings(options.input));
  const unconsumedFixtures: WorkflowTestRunResult["unconsumedFixtures"] = [];
  for (const [target, queue] of mockQueues) {
    if (queue.length > 0) {
      unconsumedFixtures.push({ kind: resolveMockKind(target), target, remaining: queue.length });
    }
  }
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

