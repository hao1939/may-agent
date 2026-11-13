/**
 * Portable workflow invocation kernel.
 *
 * Coordinates input/step/output schema checks, shared deadline and concurrency
 * allowances, structured child cancellation + join, post-completion context
 * fencing, isolated diagnostic observers, and bounded run reports with zero
 * Host database, EventBus, or SubagentManager dependencies.
 */

import type { Static, TSchema } from "typebox";
import { Check, Errors } from "typebox/value";
import type { AgentCallOptions, AppRead, ExecutionResult, WorkflowMetricCapability } from "./app.js";
import type { TaskReconcileResult } from "./task.js";
import type { Logger, WorkflowContext } from "./workflow.js";

const DEFAULT_WORKFLOW_TIMEOUT_MS = 30 * 60_000;
const MAX_TIMER_MS = 2_147_483_647;
const MAX_REPORT_STEPS = 64;
const MAX_REPORT_LOGS = 128;
const MAX_OBSERVER_ERRORS = 16;
const MAX_PROMPT_CHARS = 2_000;

export type WorkflowExecutableModule<TInput = any> = {
  name: string;
  description: string;
  inputSchema?: TSchema;
  outputSchema?: TSchema;
  executionTimeoutMs?: number;
  workspace?: "shared" | "task" | { kind: "task"; baseBranch: string };
  execute: (ctx: WorkflowContext<TInput>) => Promise<ExecutionResult | TaskReconcileResult>;
  verify?: (context: unknown, result: unknown) => Promise<unknown>;
  sourcePath?: string;
  sourceScope?: "agent" | "project";
  entryContentHash?: string;
};

export type NormalizedWorkflowContribution = (
  | { type: "done"; summary: string }
  | { type: "blocked" | "error" | "interrupted"; reason: string; context?: unknown }
) & { output?: unknown; facts?: unknown };

export type WorkflowStepInvocationResult<TOutput = unknown> = ExecutionResult<TOutput> & {
  sessionId?: string;
  transcriptPath?: string;
  cleanupConfirmed?: boolean;
};

export type WorkflowStepTrace = {
  index: number;
  kind: "agent" | "workflow";
  target: string;
  prompt: string;
  promptTruncated?: true;
  status: ExecutionResult["status"];
  summary: string;
  output?: unknown;
  facts?: unknown;
  error?: { name: string; message: string; stack?: string };
  durationMs: number;
  startedAt: number;
  endedAt: number;
  /** Child execution ID when started; null when invocation failed before establishing an ID. */
  id: string | null;
  sessionId?: string;
  transcriptPath?: string;
  cleanupConfirmed: boolean;
};

export type WorkflowLogEntry = {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  timestamp: number;
  activeStepIndex?: number;
};

export type WorkflowCleanupStatus = {
  confirmed: boolean;
  unconfirmed?: string[];
};

export type WorkflowRunReport = {
  workflow: string;
  executionId: string;
  sourceRevision?: { sourcePath?: string; entryContentHash?: string };
  started: boolean;
  status: "done" | "blocked" | "error" | "interrupted";
  startedAt: number;
  endedAt: number;
  durationMs: number;
  input: unknown;
  result?: NormalizedWorkflowContribution;
  error?: { name: string; message: string; stack?: string };
  steps: WorkflowStepTrace[];
  stepsTruncated: number;
  logs: WorkflowLogEntry[];
  logsTruncated: number;
  limits: {
    timeoutMs: number;
    deadlineAt: number;
    maxConcurrentCalls?: number;
  };
  cleanup: WorkflowCleanupStatus;
  observerErrors: string[];
};

export class WorkflowValidationError extends Error {
  constructor(
    public readonly phase: "input" | "step" | "output",
    message: string,
    public readonly rawValue?: unknown,
  ) {
    super(message);
    this.name = "WorkflowValidationError";
  }
}

export class WorkflowAllowanceExhaustedError extends Error {
  constructor(public readonly maxConcurrentCalls: number) {
    super(`Workflow active call allowance (${maxConcurrentCalls}) exhausted`);
    this.name = "WorkflowAllowanceExhaustedError";
  }
}

export class WorkflowUnconfirmedCleanupError extends Error {
  constructor(
    workflow: string,
    public readonly unconfirmed: readonly string[],
    public readonly causeError?: unknown,
  ) {
    super(`Workflow "${workflow}" finished with unconfirmed descendant cleanup: ${unconfirmed.join(", ")}`);
    this.name = "WorkflowUnconfirmedCleanupError";
  }
}

export type WorkflowExecutionAllowance = {
  readonly deadlineAt: number;
  readonly deadlineReason?: string;
  readonly maxConcurrentCalls?: number;
  acquireCall(): () => void;
};

export function createWorkflowAllowance(options: {
  timeoutMs?: number;
  deadlineAt?: number;
  deadlineReason?: string;
  maxConcurrentCalls?: number;
  now?: number;
}): WorkflowExecutionAllowance & { timeoutMs: number } {
  const now = options.now ?? Date.now();
  const requested = options.timeoutMs ?? DEFAULT_WORKFLOW_TIMEOUT_MS;
  if (!Number.isFinite(requested) || requested <= 0 || requested > MAX_TIMER_MS) {
    throw new Error("Execution timeout must be a positive bounded timer duration");
  }
  const remaining = options.deadlineAt !== undefined ? options.deadlineAt - now : requested;
  if (!Number.isFinite(remaining) || remaining <= 0) {
    throw new Error("Caller execution deadline expired");
  }
  const timeoutMs = Math.min(requested, remaining);
  const deadlineAt = now + timeoutMs;
  const maxConcurrentCalls = options.maxConcurrentCalls;
  if (
    maxConcurrentCalls !== undefined &&
    (!Number.isSafeInteger(maxConcurrentCalls) || maxConcurrentCalls < 1)
  ) {
    throw new Error("maxConcurrentCalls must be a positive integer when set");
  }
  let activeCalls = 0;
  return {
    timeoutMs,
    deadlineAt,
    ...(options.deadlineReason ? { deadlineReason: options.deadlineReason } : {}),
    ...(maxConcurrentCalls !== undefined ? { maxConcurrentCalls } : {}),
    acquireCall() {
      if (maxConcurrentCalls !== undefined && activeCalls >= maxConcurrentCalls) {
        throw new WorkflowAllowanceExhaustedError(maxConcurrentCalls);
      }
      activeCalls++;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        activeCalls--;
      };
    },
  };
}

export type WorkflowKernelBindings<TInput = unknown> = {
  executionId?: string;
  startedAt?: number;
  input: TInput;
  taskOwned?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  timeoutLimitMs?: number;
  deadlineAt?: number;
  maxConcurrentCalls?: number;
  allowance?: WorkflowExecutionAllowance;
  callAgent(
    agent: string,
    task: string,
    options: (AgentCallOptions & { schema?: TSchema }) | undefined,
    stepControl: { signal: AbortSignal; timeoutMs: number; deadlineAt: number; stepIndex: number },
  ): Promise<WorkflowStepInvocationResult>;
  runWorkflow(
    name: string,
    input: unknown,
    stepControl: {
      signal: AbortSignal;
      timeoutMs: number;
      deadlineAt: number;
      stepIndex: number;
      allowance: WorkflowExecutionAllowance;
    },
  ): Promise<WorkflowStepInvocationResult>;
  read?: AppRead;
  events?: WorkflowContext["events"];
  metrics?: WorkflowMetricCapability;
  workspace?: WorkflowContext["workspace"];
  reconciliation?: WorkflowContext<TInput>["reconciliation"];
  reviseTask?: WorkflowContext["reviseTask"];
  closeTask?: WorkflowContext["closeTask"];
  applyTaskChanges?: WorkflowContext["applyTaskChanges"];
  readCommunication?: WorkflowContext["readCommunication"];
  onCancelActive?: () => void;
  confirmCleanup?: () => boolean | Promise<boolean>;
  onStart?: () => void | Promise<void>;
  onStep?: (step: WorkflowStepTrace) => void;
  onLog?: (entry: WorkflowLogEntry) => void;
};

export type WorkflowKernelOutcome =
  | {
      ok: true;
      started: true;
      result: NormalizedWorkflowContribution;
      report: WorkflowRunReport;
    }
  | {
      ok: false;
      started: boolean;
      status: "error" | "interrupted";
      error: unknown;
      message: string;
      report: WorkflowRunReport;
    };

function schemaDiagnostic(schema: TSchema, value: unknown): string {
  const details: string[] = [];
  for (const err of Errors(schema, value)) {
    details.push(`${err.instancePath || "/"} ${err.message}`.trim());
    if (details.length >= 5) break;
  }
  return details.length > 0 ? details.join("; ") : "value failed schema check";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeWorkflowContribution(
  value: unknown,
  taskOwned = false,
): NormalizedWorkflowContribution {
  if (!isRecord(value)) {
    throw new Error("Workflow returned no terminal execution result");
  }
  if (taskOwned && typeof value.state === "string" && typeof value.summary === "string") {
    return { type: "done", summary: value.summary, output: value };
  }
  const isExecutionResult =
    (value.kind === "agent" || value.kind === "workflow") &&
    typeof value.id === "string" &&
    typeof value.summary === "string";
  if (!isExecutionResult) {
    throw new Error("Workflow returned an invalid terminal execution result");
  }
  const payload = {
    ...(value.output !== undefined ? { output: value.output } : {}),
    ...(value.facts !== undefined ? { facts: value.facts } : {}),
  };
  if (value.status === "done") {
    return { type: "done", summary: value.summary as string, ...payload };
  }
  if (value.status === "blocked" || value.status === "error" || value.status === "interrupted") {
    return {
      type: value.status,
      reason: value.summary as string,
      ...payload,
      ...(value.status === "blocked" && value.facts !== undefined ? { context: value.facts } : {}),
    };
  }
  throw new Error(`Workflow returned an unknown execution status: ${String(value.status)}`);
}

function defaultUnavailableRead(): AppRead {
  const unavailable = async () => {
    throw new Error("App read capability is not bound in this workflow runner");
  };
  return {
    contract: unavailable,
    appResult: unavailable,
    tasks: { list: unavailable, outcomes: unavailable, get: unavailable },
    execution: unavailable,
    metric: unavailable,
  };
}

function defaultUnavailableEvents(): WorkflowContext["events"] {
  return {
    emit: async () => {
      throw new Error("events.emit is not bound in this workflow runner");
    },
    read: async () => {
      throw new Error("events.read is not bound in this workflow runner");
    },
    onEvent: () => {
      throw new Error("events.onEvent is not bound in this workflow runner");
    },
  };
}

function defaultUnavailableMetrics(): WorkflowMetricCapability {
  const fail = () => {
    throw new Error("metrics capability is not bound in this workflow runner");
  };
  return {
    define: fail,
    defineMany: fail,
    record: async () => fail(),
    evaluate: fail,
  };
}

function formatError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, ...(error.stack ? { stack: error.stack } : {}) };
  }
  return { name: "Error", message: String(error) };
}

function extractErrorExecutionIdentity(error: unknown): { id: string | null; sessionId?: string } {
  if (!error || typeof error !== "object") return { id: null };
  const candidate = error as {
    executionId?: unknown;
    execution?: { id?: unknown } | null;
    workflowRunId?: unknown;
    sessionId?: unknown;
  };
  const sessionId =
    typeof candidate.sessionId === "string" && candidate.sessionId.trim()
      ? candidate.sessionId
      : undefined;
  const id =
    typeof candidate.executionId === "string" && candidate.executionId.trim()
      ? candidate.executionId
      : typeof candidate.execution?.id === "string" && candidate.execution.id.trim()
        ? candidate.execution.id
        : typeof candidate.workflowRunId === "string" &&
            candidate.workflowRunId.trim() &&
            candidate.workflowRunId !== "unknown"
          ? candidate.workflowRunId
          : sessionId ?? null;
  return { id, ...(sessionId ? { sessionId } : {}) };
}

/**
 * Execute one bounded workflow invocation with symmetric validation, inherited
 * allowance, structured child join, and post-completion context fencing.
 */
export async function runWorkflowInvocation<TInput = unknown>(
  module: WorkflowExecutableModule<TInput>,
  bindings: WorkflowKernelBindings<TInput>,
): Promise<WorkflowKernelOutcome> {
  const executionId =
    bindings.executionId ?? `wr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const startedAt = bindings.startedAt ?? Date.now();
  const steps: WorkflowStepTrace[] = [];
  let stepsTruncated = 0;
  const logs: WorkflowLogEntry[] = [];
  let logsTruncated = 0;
  const observerErrors: string[] = [];

  const recordObserverError = (err: unknown) => {
    if (observerErrors.length < MAX_OBSERVER_ERRORS) {
      observerErrors.push(err instanceof Error ? err.message : String(err));
    }
  };
  const invokeObserver = (fn: (() => void) | undefined) => {
    if (!fn) return;
    try {
      const maybe = fn() as unknown;
      if (maybe && typeof (maybe as Promise<unknown>).catch === "function") {
        void (maybe as Promise<unknown>).catch(recordObserverError);
      }
    } catch (err) {
      recordObserverError(err);
    }
  };

  const sourceRevision =
    module.sourcePath || module.entryContentHash
      ? {
          ...(module.sourcePath ? { sourcePath: module.sourcePath } : {}),
          ...(module.entryContentHash ? { entryContentHash: module.entryContentHash } : {}),
        }
      : undefined;

  const failBeforeStart = (error: unknown, limits?: WorkflowRunReport["limits"]): WorkflowKernelOutcome => {
    const endedAt = Date.now();
    const formatted = formatError(error);
    const status = bindings.signal?.aborted ? "interrupted" : "error";
    return {
      ok: false,
      started: false,
      status,
      error,
      message: formatted.message,
      report: {
        workflow: module.name,
        executionId,
        ...(sourceRevision ? { sourceRevision } : {}),
        started: false,
        status,
        startedAt,
        endedAt,
        durationMs: endedAt - startedAt,
        input: bindings.input,
        error: formatted,
        steps,
        stepsTruncated,
        logs,
        logsTruncated,
        limits: limits ?? {
          timeoutMs: 0,
          deadlineAt: startedAt,
          ...(bindings.maxConcurrentCalls !== undefined
            ? { maxConcurrentCalls: bindings.maxConcurrentCalls }
            : {}),
        },
        cleanup: { confirmed: true },
        observerErrors,
      },
    };
  };

  if (bindings.signal?.aborted) {
    return failBeforeStart(bindings.signal.reason ?? new Error(`Workflow "${module.name}" was aborted before start`));
  }

  let allowance: WorkflowExecutionAllowance;
  let timeoutMs: number;
  let effectiveTimeoutMessage: string;
  try {
    const requestedTimeout = module.executionTimeoutMs ?? bindings.timeoutMs ?? DEFAULT_WORKFLOW_TIMEOUT_MS;
    const boundedTimeout =
      bindings.timeoutLimitMs !== undefined
        ? Math.min(requestedTimeout, bindings.timeoutLimitMs)
        : requestedTimeout;
    const ownTimeoutMessage = `Workflow "${module.name}" timed out after ${boundedTimeout}ms`;
    const inheritedDeadline =
      bindings.allowance !== undefined
        ? bindings.deadlineAt !== undefined
          ? Math.min(bindings.allowance.deadlineAt, bindings.deadlineAt)
          : bindings.allowance.deadlineAt
        : bindings.deadlineAt;
    const inheritedGoverns =
      inheritedDeadline !== undefined &&
      bindings.allowance?.deadlineReason !== undefined &&
      bindings.allowance.deadlineAt === inheritedDeadline &&
      inheritedDeadline <= startedAt + boundedTimeout;
    effectiveTimeoutMessage = inheritedGoverns ? bindings.allowance!.deadlineReason! : ownTimeoutMessage;
    const created = createWorkflowAllowance({
      timeoutMs: boundedTimeout,
      deadlineAt: inheritedDeadline,
      deadlineReason: effectiveTimeoutMessage,
      maxConcurrentCalls: bindings.maxConcurrentCalls ?? bindings.allowance?.maxConcurrentCalls,
      now: startedAt,
    });
    timeoutMs = created.timeoutMs;
    allowance = bindings.allowance
      ? {
          deadlineAt: created.deadlineAt,
          deadlineReason: effectiveTimeoutMessage,
          ...(created.maxConcurrentCalls !== undefined
            ? { maxConcurrentCalls: created.maxConcurrentCalls }
            : {}),
          acquireCall: () => bindings.allowance!.acquireCall(),
        }
      : created;
  } catch (err) {
    return failBeforeStart(err);
  }

  const limits: WorkflowRunReport["limits"] = {
    timeoutMs,
    deadlineAt: allowance.deadlineAt,
    ...(allowance.maxConcurrentCalls !== undefined
      ? { maxConcurrentCalls: allowance.maxConcurrentCalls }
      : {}),
  };

  if (module.inputSchema && !Check(module.inputSchema, bindings.input)) {
    return failBeforeStart(
      new WorkflowValidationError(
        "input",
        `Invalid workflow input for "${module.name}": ${schemaDiagnostic(module.inputSchema, bindings.input)}`,
        bindings.input,
      ),
      limits,
    );
  }

  try {
    await bindings.onStart?.();
  } catch (err) {
    return failBeforeStart(err, limits);
  }

  const controller = new AbortController();
  let fenced = false;
  let timedOut = false;
  let abortedExternally = false;
  const timeoutMessage = effectiveTimeoutMessage;
  const activeOperations = new Set<Promise<unknown>>();
  const childControllers = new Set<AbortController>();
  const eventUnsubscribers = new Set<() => void>();
  const unconfirmedCleanups: string[] = [];
  let nextStepIndex = 0;
  let latestActiveStepIndex: number | undefined;

  const abortFromParent = () => {
    abortedExternally = true;
    controller.abort(
      bindings.signal?.reason ?? new Error(`Workflow "${module.name}" cancelled by caller`),
    );
  };
  bindings.signal?.addEventListener("abort", abortFromParent, { once: true });
  if (bindings.signal?.aborted) abortFromParent();

  const assertActive = (): void => {
    if (fenced) {
      throw new Error(`Workflow "${module.name}" context is closed`);
    }
    if (!controller.signal.aborted && Date.now() >= allowance.deadlineAt) {
      timedOut = true;
      controller.abort(new Error(timeoutMessage));
    }
    controller.signal.throwIfAborted();
  };

  const trackOperation = <T>(promise: Promise<T>): Promise<T> => {
    activeOperations.add(promise);
    void promise.then(
      () => activeOperations.delete(promise),
      () => activeOperations.delete(promise),
    );
    return promise;
  };

  const recordStep = (step: WorkflowStepTrace) => {
    if (steps.length >= MAX_REPORT_STEPS) {
      steps.shift();
      stepsTruncated++;
    }
    steps.push(step);
    invokeObserver(bindings.onStep ? () => bindings.onStep!(step) : undefined);
  };

  const rawRead = bindings.read ?? defaultUnavailableRead();
  const rawEvents = bindings.events ?? defaultUnavailableEvents();
  const rawMetrics = bindings.metrics ?? defaultUnavailableMetrics();

  const logAt = (level: WorkflowLogEntry["level"], message: string) => {
    if (fenced || controller.signal.aborted) return;
    const entry: WorkflowLogEntry = {
      level,
      message,
      timestamp: Date.now(),
      ...(latestActiveStepIndex !== undefined ? { activeStepIndex: latestActiveStepIndex } : {}),
    };
    if (logs.length >= MAX_REPORT_LOGS) {
      logs.shift();
      logsTruncated++;
    }
    logs.push(entry);
    invokeObserver(bindings.onLog ? () => bindings.onLog!(entry) : undefined);
  };

  const logger: Logger = {
    debug: (msg) => logAt("debug", msg),
    info: (msg) => logAt("info", msg),
    warn: (msg) => logAt("warn", msg),
    error: (msg) => logAt("error", msg),
  };

  const runBoundStep = async (
    kind: "agent" | "workflow",
    target: string,
    promptText: string,
    callOptions: (AgentCallOptions & { schema?: TSchema }) | undefined,
    invoke: (stepControl: {
      signal: AbortSignal;
      timeoutMs: number;
      deadlineAt: number;
      stepIndex: number;
    }) => Promise<WorkflowStepInvocationResult>,
  ): Promise<ExecutionResult> => {
    assertActive();
    if (
      !target ||
      typeof target !== "string" ||
      target === "undefined" ||
      target === "unknown"
    ) {
      throw new Error(
        `${kind === "agent" ? "agents.call" : "workflows.run"} called with invalid ${kind} name: ${JSON.stringify(target)}`,
      );
    }
    const remainingMs = allowance.deadlineAt - Date.now();
    if (remainingMs <= 0) {
      timedOut = true;
      const err = new Error(timeoutMessage);
      controller.abort(err);
      throw err;
    }
    const requestedStepMs = callOptions?.timeoutMs ?? remainingMs;
    if (!Number.isFinite(requestedStepMs) || requestedStepMs <= 0 || requestedStepMs > MAX_TIMER_MS) {
      throw new Error("Step timeoutMs must be a positive bounded timer duration");
    }
    const stepTimeoutMs = Math.min(requestedStepMs, remainingMs);
    const stepStartedAt = Date.now();
    const stepDeadlineAt = stepStartedAt + stepTimeoutMs;
    const releaseAllowance = allowance.acquireCall();
    const stepIndex = nextStepIndex++;
    latestActiveStepIndex = stepIndex;
    const stepController = new AbortController();
    let stepTimedOut = false;
    const stepTimeoutError =
      callOptions?.timeoutMs !== undefined && requestedStepMs < remainingMs
        ? new Error(
            `${kind === "agent" ? "Agent" : "Workflow"} step "${target}" timed out after ${stepTimeoutMs}ms`,
          )
        : new Error(timeoutMessage);
    const stepTimer = setTimeout(() => {
      stepTimedOut = true;
      if (stepDeadlineAt >= allowance.deadlineAt && !controller.signal.aborted) {
        timedOut = true;
        controller.abort(new Error(timeoutMessage));
      }
      if (!stepController.signal.aborted) {
        stepController.abort(stepTimeoutError);
      }
    }, Math.max(0, stepDeadlineAt - Date.now()));
    stepTimer.unref?.();
    const onParentAbort = () => stepController.abort(controller.signal.reason);
    controller.signal.addEventListener("abort", onParentAbort, { once: true });
    childControllers.add(stepController);

    try {
      let raw: WorkflowStepInvocationResult;
      let lateRaw: WorkflowStepInvocationResult | undefined;
      let lateCleanupConfirmed = true;
      try {
        raw = await invoke({
          signal: stepController.signal,
          timeoutMs: stepTimeoutMs,
          deadlineAt: stepDeadlineAt,
          stepIndex,
        });
        const rawCleanupConfirmed = raw.cleanupConfirmed !== false;
        if (!rawCleanupConfirmed) {
          const label = `${kind}:${target}${raw.sessionId ? ` (${raw.sessionId})` : raw.id ? ` (${raw.id})` : ""}`;
          if (!unconfirmedCleanups.includes(label)) unconfirmedCleanups.push(label);
        }
        if (stepTimedOut || Date.now() > stepDeadlineAt) {
          lateRaw = raw;
          lateCleanupConfirmed = rawCleanupConfirmed;
          throw stepTimeoutError;
        }
        if (stepController.signal.aborted) {
          lateRaw = raw;
          lateCleanupConfirmed = rawCleanupConfirmed;
          throw stepController.signal.reason ?? stepTimeoutError;
        }
      } catch (stepErr) {
        let stepCleanupConfirmed = lateCleanupConfirmed;
        if (stepErr instanceof WorkflowUnconfirmedCleanupError) {
          stepCleanupConfirmed = false;
          for (const item of stepErr.unconfirmed) {
            if (!unconfirmedCleanups.includes(item)) unconfirmedCleanups.push(item);
          }
        }
        const stepEndedAt = Date.now();
        const promptTruncated = promptText.length > MAX_PROMPT_CHARS;
        const formatted = formatError(stepErr);
        const identity = lateRaw
          ? { id: lateRaw.id, ...(lateRaw.sessionId ? { sessionId: lateRaw.sessionId } : {}) }
          : extractErrorExecutionIdentity(stepErr);
        const failureStatus: ExecutionResult["status"] =
          abortedExternally && !timedOut && !stepTimedOut ? "interrupted" : "error";
        recordStep({
          index: stepIndex,
          kind,
          target,
          prompt: promptTruncated ? `${promptText.slice(0, MAX_PROMPT_CHARS)}...` : promptText,
          ...(promptTruncated ? { promptTruncated: true } : {}),
          status: failureStatus,
          summary: formatted.message,
          error: formatted,
          ...(lateRaw?.facts !== undefined ? { facts: lateRaw.facts } : {}),
          durationMs: stepEndedAt - stepStartedAt,
          startedAt: stepStartedAt,
          endedAt: stepEndedAt,
          id: identity.id,
          ...(identity.sessionId ? { sessionId: identity.sessionId } : {}),
          ...(lateRaw?.transcriptPath ? { transcriptPath: lateRaw.transcriptPath } : {}),
          cleanupConfirmed: stepCleanupConfirmed,
        });
        throw stepErr;
      }

      const cleanupConfirmed = raw.cleanupConfirmed !== false;
      if (kind === "agent" && callOptions?.schema) {
        if (raw.output !== undefined) {
          if (!Check(callOptions.schema, raw.output)) {
            const detail = schemaDiagnostic(callOptions.schema, raw.output);
            raw = {
              ...raw,
              status: "error",
              summary: `Agent "${target}" output failed step schema: ${detail}`,
              output: undefined,
              facts: {
                ...(isRecord(raw.facts) ? raw.facts : raw.facts !== undefined ? { priorFacts: raw.facts } : {}),
                invalidOutput: raw.output,
                validationError: detail,
              },
            };
          }
        } else if (raw.status === "done") {
          raw = {
            ...raw,
            status: "error",
            summary: `Agent "${target}" completed without required schema output`,
            facts: {
              ...(isRecord(raw.facts) ? raw.facts : raw.facts !== undefined ? { priorFacts: raw.facts } : {}),
              validationError: "missing required schema output",
            },
          };
        }
      }

      const stepEndedAt = Date.now();
      const promptTruncated = promptText.length > MAX_PROMPT_CHARS;
      recordStep({
        index: stepIndex,
        kind,
        target,
        prompt: promptTruncated ? `${promptText.slice(0, MAX_PROMPT_CHARS)}...` : promptText,
        ...(promptTruncated ? { promptTruncated: true } : {}),
        status: raw.status,
        summary: raw.summary,
        ...(raw.output !== undefined ? { output: raw.output } : {}),
        ...(raw.facts !== undefined ? { facts: raw.facts } : {}),
        durationMs: stepEndedAt - stepStartedAt,
        startedAt: stepStartedAt,
        endedAt: stepEndedAt,
        id: raw.id,
        ...(raw.sessionId ? { sessionId: raw.sessionId } : {}),
        ...(raw.transcriptPath ? { transcriptPath: raw.transcriptPath } : {}),
        cleanupConfirmed,
      });

      assertActive();
      const { sessionId: _sid, transcriptPath: _tp, cleanupConfirmed: _cc, ...publicResult } = raw;
      return publicResult;
    } finally {
      clearTimeout(stepTimer);
      controller.signal.removeEventListener("abort", onParentAbort);
      childControllers.delete(stepController);
      releaseAllowance();
    }
  };

  const callAgentOverload = (<S extends TSchema>(
    agent: string,
    task: string,
    options?: AgentCallOptions & { schema?: S },
  ): Promise<ExecutionResult<Static<S>>> => {
    try {
      assertActive();
    } catch (err) {
      return Promise.reject(err);
    }
    return trackOperation(
      runBoundStep("agent", agent, task, options, (stepControl) =>
        bindings.callAgent(agent, task, options, stepControl),
      ),
    ) as Promise<ExecutionResult<Static<S>>>;
  }) as WorkflowContext["agents"]["call"];

  const ctx: WorkflowContext<TInput> = {
    input: bindings.input as WorkflowContext<TInput>["input"],
    signal: controller.signal,
    ...(bindings.reconciliation ? { reconciliation: bindings.reconciliation } : {}),
    read: rawRead,
    log: logger,
    metrics: {
      define: (definition) => {
        assertActive();
        rawMetrics.define(definition);
      },
      defineMany: (definitions) => {
        assertActive();
        rawMetrics.defineMany(definitions);
      },
      record: (id, value, options) => {
        try {
          assertActive();
        } catch (err) {
          return Promise.reject(err);
        }
        return trackOperation(Promise.resolve(rawMetrics.record(id, value, options)));
      },
      evaluate: (id) => {
        assertActive();
        return rawMetrics.evaluate(id);
      },
    },
    ...(bindings.workspace ? { workspace: bindings.workspace } : {}),
    ...(bindings.reviseTask
      ? {
          reviseTask: (change) => {
            try {
              assertActive();
            } catch (err) {
              return Promise.reject(err);
            }
            return trackOperation(bindings.reviseTask!(change));
          },
        }
      : {}),
    ...(bindings.closeTask
      ? {
          closeTask: (change) => {
            try {
              assertActive();
            } catch (err) {
              return Promise.reject(err);
            }
            return trackOperation(bindings.closeTask!(change));
          },
        }
      : {}),
    ...(bindings.applyTaskChanges
      ? {
          applyTaskChanges: (changes) => {
            try {
              assertActive();
            } catch (err) {
              return Promise.reject(err);
            }
            return trackOperation(bindings.applyTaskChanges!(changes));
          },
        }
      : {}),
    ...(bindings.readCommunication ? { readCommunication: bindings.readCommunication } : {}),
    agents: {
      call: callAgentOverload,
    },
    workflows: {
      run: (name: string, workflowInput: unknown): Promise<ExecutionResult> => {
        try {
          assertActive();
        } catch (err) {
          return Promise.reject(err);
        }
        const promptPreview =
          typeof workflowInput === "string" ? workflowInput : JSON.stringify(workflowInput ?? null);
        return trackOperation(
          runBoundStep("workflow", name, promptPreview, undefined, (stepControl) =>
            bindings.runWorkflow(name, workflowInput, { ...stepControl, allowance }),
          ),
        );
      },
    },
    events: {
      read: (type, localKey) => {
        try {
          assertActive();
        } catch (err) {
          return Promise.reject(err);
        }
        return trackOperation(rawEvents.read(type, localKey));
      },
      emit: (event) => {
        try {
          assertActive();
        } catch (err) {
          return Promise.reject(err);
        }
        return trackOperation(rawEvents.emit(event));
      },
      onEvent: (listener) => {
        assertActive();
        const unsubscribe = rawEvents.onEvent((event) => {
          if (fenced || controller.signal.aborted) return;
          listener(event);
        });
        const tracked = () => {
          eventUnsubscribers.delete(tracked);
          unsubscribe();
        };
        eventUnsubscribers.add(tracked);
        return tracked;
      },
    },
    done: <T>(summary: string, output?: T): ExecutionResult<T> => ({
      id: executionId,
      kind: "workflow",
      status: "done",
      summary,
      ...(output !== undefined ? { output } : {}),
    }),
    blocked: (reason: string, facts?: unknown): ExecutionResult => ({
      id: executionId,
      kind: "workflow",
      status: "blocked",
      summary: reason,
      ...(facts !== undefined ? { facts } : {}),
    }),
  };

  let cancelNotified = false;
  const notifyCancelOnce = () => {
    if (cancelNotified) return;
    cancelNotified = true;
    bindings.onCancelActive?.();
  };

  let onStopAbort!: () => void;
  const stopped = new Promise<never>((_, reject) => {
    onStopAbort = () => {
      fenced = true;
      for (const child of childControllers) {
        child.abort(controller.signal.reason);
      }
      try {
        notifyCancelOnce();
      } catch {
        // Best-effort cancellation hook cannot mask the abort reason.
      } finally {
        reject(controller.signal.reason);
      }
    };
    controller.signal.addEventListener("abort", onStopAbort, { once: true });
    if (controller.signal.aborted) onStopAbort();
  });

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error(timeoutMessage));
  }, Math.max(0, allowance.deadlineAt - Date.now()));
  timer.unref?.();

  let contribution: NormalizedWorkflowContribution | undefined;
  let caughtError: unknown;

  try {
    const execution = (async () => {
      assertActive();
      const authored = await module.execute(ctx);
      assertActive();
      const normalized = normalizeWorkflowContribution(authored, Boolean(bindings.taskOwned));
      if (module.outputSchema && normalized.type === "done") {
        if (!Check(module.outputSchema, normalized.output)) {
          throw new WorkflowValidationError(
            "output",
            `Invalid workflow output for "${module.name}": ${schemaDiagnostic(module.outputSchema, normalized.output)}`,
            normalized.output,
          );
        }
      }
      return normalized;
    })();

    contribution = await Promise.race([execution, stopped]);
  } catch (err) {
    caughtError = err;
  } finally {
    fenced = true;
    clearTimeout(timer);
    bindings.signal?.removeEventListener("abort", abortFromParent);
    controller.signal.removeEventListener("abort", onStopAbort);
    const closeReason = new Error(`Workflow "${module.name}" execution finished`);
    if (!controller.signal.aborted) {
      controller.abort(closeReason);
    }
    for (const child of childControllers) {
      if (!child.signal.aborted) child.abort(controller.signal.reason);
    }
    if (caughtError !== undefined) {
      try {
        notifyCancelOnce();
      } catch {
        // Ignore secondary cancellation hook error during finalization.
      }
    }
    for (const unsubscribe of eventUnsubscribers) {
      try {
        unsubscribe();
      } catch {
        // Ignore unsubscribe errors during finalization.
      }
    }
    await Promise.allSettled([...activeOperations]);
    if (bindings.confirmCleanup) {
      try {
        const ok = await bindings.confirmCleanup();
        if (!ok) unconfirmedCleanups.push(`workflow:${module.name} (${executionId})`);
      } catch (cleanupErr) {
        unconfirmedCleanups.push(
          `workflow:${module.name} (${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)})`,
        );
      }
    }
  }

  const endedAt = Date.now();
  const cleanup: WorkflowCleanupStatus =
    unconfirmedCleanups.length === 0
      ? { confirmed: true }
      : { confirmed: false, unconfirmed: [...unconfirmedCleanups] };

  if (!cleanup.confirmed) {
    const cleanupError = new WorkflowUnconfirmedCleanupError(
      module.name,
      unconfirmedCleanups,
      caughtError,
    );
    const effectiveError = caughtError ?? cleanupError;
    const formatted = formatError(effectiveError);
    return {
      ok: false,
      started: true,
      status: "error",
      error: cleanupError,
      message: cleanupError.message,
      report: {
        workflow: module.name,
        executionId,
        ...(sourceRevision ? { sourceRevision } : {}),
        started: true,
        status: "error",
        startedAt,
        endedAt,
        durationMs: endedAt - startedAt,
        input: bindings.input,
        ...(contribution ? { result: contribution } : {}),
        error: formatError(cleanupError),
        steps,
        stepsTruncated,
        logs,
        logsTruncated,
        limits,
        cleanup,
        observerErrors: [
          ...observerErrors,
          ...(caughtError ? [`Originating failure: ${formatted.message}`] : []),
        ].slice(0, MAX_OBSERVER_ERRORS),
      },
    };
  }

  if (caughtError !== undefined) {
    const formatted = formatError(caughtError);
    const status: "error" | "interrupted" =
      abortedExternally && !timedOut ? "interrupted" : "error";
    return {
      ok: false,
      started: true,
      status,
      error: caughtError,
      message: formatted.message,
      report: {
        workflow: module.name,
        executionId,
        ...(sourceRevision ? { sourceRevision } : {}),
        started: true,
        status,
        startedAt,
        endedAt,
        durationMs: endedAt - startedAt,
        input: bindings.input,
        ...(caughtError instanceof WorkflowValidationError && caughtError.rawValue !== undefined
          ? {
              result: {
                type: "error",
                reason: formatted.message,
                facts: { invalidOutput: caughtError.rawValue },
              },
            }
          : {}),
        error: formatted,
        steps,
        stepsTruncated,
        logs,
        logsTruncated,
        limits,
        cleanup,
        observerErrors,
      },
    };
  }

  const finalResult = contribution!;
  return {
    ok: true,
    started: true,
    result: finalResult,
    report: {
      workflow: module.name,
      executionId,
      ...(sourceRevision ? { sourceRevision } : {}),
      started: true,
      status: finalResult.type,
      startedAt,
      endedAt,
      durationMs: endedAt - startedAt,
      input: bindings.input,
      result: finalResult,
      steps,
      stepsTruncated,
      logs,
      logsTruncated,
      limits,
      cleanup,
      observerErrors,
    },
  };
}
