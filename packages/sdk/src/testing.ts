/** Test doubles for the canonical App authoring surface. */

import type { AppRead, ExecutionResult, Logger, ObserverContext, WorkflowContext } from "./app.js";

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
  reconciliation?: WorkflowContext<TInput>["reconciliation"];
  read?: AppRead;
  log?: Logger;
  callAgent?: WorkflowContext["agents"]["call"];
  runWorkflow?: WorkflowContext["workflows"]["run"];
  emit?: WorkflowContext["events"]["emit"];
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
    blocked: (reason: string, evidence?: unknown) => ({
      id: executionId,
      kind: "workflow",
      status: "blocked",
      summary: reason,
      ...(evidence !== undefined ? { evidence } : {}),
    }),
  };
}
