import { isDeepStrictEqual } from "node:util";
import { AppTaskResourceStore } from "../app/core/state/app-task-resource-store.js";
import { assertCurrentTaskActor } from "../app/core/tasks/task-actor.js";
import { StringEnum } from "@earendil-works/pi-ai";
import { ExecutionDeferredError } from "@may-agent/sdk";
import {
  runWorkflowInvocation,
  type WorkflowExecutionAllowance,
  type WorkflowStepInvocationResult,
} from "../../packages/sdk/src/workflow-kernel.js";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Type, type TSchema } from "typebox";
import { getDb } from "./db/connection.js";
import { executionTimeout } from "./execution-scope.js";
import type { TaskExecutionContext } from "./task-execution-context.js";
import { prepareTaskWorkspaceContext } from "./task-workspace-context.js";

import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import type {
  AgentCallOptions,
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
import { agentExecutionResult, deferredExecutionResult, workflowExecutionResult } from "./execution-handoff.js";
import { log } from "./log.js";
import type { SubagentManager } from "./manager.js";
import { createUnavailableMetricService } from "./metrics.js";
import type { TaskBinding } from "./persistence.js";
import type { RuntimeCtx } from "./runtime-ctx.js";
import { importRuntimeModule } from "./runtime-import.js";
import type { SubagentDefinition, TaskResult } from "./types.js";
import {
  buildWorkflowCatalog,
  findWorkflow,
  type WorkflowCatalog,
} from "./workflow-catalog.js";
import { createWorkflowDiagnostics } from "./workflow-diagnostics.js";
import { validateOperationAllowance } from "./workflow-finish-recovery.js";
import { retainWorkflowResultPayload } from "./workflow-payload.js";
import type {
  CompletedStep,
  Demand,
  WorkflowEvent,
  WorkflowGuard,
  WorkflowGuardEvent,
  WorkflowModule,
  WorkflowResult,
  WorkflowStepSummary,
  WorkflowToolResult,
} from "./workflow.js";
import { WorkflowBlocked, WorkflowInterrupted } from "./workflow.js";

export { inspectWorkflowDefinition } from "./workflow-catalog.js";
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

// ── Tool schema ────────────────────────────────────────────────────────

const WorkflowToolParams: TSchema = Type.Object({
  action: StringEnum(["list", "run"] as const, {
    description:
      "'list': show available workflows with descriptions. 'run': execute a workflow by name (blocks until complete).",
  }),
  name: Type.Optional(
    Type.String({
      description:
        "Workflow name to execute (required for 'run'). Use 'list' first to see available workflows and their descriptions.",
    }),
  ),
  input: Type.Optional(
    Type.Unknown({
      description:
        "Structured workflow input. Check the workflow description. Required for run unless using the legacy task string.",
    }),
  ),
  task: Type.Optional(
    Type.String({
      description:
        "Legacy string input (prefer input for new callers). Format depends on the workflow — check the workflow description from 'list' for expected format.",
    }),
  ),

});
interface WorkflowInput {
  action: "list" | "run";
  name?: string;
  task?: string;
  input?: unknown;
}

// ── Helpers ────────────────────────────────────────────────────────────

function textResult(text: string): AgentToolResult<string> {
  return {
    content: [{ type: "text", text }],
    details: text,
  };
}

/** Model tools expose a denied helper start as data; typed callers retain the exception. */
async function workflowModelExecution(execute: () => Promise<WorkflowToolResult>): Promise<AgentToolResult<string>> {
  try {
    const result = await execute();
    return textResult(JSON.stringify({ ...result, ...workflowExecutionResult(result) }, null, 2));
  } catch (error) {
    if (error instanceof ExecutionDeferredError) return textResult(JSON.stringify(deferredExecutionResult(error)));
    throw error;
  }
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

function enforceStructuredWorkflowResult(result: TaskResult, expectsPayload: boolean): TaskResult {
  if (result.status !== "done") return result;
  if (!result.finishResult) {
    return {
      ...result,
      status: "error",
      error: "Workflow agent step completed without the required finish() result",
    };
  }
  if (expectsPayload && result.structuredResult === undefined) {
    return {
      ...result,
      status: "error",
      error: "Workflow agent step completed without the required schema-backed finish().result payload",
    };
  }
  return result;
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
 * This preserves step count/metadata for guards while freeing memory.
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

// ── Guard Discovery ────────────────────────────────────────────────────

/** Load all guard modules from given directories. */
export async function loadGuards(...dirs: (string | undefined)[]): Promise<WorkflowGuard[]> {
  const guards: WorkflowGuard[] = [];
  const disabledNames = new Set(
    (process.env.DISABLED_GUARDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  for (const dir of dirs) {
    if (!dir || !existsSync(dir)) continue;
    let files: string[];
    try {
      files = readdirSync(dir)
        .filter(
          (f) =>
            f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.startsWith("REGISTRY") && !f.endsWith(".disabled.ts"),
        )
        .sort()
        .map((f) => join(dir, f));
    } catch {
      continue;
    }
    for (const filePath of files) {
      try {
        const mod = await importRuntimeModule<{ guard?: Partial<WorkflowGuard> }>(filePath);
        const guard = mod.guard;
        if (guard && typeof guard.handle === "function" && typeof guard.name === "string") {
          if (disabledNames.has(guard.name)) {
            log("info", `[guards] Skipping disabled guard "${guard.name}" (DISABLED_GUARDS env)`);
            continue;
          }
          guards.push(guard as WorkflowGuard);
        }
      } catch (err) {
        log(
          "error",
          `[guards] Failed to load guard from ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
  return guards;
}

/** Collect demands from all guards for a given event. */
export function emitAndCollectDemands(guards: WorkflowGuard[], event: WorkflowGuardEvent): Demand[] {
  const demands: Demand[] = [];
  for (const guard of guards) {
    // Filter: only send events the guard cares about
    if (guard.events && !guard.events.includes(event.type)) continue;
    try {
      const ds = guard.handle(event);
      for (const d of ds) {
        d.guardName = guard.name;
        demands.push(d);
      }
    } catch (err) {
      log(
        "error",
        `[guards] Guard "${guard.name}" threw on event "${event.type}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return demands;
}

type GuardSignalAction = "observed" | "warned" | "blocked";
type GuardSignalEmitter = (demand: Demand, action: GuardSignalAction, extra?: Record<string, unknown>) => void;

/** Resolve observational and blocking guard demands (observe, warn, block). */
function resolveDemands(
  demands: Demand[],
  sourceEvent: WorkflowGuardEvent,
  runId: string,
  completedSteps: CompletedStep[],
  warnings: string[],
  emitGuardSignal?: GuardSignalEmitter,
): void {
  for (const demand of demands) {
    switch (demand.type) {
      case "observe":
        log("info", `[guards] OBSERVE from "${demand.guardName}": ${demand.reason}`);
        emitGuardSignal?.(demand, "observed", {
          sourceEventType: sourceEvent.type,
          step: "step" in sourceEvent ? sourceEvent.step : undefined,
          sessionId: "sessionId" in sourceEvent ? sourceEvent.sessionId : undefined,
        });
        break;

      case "block":
        log("warn", `[guards] BLOCK from "${demand.guardName}": ${demand.reason}`);
        emitGuardSignal?.(demand, "blocked", {
          sourceEventType: sourceEvent.type,
          step: "step" in sourceEvent ? sourceEvent.step : undefined,
          sessionId: "sessionId" in sourceEvent ? sourceEvent.sessionId : undefined,
        });
        throw new WorkflowBlocked(demand.reason, completedSteps, runId);

      case "warn":
        log("warn", `[guards] WARNING from "${demand.guardName}": ${demand.reason}`);
        emitGuardSignal?.(demand, "warned", {
          sourceEventType: sourceEvent.type,
          step: "step" in sourceEvent ? sourceEvent.step : undefined,
          sessionId: "sessionId" in sourceEvent ? sourceEvent.sessionId : undefined,
        });
        warnings.push(`${demand.reason} (from: ${demand.guardName})`);
        break;
    }
  }
}

// ── WorkflowTool type ──────────────────────────────────────────────────

export interface WorkflowTool extends AgentTool {
  /** Typed internal execution path; tool.execute() only serializes this result at the model boundary. */
  run(name: string, task: string): Promise<WorkflowToolResult>;
  steer(message: string): boolean;
  readonly isRunning: boolean;
  readonly activeWorkflow: string | null;
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
  guardsDir?: string;
  sharedGuardsDir?: string;
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
 * Gets the same guards, step tracking, persistence, and scoped SDK capabilities
 * as agent-invoked workflows.
 */
export async function runWorkflowDirect(opts: RunWorkflowDirectOpts): Promise<{
  result: WorkflowResult;
  runId: string;
  verifier?: { name: string; sourcePath: string; verify: NonNullable<WorkflowModule["verify"]> };
}> {
  // Execution and its verifier must come from the same dispatch snapshot.
  const catalog = await buildWorkflowCatalog(opts.workflowDir ?? "");
  const { workflow } = findWorkflow(catalog, opts.workflowName);
  const runner = createWorkflowRunner({
    manager: opts.manager,
    agentDefinitions: opts.agentDefinitions,
    workflowDir: opts.workflowDir ?? "",
    guardsDir: opts.guardsDir,
    sharedGuardsDir: opts.sharedGuardsDir,
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
    executionTimeoutMs: opts.executionTimeoutMs,
    executionTimeoutLimitMs: opts.executionTimeoutLimitMs,
    signal: opts.signal,
  });

  const parsed = await runner.run(opts.workflowName, opts.task, catalog);
  const verifier = workflow?.verify
    ? { name: workflow.name, sourcePath: workflow.sourcePath, verify: workflow.verify }
    : undefined;

  if (parsed.type === "done") {
    return {
      result: { type: "done", summary: parsed.summary, output: parsed.output, facts: parsed.facts },
      runId: parsed.workflowRunId,
      ...(verifier ? { verifier } : {}),
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
  workflowDir: string;
  /** Agent-specific guards directory. */
  guardsDir?: string;
  /** Shared guards directory (shared/guards/). */
  sharedGuardsDir?: string;
  /** Persist directory for saving workflow run records. */
  persistDir?: string;
  /** The caller's session ID — used as parentSessionId for spawned sessions.
   *  Can be a string or a function returning a string (for lazy resolution). */
  callerSessionId?: string | (() => string);
  /** The agent that owns this workflow catalog and its execution provenance. */
  agentName?: string;
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
}

function createWorkflowRuntime(opts: WorkflowToolOptions, includeModelTool: false): WorkflowRunner;
function createWorkflowRuntime(opts: WorkflowToolOptions, includeModelTool: true): WorkflowTool;
function createWorkflowRuntime(opts: WorkflowToolOptions, includeModelTool: boolean): WorkflowRunner | WorkflowTool {
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
  const callAgent = (agentName: string, task: string, callOptions: Parameters<SubagentManager["callAgent"]>[2]) => {
    const definition = opts.agentDefinitions?.get(agentName);
    return definition
      ? manager.callAgentDefinition(definition, task, callOptions)
      : manager.callAgent(agentName, task, callOptions);
  };
  const maxDepth = opts.maxDepth ?? 3;
  const resolveTrace = (): EventTrace | undefined => opts.callerTrace?.() ?? opts.trace;
  const emitRuntimeEvent = (event: { type: string; [key: string]: unknown }): void => {
    const trace = resolveTrace();
    opts.runtimeCtx?.emit(event.trace || !trace ? event : { ...event, trace });
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

  let activeSteeringQueue: string[] | null = null;
  let activeWorkflowName: string | null = null;

  async function executeWorkflow(
    catalog: WorkflowCatalog,
    workflow: WorkflowModule,
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
  ): Promise<{ result: WorkflowResult; runId: string; steps: CompletedStep[] }> {
    if (depth > 1) assertWorkflowExecution();
    const localSteps: CompletedStep[] = [];
    const callerMeta = getCallerSessionMeta(parentSessionId);
    const effectiveProjectId = opts.projectId ?? callerMeta.projectId;

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

      const guards = await loadGuards(opts.guardsDir, opts.sharedGuardsDir);
      const guardWarnings: string[] = [];
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

      const emitGuardSignal: GuardSignalEmitter = (demand, action, extra = {}) => {
        const sourceEventType = typeof extra.sourceEventType === "string" ? extra.sourceEventType : "unknown";
        emitRuntimeEvent({
          [EVENT_RECORD_ONLY]: true,
          type: "guard.triggered",
          source: "workflow",
          owner: normalizeEventOwner(opts.agentName),
          data: {
            workflow: workflow.name,
            workflowRunId: runId,
            projectId: effectiveProjectId,
            parentSessionId,
            sessionId: typeof extra.sessionId === "string" ? extra.sessionId : undefined,
            guard: demand.guardName ?? "unknown",
            demandType: demand.type,
            action,
            reason: demand.reason,
            sourceEventType,
            step: typeof extra.step === "string" ? extra.step : undefined,
          },
        } as any);
      };

      if (guards.length > 0) {
        log("info", `[guards] Loaded ${guards.length} guard(s): ${guards.map((g) => g.name).join(", ")}`);
        emitAndCollectDemands(guards, { type: "workflow_start", workflow: workflow.name, task });
      }

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
        });
      const recordDiagnostic = createWorkflowDiagnostics(persistDir, runId);
      const taskBrief =
        opts.taskContext && persistDir
          ? prepareTaskWorkspaceContext(
              opts.taskContext,
              persistDir,
              opts.taskContext.agentDefinitions?.values() ?? [],
            )
          : undefined;

      const outcome = await runWorkflowInvocation(workflow, {
        executionId: runId,
        startedAt: run.startedAt,
        input: authoredInput ? authoredInput.value : task,
        taskOwned: Boolean(opts.taskBinding),
        signal: parentSignal,
        timeoutMs: declaredTimeoutMs,
        timeoutLimitMs: executionTimeoutLimitMs,
        allowance: inheritedAllowance,
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
                ...(taskBrief && "taskFile" in taskBrief ? { taskFile: taskBrief.taskFile } : {}),
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
        callAgent: async (
          agentName: string,
          agentTask: string,
          stepOpts: (AgentCallOptions & { schema?: TSchema }) | undefined,
          stepControl,
        ): Promise<WorkflowStepInvocationResult> => {
          validateOperationAllowance(stepOpts?.operationAllowance);
          const steering = steeringQueue.shift();
          if (steering) throw new WorkflowInterrupted(steering, completedSteps, runId);

          let effectiveTask = agentTask;
          if (guardWarnings.length > 0) {
            effectiveTask += `\n\n## Guard Warnings\n${guardWarnings.map((w) => "- " + w).join("\n")}`;
            guardWarnings.length = 0;
          }

          onEvent?.({ type: "workflow.step_started", step: agentName });
          let taskResult = await callAgent(agentName, effectiveTask, {
            parentSessionId,
            source: stepOpts?.source ?? opts.sessionSource ?? `workflow:${workflow.name}`,
            workflowRunId: runId,
            projectId: effectiveProjectId,
            taskBinding: opts.taskBinding,
            taskContext: opts.taskContext,
            recoveryOwner: opts.recoveryOwner,
            stepLabel: agentName,
            timeout: stepControl.timeoutMs,
            signal: stepControl.signal,
            deadlineAt: stepControl.deadlineAt,
            operationAllowance: stepOpts?.operationAllowance,
            trace: resolveTrace(),
            skill: stepOpts?.skill,
            requireFinish: true,
            outputSchema: stepOpts?.schema,
            toolPolicy: stepOpts?.tools,
            executionRoot: opts.executionPaths?.workspaceDir,
          });
          let sid = taskResult.sessionId;
          stepControl.signal.throwIfAborted();

          taskResult = enforceStructuredWorkflowResult(taskResult, !!stepOpts?.schema);
          sid = taskResult.sessionId || sid;

          const step: CompletedStep = { step: agentName, sessionId: sid, result: taskResult };
          localSteps.push(step);
          completedSteps.push(step);
          pruneCompletedSteps(completedSteps);

          run.steps.push({
            sessionId: sid,
            agent: agentName,
            task: agentTask,
            status: taskResult.status,
            startedAt: taskResult.messages[0]?.timestamp ?? Date.now(),
            endedAt: Date.now(),
            lastAssistantText: taskResult.lastAssistantText,
          });

          onEvent?.({ type: "workflow.step_completed", step: agentName, sessionId: sid, result: taskResult });

          if (guards.length > 0) {
            const guardEvent: WorkflowGuardEvent = {
              type: "step_done",
              source: "agent",
              step: agentName,
              sessionId: sid,
              result: taskResult,
              completedSteps,
              task: agentTask,
            };
            const demands = emitAndCollectDemands(guards, guardEvent);
            if (demands.length > 0) {
              resolveDemands(demands, guardEvent, runId, completedSteps, guardWarnings, emitGuardSignal);
            }
          }

          const steeringAfter = steeringQueue.shift();
          if (steeringAfter) throw new WorkflowInterrupted(steeringAfter, completedSteps, runId);

          const mapped = agentExecutionResult(taskResult);
          return {
            ...mapped,
            sessionId: sid,
          };
        },
        runWorkflow: async (wfName: string, workflowInput: unknown, stepControl): Promise<WorkflowStepInvocationResult> => {
          const steering = steeringQueue.shift();
          if (steering) throw new WorkflowInterrupted(steering, completedSteps, runId);
          if (depth + 1 > maxDepth) {
            throw new Error(`Maximum workflow nesting depth (${maxDepth}) exceeded`);
          }
          const { workflow: subWorkflow, error } = findWorkflow(catalog, wfName);
          if (!subWorkflow) {
            throw new Error(error ?? `Workflow "${wfName}" not found`);
          }
          const nestedTask =
            typeof workflowInput === "string" ? workflowInput : JSON.stringify(workflowInput ?? null);
          onEvent?.({ type: "workflow.started", workflow: subWorkflow.name, task: nestedTask });
          const sub = await executeWorkflow(
            catalog,
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
          );
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
        },
        afterReturn: async (result) => {
          if (guards.length > 0 && (result.type === "done" || result.type === "blocked")) {
            const doneEvent: WorkflowGuardEvent = {
              type: "workflow_done",
              workflow: workflow.name,
              summary: result.type === "done" ? result.summary : result.reason,
              completedSteps,
            };
            const demands = emitAndCollectDemands(guards, doneEvent);
            if (demands.length > 0) {
              resolveDemands(demands, doneEvent, runId, completedSteps, guardWarnings, emitGuardSignal);
            }
          }
        },
      });

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
      } else if (err instanceof WorkflowBlocked) {
        run.status = "blocked";
        run.result = { reason: `Blocked by guard: ${err.reason}` };
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
      if (err instanceof WorkflowBlocked && depth === 1 && !opts.taskBinding) {
        emitWorkflowBlockedOwnerWake({
          workflowRunId: runId,
          workflow: workflow.name,
          task,
          reason: run.result?.reason ?? err.reason,
          projectId: effectiveProjectId,
          parentSessionId,
          parentWorkflowRunId,
        });
      }
      try {
        emitRuntimeEvent({
          type:
            err instanceof WorkflowInterrupted
              ? "workflow.interrupted"
              : err instanceof WorkflowBlocked || err instanceof ExecutionDeferredError
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

      if (err instanceof WorkflowBlocked) {
        const toolResult: WorkflowToolResult = {
          type: "blocked",
          workflow: workflow.name,
          workflowRunId: err.workflowRunId,
          reason: err.reason,
          completedSteps: err.completedSteps,
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
    const catalog = existingCatalog ?? (await buildWorkflowCatalog(workflowDir));
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
    return runWorkflow(catalog, workflow, task, 1, callerSessionId, callerMeta.workflowRunId, authoredInput);
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

  if (!includeModelTool) return runner;

  const tool: WorkflowTool = {
    name: "workflow",
    label: "Workflow",
    description:
      "List available workflows or run a workflow by name. " +
      "Workflows are predefined step sequences that coordinate sub-agents efficiently. " +
      "Use 'list' to see what's available, 'run' to execute one. " +
      "Terminal runs return id, kind, status, summary and output/facts; workflowRunId and steps retain diagnostic references. Completion is evidence for your assignment, not Task acceptance.",
    parameters: WorkflowToolParams,
    run: runner.run,
    steer: runner.steer,
    get isRunning(): boolean {
      return runner.isRunning;
    },
    get activeWorkflow(): string | null {
      return runner.activeWorkflow;
    },

    execute: async (_toolCallId, _params) => {
      const params = _params as WorkflowInput;
      const catalog = await buildWorkflowCatalog(workflowDir);
      switch (params.action) {
        case "list": {
          const workflows = [...catalog.workflows.values()]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((workflow) => ({
              name: workflow.name,
              description: workflow.description,
              sourceScope: workflow.sourceScope,
            }));
          const result: WorkflowToolResult = {
            type: "list",
            workflows,
            ...(catalog.diagnostics.length > 0 ? { diagnostics: [...catalog.diagnostics] } : {}),
          };
          return textResult(JSON.stringify({ ...result, ...workflowExecutionResult(result) }, null, 2));
        }

        case "run": {
          const hasInput = Object.hasOwn(params, "input");
          if (!params.name || (!hasInput && !params.task) || (hasInput && params.task !== undefined)) {
            return textResult(
              JSON.stringify({
                type: "error",
                error: "action 'run' requires 'name' and exactly one of 'input' or legacy 'task'",
              }),
            );
          }
          const task = hasInput
            ? typeof params.input === "string"
              ? params.input
              : JSON.stringify(params.input)
            : params.task!;
          return workflowModelExecution(() => runTyped(params.name!, task, catalog, hasInput ? { value: params.input } : undefined));
        }

        default: {
          return textResult(JSON.stringify({ error: `Unknown action: ${params.action}` }));
        }
      }
    },
  };

  return tool;
}

/** Typed workflow execution for SDK, handlers, and other system callers. */
export function createWorkflowRunner(opts: WorkflowToolOptions): WorkflowRunner {
  return createWorkflowRuntime(opts, false);
}

/** Model-facing JSON/schema adapter around the typed workflow runner. */
export function createWorkflowTool(opts: WorkflowToolOptions): WorkflowTool {
  return createWorkflowRuntime(opts, true);
}
