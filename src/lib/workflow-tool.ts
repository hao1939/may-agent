import { isDeepStrictEqual } from "node:util";
import { AppTaskResourceStore } from "../app/core/state/app-task-resource-store.js";
import { assertCurrentTaskActor } from "../app/core/tasks/task-actor.js";
import { ExecutionDeferredError } from "@may-agent/sdk/app";
import {
  CallableCatalog,
  WorkflowAllowanceExhaustedError,
  WorkflowUnconfirmedCleanupError,
  canonicalCallableName,
  createWorkflowAllowance,
  formatExecutionInput,
  resolveCallable,
  runWorkflowInvocation,
  type CallableDescriptor,
  type CallableDefinition,
  type ExecutionInput,
  type PreparedCatalog,
  type WorkflowExecutableModule,
  type WorkflowKernelBindings,
  type WorkflowKernelStepControl,
  type WorkflowExecutionAllowance,
  type WorkflowStepInvocationResult,
} from "@may-agent/sdk/runtime";
import { join } from "node:path";
import { type TSchema } from "typebox";
import { getDb } from "./db/connection.js";
import { taskDetailRoot, type TaskExecutionContext } from "./task-execution-context.js";

import type {
  AgentCallOptions,
  CallOptions,
  ExecutionResult as AppExecutionResult,
  AppRead,
  TaskAttempt,
  TaskReconciliationContext,
} from "@may-agent/sdk/app";
import { normalizeEventOwner } from "../../packages/control/src/event-envelope.js";
import { readMetricView } from "../app/adapters/reporting/metric-read.js";
import { canonicalAppEvent } from "../app/canonical-app-event.js";
import { EVENT_RECORD_ONLY, type EventTrace } from "../app/core/events/bus.js";
import { createRuntimeAppRead } from "../app/core/reads/app-read.js";
import type { AppTaskEvents } from "../app/core/tasks/app-task-emitter.js";
import { getWorkflowRun, insertWorkflowRun, updateWorkflowRun } from "./db/workflows.js";
import {
  agentExecutionResult,
  buildWorkflowCatalog,
  deferredExecutionResult,
  enforceStructuredWorkflowResult,
  executionTimeout,
  findWorkflow,
  inspectWorkflowDefinition,
  workflowExecutionResult,
  type WorkflowCatalog,
  type WorkflowExecutionEnvironment,
} from "@may-agent/sdk/runtime";
import type { SubagentManager } from "./manager.js";
import { createUnavailableMetricService } from "./metrics.js";
import type { TaskBinding } from "./persistence.js";
import type { RuntimeCtx } from "./runtime-ctx.js";
import type { SubagentDefinition } from "@may-agent/sdk/runtime";
import { createWorkflowDiagnostics } from "./workflow-diagnostics.js";
import { retainWorkflowResultPayload } from "./workflow-payload.js";
import type {
  CompletedStep,
  WorkflowEvent,
  WorkflowModule,
  WorkflowResult,
  WorkflowStepSummary,
  WorkflowToolResult,
} from "./workflow.js";
import { WorkflowInterrupted } from "./workflow.js";

export { inspectWorkflowDefinition };
// ── In-memory workflow types (used during execution) ────────────────────

/** In-memory record of a workflow execution. */
export interface WorkflowRun {
  runId: string;
  workflow: string;
  task: string;
  parentSessionId: string;
  parentWorkflowRunId?: string;
  projectId?: string;
  taskBinding?: TaskBinding;
  depth: number;
  startedAt: number;
  endedAt?: number;
  status: "running" | "done" | "blocked" | "escalated" | "interrupted" | "error";
  steps: WorkflowStep[];
  sourcePath?: string;
  sourceScope?: "agent" | "project";
  entryContentHash?: string;
  result?: {
    summary?: string;
    reason?: string;
  };
}

/** A single step in a workflow execution. */
export interface WorkflowStep {
  sessionId: string;
  agent: string;
  task: string;
  status: "done" | "error" | "interrupted";
  startedAt: number;
  endedAt: number;
  lastAssistantText: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

function generateRunId(): string {
  return `wr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Max completed steps to keep full detail for. Older steps get trimmed to save memory. */
const MAX_DETAILED_STEPS = 20;

function buildStepSummaries(completedSteps: CompletedStep[]): WorkflowStepSummary[] {
  // For large step arrays, only include last MAX_DETAILED_STEPS in the returned result
  // to prevent context overflow when workflows run many iterations (e.g. persistent-task)
  const steps = completedSteps.length > MAX_DETAILED_STEPS ? completedSteps.slice(-MAX_DETAILED_STEPS) : completedSteps;
  return steps.map((step) => ({
    agent: step.step,
    sessionId: step.sessionId ?? "unknown",
    status: step.result.status,
    output: truncate(step.result.lastAssistantText ?? "(no output)", 2000),
    duration: step.result.duration,
  }));
}

/**
 * Trim old completed steps to prevent unbounded memory growth.
 * Replaces full TaskResult with a lightweight stub for steps beyond the keep window.
 * This preserves step count/metadata while freeing memory.
 */
function pruneCompletedSteps(completedSteps: CompletedStep[]): void {
  if (completedSteps.length <= MAX_DETAILED_STEPS) return;
  const pruneCount = completedSteps.length - MAX_DETAILED_STEPS;
  for (let i = 0; i < pruneCount; i++) {
    const step = completedSteps[i];
    if (step.result.messages && step.result.messages.length > 0) {
      // Replace full result with lightweight stub — keep status + summary only
      step.result = {
        ...step.result,
        messages: [], // free the large messages array
        lastAssistantText: truncate(step.result.lastAssistantText ?? "", 200),
      };
    }
  }
}

export interface WorkflowRunner {
  run(name: string, task: string, catalog?: WorkflowCatalog): Promise<WorkflowToolResult>;
  steer(message: string): boolean;
  readonly isRunning: boolean;
  readonly activeWorkflow: string | null;
}

/** A named workflow could not be resolved from the owning agent's catalog. */
export class WorkflowHandlerUnavailable extends Error {
  constructor(
    public readonly workflow: string,
    message: string,
  ) {
    super(message);
    this.name = "WorkflowHandlerUnavailable";
  }
}

/** System callers keep their failure path without losing the contribution evidence. */
export class WorkflowExecutionFailure extends Error {
  constructor(workflow: string, public readonly execution: AppExecutionResult) {
    super(`Workflow "${workflow}" ${execution.status}: ${execution.summary} (workflow-run:${execution.id})`);
    this.name = "WorkflowExecutionFailure";
  }
}

// Both uncaptured Host entries fence preparation before importing. The fallback
// is a provisional discovery watchdog, not a ceiling on a later declaration.
// Native imports cannot be preempted: stop waiting, fence later imports, and
// report outstanding import cleanup rather than inventing a started run.
async function prepareRootWorkflow(
  opts: Pick<WorkflowToolOptions, "workflowDir" | "signal" | "executionTimeoutMs" | "executionTimeoutLimitMs">,
  name: string,
): Promise<{ catalog: WorkflowCatalog; allowance: WorkflowExecutionAllowance }> {
  const startedAt = Date.now();
  opts.signal?.throwIfAborted();
  const timeoutMs = executionTimeout(opts.executionTimeoutMs);
  const ceiling = opts.executionTimeoutLimitMs === undefined
    ? timeoutMs
    : executionTimeout(opts.executionTimeoutLimitMs);
  const boundedTimeout = Math.min(timeoutMs, ceiling);
  const deadlineReason = `Workflow "${name}" timed out after ${boundedTimeout}ms`;
  const allowance = createWorkflowAllowance({ timeoutMs: boundedTimeout, deadlineReason, now: startedAt });
  const controller = new AbortController();
  const onAbort = () => controller.abort(opts.signal?.reason ?? new Error(`Workflow "${name}" cancelled`));
  opts.signal?.addEventListener("abort", onAbort, { once: true });
  const check = () => {
    if (Date.now() >= allowance.deadlineAt && !controller.signal.aborted) {
      controller.abort(new Error(deadlineReason));
    }
    controller.signal.throwIfAborted();
  };
  const timer = setTimeout(
    () => controller.abort(new Error(deadlineReason)),
    Math.max(0, allowance.deadlineAt - Date.now()),
  );
  timer.unref?.();
  let pendingImports = 0;
  try {
    check();
    const catalog = await buildWorkflowCatalog(opts.workflowDir, controller.signal, {
      onImportStart: () => {
        check();
        pendingImports += 1;
      },
      onImportSettled: () => {
        pendingImports -= 1;
      },
    });
    // A stopped discovery must never be revived by a longer declaration.
    check();
    const { workflow } = findWorkflow(catalog, name);
    const declaredTimeout = executionTimeout(workflow?.executionTimeoutMs ?? opts.executionTimeoutMs);
    const admittedTimeout = opts.executionTimeoutLimitMs === undefined
      ? declaredTimeout
      : Math.min(declaredTimeout, ceiling);
    return {
      catalog,
      allowance: createWorkflowAllowance({
        timeoutMs: admittedTimeout,
        now: startedAt,
        deadlineReason: `Workflow "${name}" timed out after ${admittedTimeout}ms`,
      }),
    };
  } catch (error) {
    if (pendingImports > 0) {
      throw new WorkflowUnconfirmedCleanupError(name, [`root workflow import (${name})`], error);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}

// ── runWorkflowDirect — for system-level callers (handlers) ───────────

export interface RunWorkflowDirectOpts {
  workflowName: string;
  task: string;
  manager: SubagentManager;
  /** Immutable definitions captured with the owning Task attempt. */
  agentDefinitions?: ReadonlyMap<string, SubagentDefinition>;
  runtimeCtx: RuntimeCtx;
  /** Canonical App read capability captured with this execution. */
  read?: AppRead;
  agentName: string;
  /** Exact source stored on agent sessions started by this workflow. */
  sessionSource?: string;
  persistDir: string;
  workflowDir?: string;
  parentSessionId?: string;
  projectId?: string;
  /** Explicit task resource whose controller owns this workflow result. */
  taskBinding?: TaskBinding;
  taskContext?: TaskExecutionContext;
  /** Runtime that exclusively owns crash recovery for workflow step sessions. */
  recoveryOwner?: string;
  /** Fenced event capability for a resource-backed Task attempt. */
  taskEmitter?: AppTaskEvents;
  reviseTask?: TaskAttempt["reviseTask"];
  closeTask?: TaskAttempt["closeTask"];
  onEvent?: (event: WorkflowEvent) => void;
  trace?: EventTrace;
  executionPaths?: { appDir: string; projectDir: string; workspaceDir: string };
  /** App-authored input exposed through the capability-scoped WorkflowContext. */
  workflowInput?: unknown;
  /** Bounded durable-task facts exposed without requiring prompt parsing. */
  reconciliation?: TaskReconciliationContext;
  /** 1-based attempt number for the owning Task generation. */
  attemptNumber?: number;
  /** Maximum wall-clock duration for the complete workflow execution. */
  executionTimeoutMs?: number;
  /** Host ceiling; workflow declarations may shorten but never extend this bound. */
  executionTimeoutLimitMs?: number;
  /** Best-effort stop signal for the exact Task attempt owning this run. */
  signal?: AbortSignal;
}

/**
 * Run a workflow through the typed runner shared with the model tool.
 * Used by system-level callers like the project handler.
 * Gets the same step tracking, persistence, and scoped SDK capabilities
 * as agent-invoked workflows.
 */
export async function runWorkflowDirect(opts: RunWorkflowDirectOpts): Promise<{
  result: WorkflowResult;
  runId: string;
  verifier?: { name: string; sourcePath: string; verify: NonNullable<WorkflowModule["verify"]> };
  answeredHumanConditions?: Array<{ conditionId: string; expectedConditionGeneration: number }>;
  doneSettlement?: { requests?: import("@may-agent/sdk/app").TaskAppRequest[]; response?: string };
}> {
  // Execution and its verifier must come from the same dispatch snapshot.
  const { catalog, allowance } = await prepareRootWorkflow({ ...opts, workflowDir: opts.workflowDir ?? "" }, opts.workflowName);
  const { workflow } = findWorkflow(catalog, opts.workflowName);
  let answeredHumanConditions: Array<{ conditionId: string; expectedConditionGeneration: number }> | undefined;
  let doneSettlement: { requests?: import("@may-agent/sdk/app").TaskAppRequest[]; response?: string } | undefined;
  const runner = createPreparedWorkflowRunner({
    manager: opts.manager,
    agentDefinitions: opts.agentDefinitions,
    workflowDir: opts.workflowDir ?? "",
    persistDir: opts.persistDir,
    agentName: opts.agentName,
    sessionSource: opts.sessionSource,
    parentSessionId: opts.parentSessionId,
    projectId: opts.projectId,
    taskBinding: opts.taskBinding,
    taskContext: opts.taskContext,
    recoveryOwner: opts.recoveryOwner,
    taskEmitter: opts.taskEmitter,
    reviseTask: opts.reviseTask,
    closeTask: opts.closeTask,
    onEvent: opts.onEvent,
    trace: opts.trace,
    runtimeCtx: opts.runtimeCtx,
    read: opts.read,
    executionPaths: opts.executionPaths,
    ...(opts.workflowInput !== undefined ? { workflowInput: opts.workflowInput } : {}),
    ...(opts.reconciliation ? { reconciliation: opts.reconciliation } : {}),
    ...(opts.attemptNumber !== undefined ? { attemptNumber: opts.attemptNumber } : {}),
    onAnsweredHumanConditions: (items) => {
      answeredHumanConditions = items;
    },
    onDoneSettlement: (settlement) => {
      doneSettlement = settlement;
    },
    executionTimeoutMs: opts.executionTimeoutMs,
    executionTimeoutLimitMs: opts.executionTimeoutLimitMs,
    signal: opts.signal,
  }, allowance);

  const parsed = await runner.run(opts.workflowName, opts.task, catalog);
  const verifier = workflow?.verify
    ? { name: workflow.name, sourcePath: workflow.sourcePath, verify: workflow.verify }
    : undefined;

  if (parsed.type === "done") {
    return {
      result: { type: "done", summary: parsed.summary, output: parsed.output, facts: parsed.facts },
      runId: parsed.workflowRunId,
      ...(verifier ? { verifier } : {}),
      ...(answeredHumanConditions ? { answeredHumanConditions } : {}),
      ...(doneSettlement ? { doneSettlement } : {}),
    };
  }
  if (parsed.type === "error") {
    if (parsed.category === "workflow_definition_missing") {
      throw new WorkflowHandlerUnavailable(opts.workflowName, parsed.error);
    }
    const execution = workflowExecutionResult(parsed);
    if (execution) throw new WorkflowExecutionFailure(opts.workflowName, execution);
    throw new Error(`Workflow "${opts.workflowName}" error: ${parsed.error}`);
  }
  if (parsed.type === "blocked") {
    return {
      result: { type: "blocked", reason: parsed.reason, context: parsed.context, output: parsed.output, facts: parsed.facts },
      runId: parsed.workflowRunId,
      ...(verifier ? { verifier } : {}),
      ...(answeredHumanConditions ? { answeredHumanConditions } : {}),
    };
  }
  if (parsed.type === "interrupted") {
    throw new WorkflowExecutionFailure(opts.workflowName, workflowExecutionResult(parsed)!);
  }
  throw new Error(`Workflow "${opts.workflowName}" returned unknown result: ${(parsed as any).type ?? "unknown"}`);
}

// ── createWorkflowTool ─────────────────────────────────────────────────

export interface WorkflowToolOptions {
  manager: SubagentManager;
  /** Optional immutable agent catalog for one release-bound execution. */
  agentDefinitions?: ReadonlyMap<string, SubagentDefinition>;
  /** Internal immutable workflow catalogs already loaded for the captured callable tree. */
  workflowCatalogsByOwner?: ReadonlyMap<string, WorkflowCatalog>;
  /** Internal identity for a prepared callable catalog whose workflow modules are already loaded. */
  callableCatalogScope?: object;
  workflowDir: string;
  /** Persist directory for saving workflow run records. */
  persistDir?: string;
  /** The caller's session ID — used as parentSessionId for spawned sessions.
   *  Can be a string or a function returning a string (for lazy resolution). */
  callerSessionId?: string | (() => string);
  /** The agent that owns this workflow catalog and its execution provenance. */
  agentName?: string;
  /** Exact captured catalog key for the workflow owner; independent of caller lineage. */
  canonicalOwner?: string;
  /** Exact source stored on agent sessions started by this workflow. */
  sessionSource?: string;
  /** Maximum workflow nesting depth (default: 3). */
  maxDepth?: number;
  onEvent?: (event: WorkflowEvent) => void;
  /** Parent session ID for spawned sessions. */
  parentSessionId?: string;
  /** Canonical project id for sessions spawned by this workflow. */
  projectId?: string;
  /** Explicit task resource whose controller owns this workflow result. */
  taskBinding?: TaskBinding;
  taskContext?: TaskExecutionContext;
  /** Runtime that exclusively owns crash recovery for workflow step sessions. */
  recoveryOwner?: string;
  /** Pre-built RuntimeCtx — shared infra (emit, getDb, log, notify, paths). */
  runtimeCtx?: RuntimeCtx;
  /** Canonical App read capability captured with this execution. */
  read?: AppRead;
  /** Fenced App-authored event capability for a resource-backed Task attempt. */
  taskEmitter?: AppTaskEvents;
  reviseTask?: TaskAttempt["reviseTask"];
  closeTask?: TaskAttempt["closeTask"];
  /** Resolved app/domain paths supplied by the Host. */
  executionPaths?: { appDir: string; projectDir: string; workspaceDir: string };
  /** App-authored input for a system-dispatched top-level workflow. */
  workflowInput?: unknown;
  /** Bounded durable-task facts for a task-owned workflow attempt. */
  reconciliation?: TaskReconciliationContext;
  /** Maximum wall-clock duration for the complete workflow execution. */
  executionTimeoutMs?: number;
  /** Host ceiling; workflow declarations may shorten but never extend this bound. */
  executionTimeoutLimitMs?: number;
  /** Best-effort stop signal for the exact Task attempt owning this run. */
  signal?: AbortSignal;
  /** Trace inherited from the event that started this workflow. */
  trace?: EventTrace;
  /** Resolve the active caller turn trace for long-lived chat sessions. */
  callerTrace?: () => EventTrace | undefined;
  /** 1-based attempt number for the owning Task generation. */
  attemptNumber?: number;
  /** Internal callback receiving verified `human.review` Conditions answered during the root run. */
  onAnsweredHumanConditions?: (items: Array<{ conditionId: string; expectedConditionGeneration: number }>) => void;
  /** Internal callback receiving `DoneOptions` (`requests`, `response`) supplied via `ctx.done(...)`. */
  onDoneSettlement?: (settlement: { requests?: import("@may-agent/sdk/app").TaskAppRequest[]; response?: string }) => void;
}

/** Typed workflow execution for SDK, handlers, and other system callers. */
export function createWorkflowRunner(opts: WorkflowToolOptions): WorkflowRunner {
  return createPreparedWorkflowRunner(opts);
}

function createPreparedWorkflowRunner(
  opts: WorkflowToolOptions,
  rootAllowance?: WorkflowExecutionAllowance,
): WorkflowRunner {
  if (opts.taskContext?.taskBinding) {
    if (opts.taskBinding && !isDeepStrictEqual(opts.taskBinding, opts.taskContext.taskBinding)) {
      throw new Error("Task execution binding does not match its Task context");
    }
    if (!opts.taskBinding) opts = { ...opts, taskBinding: opts.taskContext.taskBinding };
  }
  const { manager, workflowDir, persistDir, onEvent } = opts;
  const assertWorkflowExecution = (): void => {
    if (!opts.taskBinding) return;
    const db = opts.runtimeCtx?.getDb?.() ?? (persistDir ? getDb(persistDir) : undefined);
    if (!db) throw new Error("Task execution requires canonical authority");
    const store = AppTaskResourceStore.activeFromDb(db, opts.taskBinding.appId);
    if (!store) throw new Error("Task execution requires canonical authority");
    assertCurrentTaskActor({ resourceStore: store }, opts.taskBinding, "workflow start");
  };
  const hasStructuredAgentCatalog = Boolean(
    opts.agentDefinitions || opts.taskContext?.agentDefinitions || typeof manager.agentNames === "function",
  );
  const maxDepth = opts.maxDepth ?? 3;
  const resolveTrace = (): EventTrace | undefined => opts.callerTrace?.() ?? opts.trace;
  const emitRuntimeEvent = (event: { type: string; [key: string]: unknown; [EVENT_RECORD_ONLY]?: boolean }): void => {
    const trace = resolveTrace();
    const recordOnly = event[EVENT_RECORD_ONLY];
    const emitted = event.trace || !trace ? event : { ...event, trace };
    if (recordOnly !== undefined) {
      Object.defineProperty(emitted, EVENT_RECORD_ONLY, { value: recordOnly, configurable: true });
    }
    opts.runtimeCtx?.emit(emitted);
  };

  const resolveCallerSessionId = (): string | undefined => {
    const v = opts.callerSessionId ?? opts.parentSessionId;
    return typeof v === "function" ? v() : v;
  };
  const getCallerSessionMeta = (sessionId?: string) => {
    if (!sessionId) return {};
    const managerWithState = manager as unknown as {
      activeSessions?: Map<string, { workflowRunId?: string; projectId?: string }>;
      registry?: { getSession(sessionId: string): { workflowRunId?: string; projectId?: string } | null };
    };
    const active = managerWithState.activeSessions?.get(sessionId);
    const persisted = managerWithState.registry?.getSession(sessionId);
    return {
      workflowRunId: active?.workflowRunId ?? persisted?.workflowRunId,
      projectId: active?.projectId ?? persisted?.projectId,
    };
  };

  const emitWorkflowBlockedOwnerWake = (data: {
    workflowRunId: string;
    workflow: string;
    task: string;
    reason: string;
    context?: unknown;
    projectId?: string;
    parentSessionId?: string;
    parentWorkflowRunId?: string;
  }): void => {
    const workflowOwner = normalizeEventOwner(opts.agentName);
    emitRuntimeEvent({
      type: "workflow.owner.requested",
      source: "workflow-tool",
      owner: workflowOwner,
      data: {
        reason: "workflow-blocked",
        projectId: data.projectId,
        workflowRunId: data.workflowRunId,
        workflow: data.workflow,
        workflowOwner,
        parentSessionId: data.parentSessionId,
        parentWorkflowRunId: data.parentWorkflowRunId,
        task: truncate(data.task, 500),
        blockerReason: data.reason,
        context: data.context,
      },
    } as any);
  };

  type HostedCatalogState = PreparedCatalog<SubagentDefinition> & {
    prompts: Map<string, { owner: string; definition: SubagentDefinition }>;
    proceduresByOwner: Map<string, WorkflowCatalog["workflows"]>;
    diagnostics: string[];
    pendingImports: number;
    callableCatalog?: CallableCatalog;
    canonicalRoutes?: ReadonlyMap<string, { kind: "prompt"; owner: string } | { kind: "code"; owner: string; name: string }>;
  };

  function capturePromptCatalog(
    catalog: WorkflowCatalog,
    parentSessionId: string | undefined,
  ): HostedCatalogState {
    const definitions = opts.agentDefinitions ?? opts.taskContext?.agentDefinitions ?? new Map(
      (manager.agentNames?.() ?? []).flatMap((name) => {
        const definition = manager.getAgentDefinition(name, parentSessionId);
        return definition ? [[name, definition] as const] : [];
      }),
    );
    const prompts = new Map<string, { owner: string; definition: SubagentDefinition }>();
    const requestedOwner = opts.agentName ?? "workflow";
    const capturedOwner = opts.canonicalOwner;
    const currentProjectId = opts.projectId ?? opts.taskBinding?.appId;
    const matchingOwners = [...definitions].filter(([, definition]) => definition.name === requestedOwner);
    const scopedOwners = currentProjectId === undefined
      ? matchingOwners
      : matchingOwners.filter(([, definition]) => definition.appLocal && definition.projectId === currentProjectId);
    const ownerCandidates = scopedOwners.length > 0 ? scopedOwners : matchingOwners;
    if (capturedOwner && !definitions.has(capturedOwner)) {
      throw new Error(`Captured root workflow owner "${capturedOwner}" is not available`);
    }
    if (!capturedOwner && ownerCandidates.length > 1) {
      throw new Error(
        `Ambiguous root workflow owner "${requestedOwner}": ${ownerCandidates.map(([owner]) => owner).join(", ")}`,
      );
    }
    const rootProcedureOwner = capturedOwner
      ?? (definitions.has(requestedOwner) ? requestedOwner : ownerCandidates[0]?.[0] ?? requestedOwner);
    const proceduresByOwner = new Map<string, WorkflowCatalog["workflows"]>();
    const diagnostics = [...catalog.diagnostics];
    for (const [owner, prepared] of opts.workflowCatalogsByOwner ?? []) {
      proceduresByOwner.set(owner, prepared.workflows);
      for (const diagnostic of prepared.diagnostics) {
        if (!diagnostics.includes(diagnostic)) diagnostics.push(diagnostic);
      }
    }
    proceduresByOwner.set(rootProcedureOwner, catalog.workflows);
    for (const [name, definition] of definitions) {
      prompts.set(name, { owner: name, definition });
    }
    return { prompts, proceduresByOwner, diagnostics, pendingImports: 0 };
  }

  let activeSteeringQueue: string[] | null = null;
  let activeWorkflowName: string | null = null;

  async function executeWorkflow(
    catalog: HostedCatalogState | WorkflowCatalog,
    workflow: WorkflowExecutableModule,
    task: string,
    depth: number,
    parentSessionId: string | undefined,
    parentWorkflowRunId: string | undefined,
    completedSteps: CompletedStep[],
    steeringQueue: string[],
    authoredInput?: { value: unknown },
    runId = generateRunId(),
    parentSignal = opts.signal,
    inheritedAllowance?: WorkflowExecutionAllowance,
    inheritedTools?: "full" | "readonly",
    callerOwner = opts.agentName ?? "workflow",
  ): Promise<{ result: WorkflowResult; runId: string; steps: CompletedStep[] }> {
    if (depth > 1) assertWorkflowExecution();
    const targetCatalog: HostedCatalogState =
      "workflows" in catalog ? capturePromptCatalog(catalog, parentSessionId) : catalog;
    const ensureOwnerProcedures = async (owner: string, signal: AbortSignal): Promise<void> => {
      if (targetCatalog.proceduresByOwner.has(owner)) return;
      const definition = targetCatalog.prompts.get(owner)?.definition;
      if (!definition?.agentDir) return;
      const procedures = await buildWorkflowCatalog(join(definition.agentDir, "workflows"), signal, {
        onImportStart: () => {
          targetCatalog.pendingImports += 1;
        },
        onImportSettled: () => {
          targetCatalog.pendingImports -= 1;
        },
      });
      signal.throwIfAborted();
      targetCatalog.proceduresByOwner.set(owner, procedures.workflows);
      for (const diag of procedures.diagnostics) {
        if (!targetCatalog.diagnostics.includes(diag)) targetCatalog.diagnostics.push(diag);
      }
    };
    const prepareCallableCatalog = async (signal: AbortSignal): Promise<void> => {
      if (targetCatalog.callableCatalog) return;
      for (const owner of targetCatalog.prompts.keys()) await ensureOwnerProcedures(owner, signal);

      const routes = new Map<string, { kind: "prompt"; owner: string } | { kind: "code"; owner: string; name: string }>();
      const definitions: CallableDefinition[] = [];
      for (const [owner, prompt] of targetCatalog.prompts) {
        const appId = prompt.definition.appLocal ? prompt.definition.projectId : undefined;
        const canonical = canonicalCallableName(appId, prompt.definition.name);
        routes.set(canonical, { kind: "prompt", owner });
        definitions.push({
          appId,
          declaredName: prompt.definition.name,
          description: prompt.definition.description,
          ...(prompt.outputSchema ? { outputSchema: prompt.outputSchema } : {}),
          async invoke() {
            throw new Error("Hosted callable definitions are dispatched by the workflow kernel");
          },
        });
      }
      for (const [owner, workflows] of targetCatalog.proceduresByOwner) {
        const ownerDefinition = targetCatalog.prompts.get(owner)?.definition;
        const appId = ownerDefinition?.appLocal
          ? ownerDefinition.projectId
          : (owner === callerOwner ? effectiveProjectId : undefined);
        for (const workflow of workflows.values()) {
          const canonical = canonicalCallableName(appId, workflow.name);
          routes.set(canonical, { kind: "code", owner, name: workflow.name });
          definitions.push({
            appId,
            declaredName: workflow.name,
            description: workflow.description,
            ...(workflow.inputSchema ? { inputSchema: workflow.inputSchema } : {}),
            ...(workflow.outputSchema ? { outputSchema: workflow.outputSchema } : {}),
            async invoke() {
              throw new Error("Hosted callable definitions are dispatched by the workflow kernel");
            },
          });
        }
      }
      targetCatalog.callableCatalog = new CallableCatalog(definitions);
      targetCatalog.canonicalRoutes = routes;
    };
    const localSteps: CompletedStep[] = [];
    const callerMeta = getCallerSessionMeta(parentSessionId);
    const effectiveProjectId = opts.projectId ?? callerMeta.projectId ?? opts.taskBinding?.appId;

    const run: WorkflowRun = {
      runId,
      workflow: workflow.name,
      task,
      parentSessionId: parentSessionId ?? "unknown",
      parentWorkflowRunId,
      projectId: effectiveProjectId,
      depth,
      startedAt: Date.now(),
      status: "running",
      steps: [],
      sourcePath: workflow.sourcePath,
      sourceScope: workflow.sourceScope,
      entryContentHash: workflow.entryContentHash,
      taskBinding: opts.taskBinding,
    };

    try {
      if (persistDir) {
        insertWorkflowRun(persistDir, {
          runId,
          workflow: workflow.name,
          task,
          parentSessionId: parentSessionId ?? null,
          parentWorkflowRunId: parentWorkflowRunId ?? null,
          projectId: effectiveProjectId ?? null,
          depth,
          status: "running",
          startedAt: run.startedAt,
          endedAt: null,
          result_summary: null,
          result_reason: null,
          sourcePath: workflow.sourcePath,
          sourceScope: workflow.sourceScope,
          entryContentHash: workflow.entryContentHash,
          taskBinding: opts.taskBinding ?? null,
        });
      }
      emitRuntimeEvent({
        type: "workflow.started",
        source: `workflow:${workflow.name}`,
        owner: normalizeEventOwner(opts.agentName),
        data: {
          workflowRunId: runId,
          workflow: workflow.name,
          task: truncate(task, 2_000),
          projectId: effectiveProjectId,
          parentSessionId,
          parentWorkflowRunId,
          sourcePath: workflow.sourcePath,
          sourceScope: workflow.sourceScope,
          entryContentHash: workflow.entryContentHash,
          taskBinding: opts.taskBinding,
        },
      });

      const declaredTimeoutMs = executionTimeout(workflow.executionTimeoutMs ?? opts.executionTimeoutMs);
      const executionTimeoutLimitMs =
        opts.executionTimeoutLimitMs !== undefined ? executionTimeout(opts.executionTimeoutLimitMs) : undefined;

      const cancelActiveStepSessions = (): void => {
        if (typeof manager.status !== "function") return;
        for (const session of manager.status()) {
          if (session.workflowRunId !== runId) continue;
          try {
            manager.cancel(session.sessionId);
          } catch {
            // The session may have completed between status() and cancel().
          }
        }
      };

      const needsWorktree =
        workflow.workspace === "task" ||
        (typeof workflow.workspace === "object" && workflow.workspace.kind === "task");
      if (
        needsWorktree &&
        (!opts.taskBinding ||
          !opts.executionPaths ||
          opts.executionPaths.workspaceDir === opts.executionPaths.projectDir)
      ) {
        throw new Error(
          `Workflow "${workflow.name}" requires an allocated Task worktree; use an ordinary Git-backed Task for this work`,
        );
      }

      const prepareHostWorkflowEnvironment = (): WorkflowExecutionEnvironment => {
        const metricService = () =>
          opts.runtimeCtx?.metrics ?? createUnavailableMetricService("No runtimeCtx - metrics unavailable");
        const appRead =
          opts.read ??
          createRuntimeAppRead({
            getDb:
              opts.runtimeCtx?.getDb ??
              (() => {
                throw new Error("No runtimeCtx - read unavailable");
              }),
            readMetric: async (id) => readMetricView(metricService(), id),
            ...(persistDir ? { persistDir } : {}),
          });
        if (opts.taskContext && persistDir) {
          opts.taskContext.detailRoot ??= taskDetailRoot(persistDir, opts.taskContext.taskBinding);
        }
        return {
          read: appRead,
          metrics: {
            define: (definition) => metricService().define(definition),
            defineMany: (definitions) => metricService().defineMany(definitions),
            record: (id, value, options) =>
              metricService().record(id, value, typeof options === "string" ? { note: options } : options),
            evaluate: (id) => metricService().evaluate(id),
          },
          ...(opts.executionPaths
            ? {
                workspace: {
                  appRoot: opts.executionPaths.appDir,
                  projectRoot: opts.executionPaths.projectDir,
                  root: opts.executionPaths.workspaceDir,
                  output: opts.executionPaths.workspaceDir,
                },
              }
            : {}),
          ...(opts.reconciliation ? { reconciliation: opts.reconciliation } : {}),
          ...(opts.taskBinding && opts.reviseTask ? { reviseTask: opts.reviseTask } : {}),
          ...(opts.taskBinding && opts.closeTask ? { closeTask: opts.closeTask } : {}),
          ...(opts.taskBinding && opts.taskContext?.readCommunication
            ? { readCommunication: opts.taskContext.readCommunication }
            : {}),
          ...(opts.taskBinding && opts.taskContext?.applyTaskChanges
            ? { applyTaskChanges: opts.taskContext.applyTaskChanges }
            : {}),
          events: {
            read: async (type, localKey) => {
              if (!opts.taskEmitter) throw new Error("Only a Task-owned workflow can read its published events");
              return opts.taskEmitter.read(type, localKey);
            },
            emit: async (event: { type: string; data: unknown; localKey?: string }) => {
              if (opts.taskEmitter) {
                if (!event.localKey?.trim()) {
                  throw new Error("Task-owned workflow events require a stable localKey");
                }
                const { localKey, ...published } = event;
                opts.taskEmitter.publish(localKey, published as { type: string; data: Record<string, unknown> });
              } else {
                emitRuntimeEvent(event);
              }
              onEvent?.(event as WorkflowEvent);
            },
            onEvent: (listener) => {
              if (!opts.taskEmitter) throw new Error("Only a Task-owned workflow can observe Task events");
              return opts.taskContext
                ? opts.taskContext.observeEvents((event) => listener(event))
                : opts.taskEmitter.onEvent((event) => listener(canonicalAppEvent(event)));
            },
          },
        };
      };
      const hostEnv = prepareHostWorkflowEnvironment();
      const recordDiagnostic = createWorkflowDiagnostics(persistDir, runId);

      const agentSessionHistories = new Map<string, import("@earendil-works/pi-agent-core").AgentMessage[]>();

      const executePromptStep = async (
        agentName: string,
        agentTask: string,
        stepOpts: (AgentCallOptions & { schema?: TSchema }) | undefined,
        stepControl: WorkflowKernelStepControl,
        sessionKey?: string,
      ): Promise<WorkflowStepInvocationResult> => {
        const steering = steeringQueue.shift();
        if (steering) throw new WorkflowInterrupted(steering, completedSteps, runId);

        const definition = targetCatalog.prompts.get(agentName)?.definition;
        if (hasStructuredAgentCatalog && !definition) {
          throw new Error(`Prompt target "${agentName}" not found in the captured catalog`);
        }
        const stepStartedAt = Date.now();
        onEvent?.({ type: "workflow.step_started", step: agentName });
        emitRuntimeEvent({
          [EVENT_RECORD_ONLY]: true,
          type: "workflow.step_started",
          source: `workflow:${workflow.name}`,
          owner: normalizeEventOwner(opts.agentName),
          data: {
            workflowRunId: runId,
            workflow: workflow.name,
            projectId: effectiveProjectId,
            step: agentName,
            stepIndex: stepControl.stepIndex,
          },
        });
        const priorMessages = sessionKey ? agentSessionHistories.get(sessionKey) : undefined;
        const stepCallOptions = {
          parentSessionId,
          source: opts.sessionSource ?? `workflow:${workflow.name}`,
          workflowRunId: runId,
          projectId: effectiveProjectId,
          taskBinding: opts.taskBinding,
          taskContext: opts.taskContext,
          agentDefinitions: opts.taskContext?.agentDefinitions ?? opts.agentDefinitions,
          callableCatalogScope: opts.taskContext ?? opts.callableCatalogScope,
          recoveryOwner: opts.recoveryOwner,
          stepLabel: agentName,
          timeout: stepControl.timeoutMs,
          signal: stepControl.signal,
          deadlineAt: stepControl.deadlineAt,
          trace: resolveTrace(),
          requireFinish: true,
          outputSchema: stepOpts?.schema,
          toolPolicy: stepControl.tools,
          executionRoot: opts.executionPaths?.workspaceDir,
          ...(priorMessages ? { initialMessages: priorMessages } : {}),
        };
        let taskResult = definition
          ? await manager.callAgentDefinition(definition, agentTask, stepCallOptions)
          : await manager.callAgent(agentName, agentTask, stepCallOptions);
        if (sessionKey && Array.isArray(taskResult.messages)) {
          agentSessionHistories.set(sessionKey, [...taskResult.messages]);
        }
        let sid = taskResult.sessionId;
        stepControl.signal.throwIfAborted();

        taskResult = enforceStructuredWorkflowResult(taskResult, !!stepOpts?.schema);
        sid = taskResult.sessionId || sid;

        const step: CompletedStep = { step: agentName, sessionId: sid, result: taskResult };
        localSteps.push(step);
        completedSteps.push(step);
        pruneCompletedSteps(completedSteps);

        const stepEndedAt = Date.now();
        run.steps.push({
          sessionId: sid,
          agent: agentName,
          task: agentTask,
          status: taskResult.status,
          startedAt: taskResult.messages[0]?.timestamp ?? stepStartedAt,
          endedAt: stepEndedAt,
          lastAssistantText: taskResult.lastAssistantText,
        });

        onEvent?.({ type: "workflow.step_completed", step: agentName, sessionId: sid, result: taskResult });
        emitRuntimeEvent({
          [EVENT_RECORD_ONLY]: true,
          type: "workflow.step_completed",
          source: `workflow:${workflow.name}`,
          owner: normalizeEventOwner(opts.agentName),
          data: {
            workflowRunId: runId,
            workflow: workflow.name,
            projectId: effectiveProjectId,
            step: agentName,
            stepIndex: stepControl.stepIndex,
            sessionId: sid,
            status: taskResult.status,
            durationMs: Math.max(0, stepEndedAt - stepStartedAt),
          },
        });

        const steeringAfter = steeringQueue.shift();
        if (steeringAfter) throw new WorkflowInterrupted(steeringAfter, completedSteps, runId);

        const mapped = agentExecutionResult(taskResult);
        return {
          ...mapped,
          sessionId: sid,
        };
      };

      const executeCodeStep = async (
        resolved: Extract<ReturnType<typeof resolveCallable>, { kind: "code" }>,
        workflowInput: unknown,
        stepOpts: (CallOptions<TSchema> & { schema?: TSchema }) | undefined,
        stepControl: WorkflowKernelStepControl,
      ): Promise<WorkflowStepInvocationResult> => {
        const steering = steeringQueue.shift();
        if (steering) throw new WorkflowInterrupted(steering, completedSteps, runId);
        if (depth + 1 > maxDepth) {
          throw new Error(`Maximum workflow nesting depth (${maxDepth}) exceeded`);
        }
        const subWorkflow = resolved.module;
        const nestedTask =
          typeof workflowInput === "string" ? workflowInput : JSON.stringify(workflowInput ?? null);
        onEvent?.({ type: "workflow.started", workflow: subWorkflow.name, task: nestedTask });
        let sub: { runId: string; result: WorkflowResult };
        try {
          sub = await executeWorkflow(
            targetCatalog,
            subWorkflow,
            nestedTask,
            depth + 1,
            parentSessionId,
            runId,
            completedSteps,
            steeringQueue,
            { value: workflowInput },
            undefined,
            stepControl.signal,
            stepControl.allowance,
            stepControl.tools,
            resolved.owner,
          );
        } catch (error) {
          if (
            error instanceof WorkflowInterrupted ||
            error instanceof ExecutionDeferredError ||
            error instanceof WorkflowAllowanceExhaustedError ||
            error instanceof WorkflowUnconfirmedCleanupError ||
            stepControl.signal.aborted
          ) {
            throw error;
          }
          const childId = error && typeof error === "object" && typeof (error as { executionId?: unknown }).executionId === "string"
            ? (error as { executionId: string }).executionId
            : undefined;
          if (!childId) throw error;
          return {
            id: childId,
            kind: "workflow",
            status: "error",
            summary: error instanceof Error ? error.message : String(error),
          };
        }
        stepControl.signal.throwIfAborted();
        if (sub.result.type === "done") {
          onEvent?.({ type: "workflow.completed", summary: sub.result.summary });
        } else if (sub.result.type === "blocked") {
          onEvent?.({ type: "workflow.blocked", reason: sub.result.reason });
        }
        return {
          id: sub.runId,
          kind: "workflow",
          status: sub.result.type,
          summary: sub.result.type === "done" ? sub.result.summary : sub.result.reason,
          ...(sub.result.output !== undefined ? { output: sub.result.output } : {}),
          ...(sub.result.facts !== undefined ? { facts: sub.result.facts } : {}),
        };
      };

      let listedTargets: readonly CallableDescriptor[] = Object.freeze([]);

      const bindings: WorkflowKernelBindings = {
        executionId: runId,
        startedAt: run.startedAt,
        input: authoredInput ? authoredInput.value : task,
        taskOwned: Boolean(opts.taskBinding),
        tools: inheritedTools,
        signal: parentSignal,
        timeoutMs: declaredTimeoutMs,
        timeoutLimitMs: executionTimeoutLimitMs,
        allowance: inheritedAllowance,
        ...(opts.attemptNumber !== undefined ? { attemptNumber: opts.attemptNumber } : {}),
        ...(hostEnv as Pick<
          WorkflowKernelBindings,
          "read" | "metrics" | "workspace" | "reconciliation" | "reviseTask" | "closeTask" | "readCommunication" | "applyTaskChanges" | "events"
        >),
        onProgress: (status) => {
          if (run.status !== "running") return;
          emitRuntimeEvent({
            [EVENT_RECORD_ONLY]: true,
            type: "project.task.executor.progress",
            source: `workflow:${workflow.name}`,
            owner: normalizeEventOwner(opts.agentName),
            data: {
              workflowRunId: runId,
              workflow: workflow.name,
              projectId: effectiveProjectId,
              status,
              ...(opts.taskBinding ? { appId: opts.taskBinding.appId, taskId: opts.taskBinding.taskId } : {}),
            },
          });
        },
        invokeAgentSession: async (sessionKey, target, envelope, callOptions, stepControl) => {
          const steering = steeringQueue.shift();
          if (steering) throw new WorkflowInterrupted(steering, completedSteps, runId);
          const routedTarget = targetCatalog.canonicalRoutes?.get(target);
          const resolved = routedTarget
            ? routedTarget.kind === "prompt"
              ? resolveCallable(callerOwner, routedTarget.owner, targetCatalog)
              : null
            : resolveCallable(callerOwner, target, targetCatalog);
          if (!resolved || resolved.kind !== "prompt") {
            throw new Error(`ctx.agent("${target}") requires a prompt agent target`);
          }
          return executePromptStep(resolved.name, formatExecutionInput(envelope), callOptions, stepControl, sessionKey);
        },
        closeAgentSessions: async () => {
          agentSessionHistories.clear();
        },
        onLog: ({ level, message }) => {
          if (run.status !== "running") return;
          const safe = recordDiagnostic(level, message);
          try {
            opts.runtimeCtx?.log(`[workflow:${runId}] [${level}] ${safe}`);
          } catch {
            // Optional presentation sink cannot fail the workflow.
          }
        },
        onCancelActive: cancelActiveStepSessions,
        // An unfinished native import is not confirmed cleanup. Its eventual
        // continuation checks the scope signal before publishing or executing.
        confirmCleanup: () => targetCatalog.pendingImports === 0,
        listTargets: () => listedTargets,
        resolveTarget: async (target, input) => {
          const routedTarget = targetCatalog.canonicalRoutes?.get(target);
          if (!routedTarget) throw new Error(`Callable target not found: ${target}`);
          const envelope = input as ExecutionInput;
          if (!envelope || typeof envelope !== "object" || typeof envelope.prompt !== "string" || !envelope.prompt.trim()) {
            throw new Error(`Callable "${target}" requires a nonblank { prompt, data? } input envelope`);
          }
          const resolved = routedTarget.kind === "prompt"
            ? resolveCallable(callerOwner, routedTarget.owner, targetCatalog)
            : {
                kind: "code" as const,
                name: routedTarget.name,
                owner: routedTarget.owner,
                module: targetCatalog.proceduresByOwner.get(routedTarget.owner)!.get(routedTarget.name)!,
                readonly: Boolean(targetCatalog.proceduresByOwner.get(routedTarget.owner)!.get(routedTarget.name)!.readonly),
              };
          if (resolved.kind === "code") {
            return {
              kind: "workflow" as const,
              invoke: async (callOptions, stepControl) => {
                const steering = steeringQueue.shift();
                if (steering) throw new WorkflowInterrupted(steering, completedSteps, runId);
                return executeCodeStep(resolved, envelope, callOptions, stepControl);
              },
            };
          }
          return {
            kind: "agent" as const,
            invoke: async (callOptions, stepControl) => {
              const steering = steeringQueue.shift();
              if (steering) throw new WorkflowInterrupted(steering, completedSteps, runId);
              return executePromptStep(resolved.name, formatExecutionInput(envelope), callOptions, stepControl);
            },
          };
        },
      };
      const outcome = await runWorkflowInvocation({
        ...workflow,
        async execute(ctx) {
          ctx.signal.throwIfAborted();
          await prepareCallableCatalog(ctx.signal);
          listedTargets = targetCatalog.callableCatalog!.list();
          ctx.signal.throwIfAborted();
          return workflow.execute(ctx);
        },
      }, bindings);

      if (!outcome.ok) {
        if (
          outcome.started &&
          outcome.error &&
          typeof outcome.error === "object" &&
          !(outcome.error instanceof ExecutionDeferredError)
        ) {
          (outcome.error as { executionId?: string }).executionId ??= runId;
        }
        throw outcome.error;
      }
      const result = outcome.result;
      if (depth === 1 && outcome.report.answeredHumanConditions?.length) {
        opts.onAnsweredHumanConditions?.(outcome.report.answeredHumanConditions);
      }
      if (depth === 1 && outcome.report.doneSettlement) {
        opts.onDoneSettlement?.(outcome.report.doneSettlement);
      }

      // Finalize the workflow run
      run.endedAt = Date.now();
      run.status = result.type;
      run.result = result.type === "done" ? { summary: result.summary } : { reason: result.reason };
      if (persistDir)
        updateWorkflowRun(persistDir, runId, {
          status: run.status,
          endedAt: run.endedAt,
          result_summary: run.result.summary,
          result_reason: run.result.reason,
          result_payload: retainWorkflowResultPayload(result),
        });
      if (result.type === "blocked" && depth === 1 && !opts.taskBinding) {
        emitWorkflowBlockedOwnerWake({
          workflowRunId: runId,
          workflow: workflow.name,
          task,
          reason: result.reason,
          context: result.context,
          projectId: effectiveProjectId,
          parentSessionId,
          parentWorkflowRunId,
        });
      }
      emitRuntimeEvent({
        type: result.type === "done" ? "workflow.completed" : result.type === "blocked" ? "workflow.blocked" : result.type === "interrupted" ? "workflow.interrupted" : "workflow.failed",
        source: `workflow:${workflow.name}`,
        owner: normalizeEventOwner(opts.agentName),
        data: {
          workflowRunId: runId,
          workflow: workflow.name,
          projectId: effectiveProjectId,
          durationMs: run.endedAt - run.startedAt,
          ...(result.type === "done"
            ? { summary: result.summary }
            : { reason: result.reason, context: result.context }),
        },
      });

      return { result, runId, steps: localSteps };
    } catch (err) {
      run.endedAt = Date.now();
      if (err instanceof WorkflowInterrupted) {
        run.status = "interrupted";
        run.result = { reason: err.steeringMessage };
      } else if (err instanceof ExecutionDeferredError) {
        run.status = "blocked";
        run.result = { reason: err.message };
        err.callerExecution = { kind: "workflow", id: runId };
      } else {
        run.status = "error";
        run.result = { reason: err instanceof Error ? err.message : String(err) };
      }
      if (persistDir)
        updateWorkflowRun(persistDir, runId, {
          status: run.status,
          endedAt: run.endedAt,
          result_reason: run.result?.reason,
          ...(err instanceof ExecutionDeferredError
            ? { result_payload: retainWorkflowResultPayload({ facts: deferredExecutionResult(err) }) } : {}),
        });
      try {
        emitRuntimeEvent({
          type:
            err instanceof WorkflowInterrupted
              ? "workflow.interrupted"
              : err instanceof ExecutionDeferredError
                ? "workflow.blocked"
                : "workflow.failed",
          source: `workflow:${workflow.name}`,
          owner: normalizeEventOwner(opts.agentName),
          data: {
            workflowRunId: runId,
            workflow: workflow.name,
            projectId: effectiveProjectId,
            durationMs: run.endedAt - run.startedAt,
            reason:
              err instanceof WorkflowInterrupted ? err.steeringMessage : err instanceof Error ? err.message : String(err),
          },
        });
      } catch {
        // Failure notification must not replace the retained execution/setup error.
      }
      throw err;
    }
  }

  /** Sets up steering,
   *  executes the workflow, and maps the result to a tool response. */
  async function runWorkflow(
    catalog: WorkflowCatalog,
    workflow: WorkflowModule,
    task: string,
    depth: number,
    parentSessionId: string | undefined,
    parentWorkflowRunId: string | undefined,
    authoredInput?: { value: unknown },
    allowance?: WorkflowExecutionAllowance,
  ): Promise<WorkflowToolResult> {
    const completedSteps: CompletedStep[] = [];
    const steeringQueue: string[] = [];
    const runId = generateRunId();

    try {
      assertWorkflowExecution();
      activeSteeringQueue = steeringQueue;
      activeWorkflowName = workflow.name;
      onEvent?.({ type: "workflow.started", workflow: workflow.name, task });
      const { result } = await executeWorkflow(
        catalog,
        workflow,
        task,
        depth,
        parentSessionId,
        parentWorkflowRunId,
        completedSteps,
        steeringQueue,
        authoredInput ?? (opts.workflowInput !== undefined ? { value: opts.workflowInput } : undefined),
        runId,
        opts.signal,
        allowance,
      );

      activeSteeringQueue = null;
      activeWorkflowName = null;

      const stepSummaries = buildStepSummaries(completedSteps);

      if (result.type === "done") {
        onEvent?.({ type: "workflow.completed", summary: result.summary });
        const toolResult: WorkflowToolResult = {
          type: "done",
          workflow: workflow.name,
          workflowRunId: runId,
          summary: result.summary,
          output: result.output,
          facts: result.facts,
          steps: stepSummaries,
        };
        return toolResult;
      }

      // Authored terminal errors have completed normal finalization. Thrown
      // setup/persistence failures below require a verified retained reference.
      if (result.type === "error") return {
        type: "error", workflow: workflow.name, workflowRunId: runId,
        error: result.reason, output: result.output, facts: result.facts,
      };
      if (result.type === "interrupted") return {
        type: "interrupted", workflow: workflow.name, workflowRunId: runId,
        steeringMessage: result.reason, completedSteps, output: result.output, facts: result.facts,
      };
      onEvent?.({ type: "workflow.blocked", reason: result.reason });
      const toolResult: WorkflowToolResult = {
        type: "blocked",
        workflow: workflow.name,
        workflowRunId: runId,
        reason: result.reason,
        context: result.context,
        output: result.output,
        facts: result.facts,
        steps: stepSummaries,
      };
      return toolResult;
    } catch (err) {
      activeSteeringQueue = null;
      activeWorkflowName = null;
      if (err instanceof ExecutionDeferredError) throw err;

      if (err instanceof WorkflowInterrupted) {
        const toolResult: WorkflowToolResult = {
          type: "interrupted",
          workflow: workflow.name,
          workflowRunId: err.workflowRunId,
          completedSteps: err.completedSteps,
          steeringMessage: err.steeringMessage,
        };
        return toolResult;
      }

      const msg = err instanceof Error ? err.message : String(err);
      let factsRunId: string | undefined;
      if (persistDir) {
        try {
          const saved = getWorkflowRun(persistDir, runId);
          if (saved?.status === "error" && saved.endedAt != null && !saved.artifact_error) factsRunId = runId;
        } catch {
          // Missing or unreadable persistence is not a usable facts link.
        }
      }
      const toolResult: WorkflowToolResult = {
        type: "error", workflow: workflow.name, error: msg,
        ...(factsRunId ? { workflowRunId: factsRunId } : {}),
      };
      return toolResult;
    }
  }

  async function runTyped(
    name: string,
    task: string,
    existingCatalog?: WorkflowCatalog,
    authoredInput?: { value: unknown },
  ): Promise<WorkflowToolResult> {
    let catalog = existingCatalog;
    let allowance = rootAllowance;
    if (!catalog) {
      try {
        ({ catalog, allowance } = await prepareRootWorkflow({ ...opts, workflowDir }, name));
      } catch (error) {
        if (error instanceof ExecutionDeferredError) throw error;
        return { type: "error", workflow: name, error: error instanceof Error ? error.message : String(error) };
      }
    }
    // Preparation can exhaust the deadline without the timer getting a turn.
    // Check here too, before announcing or persisting a workflow start.
    if (allowance && (opts.signal?.aborted || Date.now() >= allowance.deadlineAt)) {
      const error = opts.signal?.reason ?? allowance.deadlineReason ?? "Caller execution deadline expired";
      return { type: "error", workflow: name, error: error instanceof Error ? error.message : String(error) };
    }
    const { workflow, error } = findWorkflow(catalog, name);
    if (!workflow) {
      const message = error ?? `Workflow "${name}" not found`;
      return {
        type: "error",
        workflow: name,
        error: message,
        reason: message,
        category: "workflow_definition_missing",
      };
    }
    const callerSessionId = resolveCallerSessionId();
    const callerMeta = getCallerSessionMeta(callerSessionId);
    return runWorkflow(catalog, workflow, task, 1, callerSessionId, callerMeta.workflowRunId, authoredInput, allowance);
  }

  const runner: WorkflowRunner = {
    run: runTyped,

    steer(message: string): boolean {
      if (!activeSteeringQueue) return false;
      activeSteeringQueue.push(message);
      return true;
    },

    get isRunning(): boolean {
      return activeSteeringQueue !== null;
    },

    get activeWorkflow(): string | null {
      return activeWorkflowName;
    },
  };

  return runner;
}
