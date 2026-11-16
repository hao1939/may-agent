/** Test doubles for the canonical App authoring surface. */

import type {
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
  const call =
    options.call ??
    (fn(async (target: string, input: unknown) => {
      if (typeof target === "string" && !target.includes("/") && typeof input === "string") {
        return terminal("agent", `s_test_${target}`);
      }
      return terminal("workflow", `wf_test_${target}`);
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

export type ScriptedTargetFixture =
  | ScriptedStepResponse
  | WorkflowExecutableModule
  | readonly ScriptedStepResponse[]
  | ((call: ScriptedCallContext) => ScriptedStepResponse | Promise<ScriptedStepResponse>);

export type WorkflowTestOptions<TInput> = {
  input: TInput;
  executionId?: string;
  taskOwned?: boolean;
  tools?: "full" | "readonly";
  skill?: string;
  outputSchema?: TSchema;
  task?: TaskDetail;
  reconciliation?: WorkflowContext<TInput>["reconciliation"];
  workspace?: WorkflowContext["workspace"];
  /** Unified target fixtures keyed by target name (supports both prompt and code targets). */
  mocks?: Record<string, ScriptedTargetFixture>;
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
  const targetName = typeof moduleOrTarget === "string" ? moduleOrTarget.trim() : undefined;
  const rootFixture = targetName ? options.mocks?.[targetName] : undefined;
  const rootExecutable = isExecutableModuleFixture(rootFixture)
    ? (rootFixture as WorkflowExecutableModule<TInput>)
    : undefined;
  const module: WorkflowExecutableModule<TInput> =
    typeof moduleOrTarget !== "string"
      ? moduleOrTarget
      : rootExecutable
        ? {
            ...rootExecutable,
            async execute(ctx) {
              if (options.skill !== undefined) {
                throw new Error(
                  `Call option "skill" is only supported for prompt targets, not code procedure "${targetName}"`,
                );
              }
              return rootExecutable.execute(ctx);
            },
          }
        : {
            name: targetName ?? "",
            description: `Standalone SDK test invocation for ${targetName ?? ""}`,
            ...(options.tools === "readonly" ? { readonly: true } : {}),
            async execute(ctx) {
              const callOptions = {
                ...(options.tools ? { tools: options.tools } : {}),
                ...(options.skill ? { skill: options.skill } : {}),
              };
              return options.outputSchema
                ? ctx.call(targetName ?? "", ctx.input, {
                    ...callOptions,
                    schema: options.outputSchema,
                  })
                : ctx.call(targetName ?? "", ctx.input, callOptions);
            },
          };
  type NormalizedFixtureEntry = {
    fixture: ScriptedTargetFixture;
    queue?: ScriptedStepResponse[];
  };
  const makeQueue = (fixture: ScriptedTargetFixture): ScriptedStepResponse[] | undefined => {
    if (Array.isArray(fixture)) return [...fixture];
    if (typeof fixture !== "function" && !isExecutableModuleFixture(fixture)) {
      return [fixture as ScriptedStepResponse];
    }
    return undefined;
  };
  const entriesByTarget = new Map<string, NormalizedFixtureEntry>();
  for (const [name, fixture] of Object.entries(options.mocks ?? {})) {
    entriesByTarget.set(name, { fixture, queue: makeQueue(fixture) });
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
    const entry = entriesByTarget.get(target);
    if (entry) {
      if (isExecutableModuleFixture(entry.fixture)) return "workflow";
      const queuedKind = entry.queue?.[0]?.kind;
      if (queuedKind) return queuedKind;
    }
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
    kind: "agent" | "workflow",
    callOpts: (CallOptions<TSchema> & { schema?: TSchema }) | undefined,
    stepControl: WorkflowKernelStepControl,
  ): Promise<WorkflowStepInvocationResult> => {
    const selected = entriesByTarget.get(target);
    if (!selected) {
      throw new Error(`Unexpected ${kind} call to unconfigured ${kind} "${target}"`);
    }
    const effectiveKind = selected.queue?.[0]?.kind ?? kind;
    if (effectiveKind === "agent" && typeof input !== "string") {
      throw new Error(`Prompt target "${target}" requires a string prompt input`);
    }
    if (typeof selected.fixture === "function") {
      const promptStr = typeof input === "string" ? input : JSON.stringify(input ?? null);
      const res = await (selected.fixture as (call: ScriptedCallContext) => ScriptedStepResponse | Promise<ScriptedStepResponse>)({
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
    if (isExecutableModuleFixture(selected.fixture)) {
      return executeNestedModuleFixture(selected.fixture, input, stepControl, callOpts);
    }
    const next = selected.queue?.shift();
    if (!next) {
      throw new Error(`Exhausted scripted fixture responses for "${target}" on call #${stepControl.stepIndex}`);
    }
    return toStepResult(kind, target, stepControl.stepIndex, next);
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
    outputSchema: nestedControl ? undefined : options.outputSchema,
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
    resolveTarget: (target, input) => {
      const kind = resolveMockKind(target, input);
      return {
        kind,
        invoke: (callOpts, stepControl) =>
          invokeMockTarget(target, input, kind, callOpts, stepControl),
      };
    },
  });

  const outcome = await runWorkflowInvocation(module, buildBindings(options.input));
  const unconsumedFixtures: WorkflowTestRunResult["unconsumedFixtures"] = [];
  for (const [target, entry] of entriesByTarget) {
    if (entry.queue && entry.queue.length > 0) {
      const entryKind = resolveMockKind(target);
      unconsumedFixtures.push({ kind: entryKind, target, remaining: entry.queue.length });
    }
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

/** Execute a named root target with the same test harness used for authored workflows. */
export function runTargetTest<TInput = unknown>(
  target: string,
  options: WorkflowTestOptions<TInput>,
): Promise<WorkflowTestRunResult> {
  return runWorkflowTest(target, options);
}

