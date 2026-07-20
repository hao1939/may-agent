import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { Type, StringEnum } from "@earendil-works/pi-ai";
import type { TSchema } from "@earendil-works/pi-ai";
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import type { SubagentManager } from "./manager.js";
import type { TaskResult } from "./types.js";
import type {
  WorkflowContext,
  WorkflowModule,
  WorkflowResult,
  WorkflowEvent,
  WorkflowToolResult,
  WorkflowStepSummary,
  CompletedStep,
  WorkflowGuard,
  WorkflowGuardEvent,
  Demand,
  SessionOptions,
  SessionHandle,
  WorkflowAgentOptions,
} from "./workflow.js";
import { WorkflowInterrupted, WorkflowBlocked } from "./workflow.js";
// ── In-memory workflow types (used during execution) ────────────────────

/** In-memory record of a workflow execution. */
export interface WorkflowRun {
  runId: string;
  workflow: string;
  task: string;
  parentSessionId: string;
  parentWorkflowRunId?: string;
  projectId?: string;
  depth: number;
  startedAt: number;
  endedAt?: number;
  status: "running" | "done" | "blocked" | "escalated" | "interrupted" | "error";
  steps: WorkflowStep[];
  resumedFromRunId?: string;
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
import { insertWorkflowRun, updateWorkflowRun, getWorkflowRun, getWorkflowStepSessions } from "./requests.js";
import { summarizeForHandoff } from "./handoff.js";
import { log } from "./log.js";
import type { RuntimeCtx } from "./runtime-ctx.js";
import { createUnavailableMetricService } from "./metrics.js";
import { createUnavailableQueryService } from "./query-service.js";
import { createUnavailableCommandService } from "./command-service.js";
import { importRuntimeModule } from "./runtime-import.js";
import { normalizeEventOwner } from "../../packages/control/src/event-envelope.js";
import type { EventTrace } from "../app/event-bus.js";

// ── Tool schema ────────────────────────────────────────────────────────

const WorkflowToolParams: TSchema = Type.Object({
  action: StringEnum(["list", "run", "resume"] as const, {
    description:
      "'list': show available workflows with descriptions. 'run': execute a workflow by name (blocks until complete). 'resume': continue a workflow that was interrupted by a crash (requires workflowRunId).",
  }),
  name: Type.Optional(
    Type.String({
      description:
        "Workflow name to execute (required for 'run'). Use 'list' first to see available workflows and their descriptions.",
    }),
  ),
  task: Type.Optional(
    Type.String({
      description:
        "Task string to pass to the workflow (required for 'run'). Format depends on the workflow — check the workflow description from 'list' for expected format.",
    }),
  ),
  workflowRunId: Type.Optional(
    Type.String({
      description:
        "ID of a previous workflow run to resume from (required for 'resume'). The ID is returned when a workflow starts.",
    }),
  ),
});
interface WorkflowInput {
  action: "list" | "run" | "resume";
  name?: string;
  task?: string;
  workflowRunId?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────

function textResult(text: string): AgentToolResult<string> {
  return {
    content: [{ type: "text", text }],
    details: text,
  };
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

function durationSummary(startedAt: unknown, endedAt: unknown): string {
  if (typeof startedAt !== "number" || typeof endedAt !== "number") return "unknown";
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt < startedAt) return "unknown";
  return `${((endedAt - startedAt) / 1000).toFixed(1)}s`;
}

function buildStoredStepSummaries(steps: WorkflowStep[]): WorkflowStepSummary[] {
  return steps.slice(-MAX_DETAILED_STEPS).map((step) => ({
    agent: step.agent,
    sessionId: step.sessionId,
    status: step.status,
    output: truncate(step.lastAssistantText ?? "(no output)", 2000),
    duration: durationSummary(step.startedAt, step.endedAt),
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

async function loadWorkflow(filePath: string, sourceScope: "agent" | "project"): Promise<WorkflowModule> {
  const mod = await importRuntimeModule<{ name?: unknown; description?: unknown; execute?: unknown; verify?: unknown }>(
    filePath,
  );
  if (typeof mod.name !== "string" || !mod.name.trim()) {
    throw new Error(`Workflow file ${filePath} must export a non-empty 'name' string`);
  }
  if (typeof mod.description !== "string" || !mod.description.trim()) {
    throw new Error(`Workflow file ${filePath} must export a non-empty 'description' string`);
  }
  const execute = mod.execute;
  if (typeof execute !== "function") {
    throw new Error(`Workflow file ${filePath} must export an 'execute' function`);
  }
  if (mod.verify !== undefined && typeof mod.verify !== "function") {
    throw new Error(`Workflow file ${filePath} must export 'verify' as a function when present`);
  }
  return {
    name: mod.name.trim(),
    description: mod.description.trim(),
    execute: execute as WorkflowModule["execute"],
    ...(typeof mod.verify === "function" ? { verify: mod.verify as WorkflowModule["verify"] } : {}),
    sourcePath: filePath,
    sourceScope,
    entryContentHash: createHash("sha256").update(readFileSync(filePath)).digest("hex"),
  };
}

function listWorkflowFiles(workflowDir: string | undefined): string[] {
  if (!workflowDir) return [];
  try {
    const trustedRoot = realpathSync(workflowDir);
    return readdirSync(workflowDir)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.includes("-helpers") && !f.includes("-utils"))
      .sort()
      .map((file) => realpathSync(join(workflowDir, file)))
      .filter((filePath) => {
        const fromRoot = relative(trustedRoot, filePath);
        return (
          fromRoot !== ".." &&
          !fromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) &&
          !isAbsolute(fromRoot)
        );
      });
  } catch {
    return [];
  }
}

interface WorkflowCatalog {
  readonly workflows: ReadonlyMap<string, WorkflowModule>;
  readonly diagnostics: readonly string[];
}

async function loadWorkflowScope(
  dir: string | undefined,
  scope: "agent" | "project",
): Promise<{ workflows: Map<string, WorkflowModule>; diagnostics: string[] }> {
  const grouped = new Map<string, WorkflowModule[]>();
  const diagnostics: string[] = [];
  for (const filePath of listWorkflowFiles(dir)) {
    try {
      const workflow = await loadWorkflow(filePath, scope);
      const matches = grouped.get(workflow.name) ?? [];
      matches.push(workflow);
      grouped.set(workflow.name, matches);
    } catch (err) {
      diagnostics.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const workflows = new Map<string, WorkflowModule>();
  for (const [name, matches] of grouped) {
    if (matches.length > 1) {
      diagnostics.push(
        `Ambiguous ${scope} workflow name "${name}": ${matches.map((item) => item.sourcePath).join(", ")}`,
      );
      continue;
    }
    workflows.set(name, matches[0]);
  }
  return { workflows, diagnostics };
}

async function buildWorkflowCatalog(workflowDir: string): Promise<WorkflowCatalog> {
  const agent = await loadWorkflowScope(workflowDir, "agent");
  return Object.freeze({
    workflows: new Map(agent.workflows),
    diagnostics: Object.freeze([...agent.diagnostics]),
  });
}

function findWorkflow(
  catalog: WorkflowCatalog,
  name: string,
): { workflow: WorkflowModule | null; error: string | null } {
  const workflow = catalog.workflows.get(name) ?? null;
  if (workflow) return { workflow, error: null };
  const diagnostics =
    catalog.diagnostics.length > 0 ? ` Catalog diagnostics:\n  ${catalog.diagnostics.join("\n  ")}` : "";
  return { workflow: null, error: `Workflow "${name}" not found.${diagnostics}` };
}

// ── Guard Discovery ────────────────────────────────────────────────────

const MAX_INJECTION_DEPTH = 3;
const DEFAULT_MAX_INJECTED_STEPS = 5;

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

type GuardSignalAction =
  "observed" | "warned" | "blocked" | "injected" | "skipped_duplicate" | "skipped_invalid" | "skipped_limit";
type GuardSignalEmitter = (demand: Demand, action: GuardSignalAction, extra?: Record<string, unknown>) => void;

/** Resolve a list of demands: run injected steps, emit warnings, or block. */
async function resolveDemands(
  demands: Demand[],
  sourceEvent: WorkflowGuardEvent,
  runId: string,
  completedSteps: CompletedStep[],
  steeringQueue: string[],
  injectedCount: { value: number },
  maxInjected: number,
  manager: SubagentManager,
  parentSessionId: string | undefined,
  projectId: string | undefined,
  recoveryOwner: string | undefined,
  trace: EventTrace | undefined,
  onEvent: ((event: WorkflowEvent) => void) | undefined,
  run: WorkflowRun,
  persistDir: string | undefined,
  warnings: string[],
  emitGuardSignal?: GuardSignalEmitter,
): Promise<void> {
  // Gap 3: Deduplicate run_step demands by label
  const seenRunStepLabels = new Set<string>();
  const dedupedDemands: Demand[] = [];
  for (const demand of demands) {
    if (demand.type === "run_step" || demand.type === "repair") {
      const label = demand.step?.label ?? demand.reason;
      if (seenRunStepLabels.has(label)) {
        log("info", `[guards] Deduplicating run_step demand with label "${label}" from "${demand.guardName}"`);
        emitGuardSignal?.(demand, "skipped_duplicate", {
          sourceEventType: sourceEvent.type,
          step: "step" in sourceEvent ? sourceEvent.step : undefined,
          sessionId: "sessionId" in sourceEvent ? sourceEvent.sessionId : undefined,
          injectedStepLabel: label,
        });
        continue;
      }
      seenRunStepLabels.add(label);
    }
    dedupedDemands.push(demand);
  }

  for (const demand of dedupedDemands) {
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

      case "repair":
      case "run_step": {
        if (!demand.step) {
          log("warn", `[guards] run_step demand from "${demand.guardName}" missing step config, skipping`);
          emitGuardSignal?.(demand, "skipped_invalid", {
            sourceEventType: sourceEvent.type,
            step: "step" in sourceEvent ? sourceEvent.step : undefined,
            sessionId: "sessionId" in sourceEvent ? sourceEvent.sessionId : undefined,
          });
          break;
        }
        if (injectedCount.value >= maxInjected) {
          log("warn", `[guards] Skipping injected step from "${demand.guardName}": limit ${maxInjected} reached`);
          emitGuardSignal?.(demand, "skipped_limit", {
            sourceEventType: sourceEvent.type,
            step: "step" in sourceEvent ? sourceEvent.step : undefined,
            sessionId: "sessionId" in sourceEvent ? sourceEvent.sessionId : undefined,
            injectedStepLabel: demand.step.label ?? `guard:${demand.guardName}`,
            injectedAgent: demand.step.agent,
          });
          break;
        }
        injectedCount.value++;
        const label = demand.step.label ?? `guard:${demand.guardName}`;
        log(
          "info",
          `[guards] Injecting step "${label}" (${injectedCount.value}/${maxInjected}) from guard "${demand.guardName}"`,
        );
        emitGuardSignal?.(demand, "injected", {
          sourceEventType: sourceEvent.type,
          step: "step" in sourceEvent ? sourceEvent.step : undefined,
          sessionId: "sessionId" in sourceEvent ? sourceEvent.sessionId : undefined,
          injectedStepLabel: label,
          injectedAgent: demand.step.agent,
        });

        onEvent?.({ type: "workflow.step_started", step: label });

        const taskResult = await manager.callAgent(demand.step.agent, demand.step.task, {
          parentSessionId,
          workflowRunId: runId,
          projectId,
          recoveryOwner,
          stepLabel: label,
          source: "guard",
          trace,
          requireFinish: true,
        });

        const step: CompletedStep = { step: label, sessionId: taskResult.sessionId, result: taskResult };
        completedSteps.push(step);
        pruneCompletedSteps(completedSteps);

        // Persist step
        const wfStep: WorkflowStep = {
          sessionId: taskResult.sessionId,
          agent: demand.step.agent,
          task: demand.step.task,
          status: taskResult.status,
          startedAt: taskResult.messages[0]?.timestamp ?? Date.now(),
          endedAt: Date.now(),
          lastAssistantText: taskResult.lastAssistantText,
        };
        run.steps.push(wfStep);
        // Step data persisted via sessions table (db-writer)

        onEvent?.({
          type: "workflow.step_completed",
          step: label,
          sessionId: taskResult.sessionId,
          result: taskResult,
        });
        break;
      }
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
  run(name: string, task: string): Promise<WorkflowToolResult>;
  resolve(name: string): Promise<WorkflowModule | null>;
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

// ── runWorkflowDirect — for system-level callers (handlers) ───────────

export interface RunWorkflowDirectOpts {
  workflowName: string;
  task: string;
  manager: SubagentManager;
  runtimeCtx: RuntimeCtx;
  agentName: string;
  persistDir: string;
  workflowDir?: string;
  guardsDir?: string;
  sharedGuardsDir?: string;
  parentSessionId?: string;
  projectId?: string;
  /** Runtime that exclusively owns crash recovery for workflow step sessions. */
  recoveryOwner?: string;
  onEvent?: (event: WorkflowEvent) => void;
  trace?: EventTrace;
  executionPaths?: { appDir: string; projectDir: string; workspaceDir: string };
}

/**
 * Run a workflow through the typed runner shared with the model tool.
 * Used by system-level callers like the project handler.
 * Gets the same guards, step tracking, persistence, and createSession
 * as agent-invoked workflows.
 */
export async function runWorkflowDirect(opts: RunWorkflowDirectOpts): Promise<{
  result: WorkflowResult;
  runId: string;
  verifier?: { name: string; sourcePath: string; verify: NonNullable<WorkflowModule["verify"]> };
}> {
  const runner = createWorkflowRunner({
    manager: opts.manager,
    workflowDir: opts.workflowDir ?? "",
    guardsDir: opts.guardsDir,
    sharedGuardsDir: opts.sharedGuardsDir,
    persistDir: opts.persistDir,
    agentName: opts.agentName,
    parentSessionId: opts.parentSessionId,
    projectId: opts.projectId,
    recoveryOwner: opts.recoveryOwner,
    onEvent: opts.onEvent,
    trace: opts.trace,
    runtimeCtx: opts.runtimeCtx,
    executionPaths: opts.executionPaths,
  });

  const workflow = await runner.resolve(opts.workflowName);
  const parsed = await runner.run(opts.workflowName, opts.task);
  const verifier = workflow?.verify
    ? { name: workflow.name, sourcePath: workflow.sourcePath, verify: workflow.verify }
    : undefined;

  if (parsed.type === "done") {
    return {
      result: { type: "done", summary: parsed.summary, output: parsed.output },
      runId: parsed.workflowRunId,
      ...(verifier ? { verifier } : {}),
    };
  }
  if (parsed.type === "error") {
    if (parsed.category === "workflow_definition_missing") {
      throw new WorkflowHandlerUnavailable(opts.workflowName, parsed.error);
    }
    throw new Error(`Workflow "${opts.workflowName}" error: ${parsed.error}`);
  }
  if (parsed.type === "blocked") {
    return {
      result: { type: "blocked", reason: parsed.reason, context: parsed.context },
      runId: parsed.workflowRunId,
      ...(verifier ? { verifier } : {}),
    };
  }
  if (parsed.type === "interrupted") {
    throw new Error(`Workflow "${opts.workflowName}" interrupted: ${parsed.steeringMessage}`);
  }
  throw new Error(`Workflow "${opts.workflowName}" returned unknown result: ${(parsed as any).type ?? "unknown"}`);
}

// ── createWorkflowTool ─────────────────────────────────────────────────

export interface WorkflowToolOptions {
  manager: SubagentManager;
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
  /** The name of the agent that owns this workflow tool.
   *  Exposed as `ctx.agent` so reusable workflow code can delegate to the calling agent. */
  agentName?: string;
  /** Maximum workflow nesting depth (default: 3). */
  maxDepth?: number;
  /** Maximum guard-injected steps per workflow run (default: 5). */
  maxInjectedSteps?: number;
  onEvent?: (event: WorkflowEvent) => void;
  /** Parent session ID for spawned sessions. */
  parentSessionId?: string;
  /** Canonical project id for sessions spawned by this workflow. */
  projectId?: string;
  /** Runtime that exclusively owns crash recovery for workflow step sessions. */
  recoveryOwner?: string;
  /** Pre-built RuntimeCtx — shared infra (emit, getDb, log, notify, paths). */
  runtimeCtx?: RuntimeCtx;
  /** Resolved app/domain paths supplied by Agent App infrastructure. */
  executionPaths?: { appDir: string; projectDir: string; workspaceDir: string };
  /** Trace inherited from the event that started this workflow. */
  trace?: EventTrace;
  /** Resolve the active caller turn trace for long-lived chat sessions. */
  callerTrace?: () => EventTrace | undefined;
}

function createWorkflowRuntime(opts: WorkflowToolOptions, includeModelTool: false): WorkflowRunner;
function createWorkflowRuntime(opts: WorkflowToolOptions, includeModelTool: true): WorkflowTool;
function createWorkflowRuntime(opts: WorkflowToolOptions, includeModelTool: boolean): WorkflowRunner | WorkflowTool {
  const { manager, workflowDir, persistDir, onEvent } = opts;
  const maxDepth = opts.maxDepth ?? 3;
  const resolveTrace = (): EventTrace | undefined => opts.callerTrace?.() ?? opts.trace;
  const emitRuntimeEvent = (event: { type: string; [key: string]: unknown }): void => {
    const trace = resolveTrace();
    opts.runtimeCtx?.emit(event.trace || !trace ? event : { ...event, trace });
  };

  const resolveCallerSessionId = (): string | undefined => {
    const v = opts.callerSessionId;
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

  const workflowResumeNextAction = (category: string, recoverable = false): string => {
    if (category === "workflow_definition_missing" || category === "corrupt_state") return "recover";
    if (recoverable) return "resume";
    return "blocked";
  };

  const emitWorkflowResumeFailed = (data: {
    workflowRunId?: string;
    workflow?: string;
    reason: string;
    category: string;
    recoverable?: boolean;
    projectId?: string;
  }): void => {
    const event = {
      type: "workflow.resume_failed",
      source: "workflow-tool",
      timestamp: Date.now(),
      owner: normalizeEventOwner(opts.agentName),
      data: {
        workflowRunId: data.workflowRunId,
        workflow: data.workflow,
        projectId: data.projectId ?? opts.projectId,
        reason: data.reason,
        category: data.category,
        recoverable: data.recoverable ?? false,
        nextAction: workflowResumeNextAction(data.category, data.recoverable ?? false),
      },
    } as const;
    emitRuntimeEvent(event);
    onEvent?.(event);
  };

  const emitWorkflowResumeSkipped = (data: {
    workflowRunId: string;
    workflow: string;
    status: string;
    reason: string;
    projectId?: string;
  }): void => {
    const event = {
      type: "workflow.resume_skipped",
      source: "workflow-tool",
      timestamp: Date.now(),
      owner: normalizeEventOwner(opts.agentName),
      data: {
        workflowRunId: data.workflowRunId,
        workflow: data.workflow,
        projectId: data.projectId ?? opts.projectId,
        status: data.status,
        reason: data.reason,
        nextAction: "none",
      },
    } as const;
    emitRuntimeEvent(event);
    onEvent?.(event);
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
    const payload = {
      workflowRunId: data.workflowRunId,
      workflow: data.workflow,
      workflowOwner,
      projectId: data.projectId,
      parentSessionId: data.parentSessionId,
      parentWorkflowRunId: data.parentWorkflowRunId,
      task: truncate(data.task, 500),
      reason: data.reason,
      context: data.context,
    };
    if (data.projectId) {
      emitRuntimeEvent({
        type: "project.owner.requested",
        source: "workflow-tool",
        owner: workflowOwner,
        project: data.projectId,
        reason: "workflow-blocked",
        params: payload,
      } as any);
      return;
    }
    emitRuntimeEvent({
      type: "workflow.owner.requested",
      source: "workflow-tool",
      owner: workflowOwner,
      data: {
        reason: "workflow-blocked",
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

  const workflowResumeError = (data: {
    workflowRunId?: string;
    workflow?: string;
    reason: string;
    category: string;
    recoverable?: boolean;
    projectId?: string;
  }): AgentToolResult<string> => {
    emitWorkflowResumeFailed(data);
    return textResult(
      JSON.stringify(
        {
          type: "error",
          workflow: data.workflow,
          workflowRunId: data.workflowRunId,
          error: data.reason,
          reason: data.reason,
          category: data.category,
          recoverable: data.recoverable ?? false,
          nextAction: workflowResumeNextAction(data.category, data.recoverable ?? false),
        },
        null,
        2,
      ),
    );
  };

  let activeSteeringQueue: string[] | null = null;
  let activeWorkflowName: string | null = null;

  /** Execute a workflow at the given depth, tracking everything in a WorkflowRun.
   *  If `previousRun` is provided, completed steps are replayed from archived
   *  session data instead of spawning new sessions. Replay stops (and live
   *  execution begins) at the first step whose agent name doesn't match the
   *  previous run — which means the workflow code changed and the old data
   *  no longer applies.
   */
  async function executeWorkflow(
    catalog: WorkflowCatalog,
    workflow: WorkflowModule,
    task: string,
    depth: number,
    parentSessionId: string | undefined,
    parentWorkflowRunId: string | undefined,
    completedSteps: CompletedStep[],
    steeringQueue: string[],
    previousRun?: WorkflowRun,
  ): Promise<{ result: WorkflowResult; runId: string; steps: CompletedStep[] }> {
    const runId = generateRunId();
    const localSteps: CompletedStep[] = [];
    let stepCounter = 0;
    const callerMeta = getCallerSessionMeta(parentSessionId);
    const effectiveProjectId = previousRun?.projectId ?? opts.projectId ?? callerMeta.projectId;
    const revisionMatches = Boolean(
      previousRun?.entryContentHash && previousRun.entryContentHash === workflow.entryContentHash,
    );
    let replayExhausted = !revisionMatches;

    // Create the workflow run record (DB-backed)
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
      resumedFromRunId: previousRun?.runId,
      sourcePath: workflow.sourcePath,
      sourceScope: workflow.sourceScope,
      entryContentHash: workflow.entryContentHash,
    };
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
        resumedFromRunId: previousRun?.runId ?? null,
        sourcePath: workflow.sourcePath,
        sourceScope: workflow.sourceScope,
        entryContentHash: workflow.entryContentHash,
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
        resumedFromRunId: previousRun?.runId,
        sourcePath: workflow.sourcePath,
        sourceScope: workflow.sourceScope,
        entryContentHash: workflow.entryContentHash,
      },
    });
    if (previousRun && !revisionMatches) {
      emitRuntimeEvent({
        type: "workflow.resume_restarted",
        source: `workflow:${workflow.name}`,
        owner: normalizeEventOwner(opts.agentName),
        data: {
          workflowRunId: runId,
          resumedFromRunId: previousRun.runId,
          workflow: workflow.name,
          reason: previousRun.entryContentHash
            ? "workflow entry revision changed"
            : "previous run has no workflow revision provenance",
          previousEntryContentHash: previousRun.entryContentHash,
          entryContentHash: workflow.entryContentHash,
        },
      });
    }

    // ── Load guards ────────────────────────────────────────────────────
    const guards = await loadGuards(opts.guardsDir, opts.sharedGuardsDir);
    const maxInjected = opts.maxInjectedSteps ?? DEFAULT_MAX_INJECTED_STEPS;
    const injectedStepCount = { value: 0 };
    const guardWarnings: string[] = [];
    const emitGuardSignal: GuardSignalEmitter = (demand, action, extra = {}) => {
      const sourceEventType = typeof extra.sourceEventType === "string" ? extra.sourceEventType : "unknown";
      emitRuntimeEvent({
        type: "guard.triggered",
        source: "workflow",
        owner: `agent:${opts.agentName ?? "may"}`,
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
          injectedStepLabel: typeof extra.injectedStepLabel === "string" ? extra.injectedStepLabel : undefined,
          injectedAgent: typeof extra.injectedAgent === "string" ? extra.injectedAgent : undefined,
        },
      } as any);
    };

    if (guards.length > 0) {
      log("info", `[guards] Loaded ${guards.length} guard(s): ${guards.map((g) => g.name).join(", ")}`);
      // Emit workflow_start to guards
      const startEvent: WorkflowGuardEvent = { type: "workflow_start", workflow: workflow.name, task };
      emitAndCollectDemands(guards, startEvent); // start events: collect but don't expect demands (logging only)
    }

    const runAgentStep = async (
      agentName: string,
      agentTask: string,
      reuseSessionId?: string,
      stepOpts?: WorkflowAgentOptions,
    ): Promise<TaskResult> => {
      // Defensive guard: catch undefined/null agent names before they reach manager.callAgent()
      // where they'd produce the confusing "Agent \"undefined\" not registered" error.
      // This can happen when workflows use ctx.agent on a binary compiled before the agent field was added.
      if (!agentName || typeof agentName !== "string" || agentName === "undefined" || agentName === "unknown") {
        throw new Error(
          `runAgent called with invalid agent name: ${JSON.stringify(agentName)}. ` +
            `If using ctx.agent, ensure the workflow tool was created with agentName option ` +
            `and that the binary has been restarted after deploy.`,
        );
      }
      const currentStep = stepCounter++;
      const sessionToReuse = typeof reuseSessionId === "string" && reuseSessionId.trim() ? reuseSessionId.trim() : "";

      // Replay applies to ordinary workflow steps. Task-bound sessions represent
      // actual fresh/resumed work and should not be satisfied from replay alone.
      if (!sessionToReuse && previousRun && !replayExhausted && currentStep < previousRun.steps.length) {
        const prevStep = previousRun.steps[currentStep];
        if (prevStep.agent === agentName && prevStep.task === agentTask) {
          try {
            const taskResult = enforceStructuredWorkflowResult(manager.result(prevStep.sessionId), !!stepOpts?.schema);
            if (taskResult.status === "error") throw new Error(taskResult.error);
            const step: CompletedStep = { step: agentName, sessionId: prevStep.sessionId, result: taskResult };
            localSteps.push(step);
            completedSteps.push(step);
            pruneCompletedSteps(completedSteps);

            run.steps.push({
              sessionId: prevStep.sessionId,
              agent: agentName,
              task: agentTask,
              status: taskResult.status,
              startedAt: prevStep.startedAt,
              endedAt: prevStep.endedAt,
              lastAssistantText: taskResult.lastAssistantText,
            });

            onEvent?.({
              type: "workflow.step_completed",
              step: agentName,
              sessionId: prevStep.sessionId,
              result: taskResult,
            });
            return taskResult;
          } catch {
            replayExhausted = true;
          }
        } else {
          replayExhausted = true;
        }
      }

      const steering = steeringQueue.shift();
      if (steering) throw new WorkflowInterrupted(steering, completedSteps, runId);

      let effectiveTask = agentTask;
      if (guardWarnings.length > 0) {
        effectiveTask += `\n\n## Guard Warnings\n${guardWarnings.map((w) => "- " + w).join("\n")}`;
        guardWarnings.length = 0;
      }

      let sid = sessionToReuse;
      let taskResult: TaskResult | undefined;
      const waitForStep = async (sessionId: string): Promise<TaskResult> => {
        if (!stepOpts?.timeoutMs) return manager.waitFor(sessionId);
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([
            manager.waitFor(sessionId),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => {
                try {
                  manager.cancel(sessionId);
                } catch {
                  // Best-effort cancellation; the timeout still rejects.
                }
                reject(new Error(`Agent step "${agentName}" timed out after ${stepOpts.timeoutMs}ms`));
              }, stepOpts.timeoutMs);
            }),
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }
      };
      if (sid) {
        try {
          onEvent?.({ type: "workflow.step_started", step: agentName, sessionId: sid });
          if (!manager.hasActiveSession(sid)) {
            try {
              taskResult = manager.result(sid);
            } catch {
              manager.resumeSession(sid, effectiveTask, {
                source: `workflow:${workflow.name}`,
                timeoutMs: stepOpts?.timeoutMs,
                suppressBenignRaceEvent: true,
                requireFinish: true,
                outputSchema: stepOpts?.schema,
                toolPolicy: stepOpts?.tools,
              });
            }
          }
          if (!taskResult) taskResult = await waitForStep(sid);
          taskResult = { ...taskResult, messages: manager.progress(sid, 1000) };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes("not found")) {
            sid = manager.run(agentName, effectiveTask, {
              sessionId: sid,
              parentSessionId,
              workflowRunId: runId,
              projectId: effectiveProjectId,
              recoveryOwner: opts.recoveryOwner,
              stepLabel: agentName,
              source: `workflow:${workflow.name}`,
              kind: "call",
              timeoutMs: stepOpts?.timeoutMs,
              trace: resolveTrace(),
              skill: stepOpts?.skill,
              requireFinish: true,
              outputSchema: stepOpts?.schema,
              toolPolicy: stepOpts?.tools,
            });
            taskResult = await waitForStep(sid);
            taskResult = { ...taskResult, messages: manager.progress(sid, 1000) };
          } else {
            sid = "";
          }
        }
      }
      if (!taskResult || !sid) {
        onEvent?.({ type: "workflow.step_started", step: agentName });
        taskResult = await manager.callAgent(agentName, effectiveTask, {
          parentSessionId,
          source: `workflow:${workflow.name}`,
          workflowRunId: runId,
          projectId: effectiveProjectId,
          recoveryOwner: opts.recoveryOwner,
          stepLabel: agentName,
          timeout: stepOpts?.timeoutMs,
          trace: resolveTrace(),
          skill: stepOpts?.skill,
          requireFinish: true,
          outputSchema: stepOpts?.schema,
          toolPolicy: stepOpts?.tools,
        });
        sid = taskResult.sessionId;
      }

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
          await resolveDemands(
            demands,
            guardEvent,
            runId,
            completedSteps,
            steeringQueue,
            injectedStepCount,
            maxInjected,
            manager,
            parentSessionId,
            effectiveProjectId,
            opts.recoveryOwner,
            resolveTrace(),
            onEvent,
            run,
            persistDir ?? undefined,
            guardWarnings,
            emitGuardSignal,
          );
        }
      }

      const steeringAfter = steeringQueue.shift();
      if (steeringAfter) throw new WorkflowInterrupted(steeringAfter, completedSteps, runId);

      return taskResult;
    };

    const ctx: WorkflowContext = {
      task,
      agent: opts.agentName && opts.agentName !== "undefined" ? opts.agentName : "unknown",

      // ── RuntimeCtx (shared infra) — spread pre-built or fallback ──
      ...(opts.runtimeCtx ?? {
        emit: (event: { type: string; [key: string]: unknown }) => {
          onEvent?.(event as WorkflowEvent);
        },
        dispatchEvent: (_eventType: string, _data?: Record<string, unknown>) => {},
        getDb: () => {
          throw new Error("No runtimeCtx — getDb unavailable");
        },
        query: createUnavailableQueryService("No runtimeCtx - query unavailable"),
        commands: createUnavailableCommandService("No runtimeCtx - commands unavailable"),
        log: (_msg: string) => {},
        notify: (_msg: string) => {},
        metrics: createUnavailableMetricService("No runtimeCtx - metrics unavailable"),
        persistDir: persistDir ?? "",
        projectRoot: "",
        agentsRoot: "",
        sharedRoot: "",
        projectsRoot: "",
      }),
      ...(opts.executionPaths ?? {}),
      // Overlay emit to also call onEvent for workflow lifecycle logging
      emit: (event: { type: string; [key: string]: unknown }) => {
        emitRuntimeEvent(event);
        onEvent?.(event as WorkflowEvent);
      },
      dispatchEvent: (eventType: string, data?: Record<string, unknown>) => {
        emitRuntimeEvent({ type: eventType, data: data ?? {} });
      },

      runAgent: ((agentName: string, agentTask: string, stepOpts?: WorkflowAgentOptions): Promise<TaskResult> =>
        runAgentStep(agentName, agentTask, undefined, stepOpts)) as WorkflowContext["runAgent"],
      runAgentSession: ((
        agentName: string,
        agentTask: string,
        sessionId?: string,
        stepOpts?: WorkflowAgentOptions,
      ): Promise<TaskResult> =>
        runAgentStep(agentName, agentTask, sessionId, stepOpts)) as WorkflowContext["runAgentSession"],

      runFunction: async (label: string, fn: () => Promise<string>): Promise<TaskResult> => {
        const start = Date.now();
        onEvent?.({ type: "workflow.step_started", step: `fn:${label}` });

        let output: string;
        let hadError = false;
        let errorMsg: string | undefined;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const timeout = 30_000;
          output = await Promise.race([
            fn(),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => reject(new Error(`runFunction("${label}") timed out after ${timeout}ms`)),
                timeout,
              );
            }),
          ]);
          // Truncate output to 50KB
          if (output.length > 50_000) {
            output = output.slice(0, 50_000) + "\n…(truncated)";
          }
        } catch (err) {
          hadError = true;
          errorMsg = err instanceof Error ? err.message : String(err);
          output = `ERROR: ${errorMsg}`;
        } finally {
          if (timer) clearTimeout(timer);
        }
        const duration = `${((Date.now() - start) / 1000).toFixed(1)}s`;
        const taskResult: TaskResult = {
          sessionId: `fn_${label}_${Date.now()}`,
          status: hadError ? "error" : "done",
          lastAssistantText: output,
          messages: [],
          duration,
          outputDir: "",
          turnsUsed: 0,
          ...(hadError && errorMsg ? { error: errorMsg } : {}),
        };

        const step: CompletedStep = { step: `fn:${label}`, sessionId: taskResult.sessionId, result: taskResult };
        localSteps.push(step);
        completedSteps.push(step);
        pruneCompletedSteps(completedSteps);

        onEvent?.({
          type: "workflow.step_completed",
          step: `fn:${label}`,
          sessionId: taskResult.sessionId,
          result: taskResult,
        });

        // Guard: step_done for function steps
        if (guards.length > 0) {
          const guardEvent: WorkflowGuardEvent = {
            type: "step_done",
            source: "function",
            step: label,
            sessionId: taskResult.sessionId,
            result: taskResult,
            completedSteps,
            task: label,
          };
          const demands = emitAndCollectDemands(guards, guardEvent);
          if (demands.length > 0) {
            await resolveDemands(
              demands,
              guardEvent,
              runId,
              completedSteps,
              steeringQueue,
              injectedStepCount,
              maxInjected,
              manager,
              parentSessionId,
              effectiveProjectId,
              opts.recoveryOwner,
              resolveTrace(),
              onEvent,
              run,
              persistDir ?? undefined,
              guardWarnings,
              emitGuardSignal,
            );
          }
        }

        return taskResult;
      },

      summarize: (result: TaskResult, handoffOpts?) => {
        return summarizeForHandoff(result, handoffOpts);
      },

      runWorkflow: async (wfName: string, wfTask: string): Promise<WorkflowResult> => {
        const steering = steeringQueue.shift();
        if (steering) {
          throw new WorkflowInterrupted(steering, completedSteps, runId);
        }

        if (depth + 1 > maxDepth) {
          return { type: "blocked", reason: `Maximum workflow nesting depth (${maxDepth}) exceeded` };
        }

        const { workflow: subWf, error: subErr } = findWorkflow(catalog, wfName);
        if (!subWf) {
          return { type: "blocked", reason: subErr ?? `Workflow "${wfName}" not found` };
        }

        onEvent?.({ type: "workflow.started", workflow: subWf.name, task: wfTask });

        const sub = await executeWorkflow(
          catalog,
          subWf,
          wfTask,
          depth + 1,
          parentSessionId,
          runId,
          completedSteps,
          steeringQueue,
        );

        if (sub.result.type === "done") {
          onEvent?.({ type: "workflow.completed", summary: sub.result.summary });
        } else {
          onEvent?.({ type: "workflow.blocked", reason: sub.result.reason });
        }

        return sub.result;
      },

      done: (summary: string, output?: unknown) => ({ type: "done" as const, summary, output }),
      blocked: (reason: string, context?: unknown) => ({ type: "blocked" as const, reason, context }),

      createSession: async (sessionOpts: SessionOptions): Promise<SessionHandle> => {
        const history: Array<{ role: string; text: string }> = [];
        let lastResponse = "";
        const label = sessionOpts.label || "session";
        const agentName = ctx.agent;

        return {
          async prompt(message: string) {
            // Build accumulated prompt with history
            let fullPrompt = sessionOpts.systemPrompt + "\n\n";
            for (const h of history) {
              fullPrompt += `[${h.role}]: ${h.text}\n\n`;
            }
            fullPrompt += message;
            history.push({ role: "user", text: message });

            const stepName = `session:${label}`;
            onEvent?.({ type: "workflow.step_started", step: stepName });

            const taskResult = await manager.callAgent(agentName, fullPrompt, {
              parentSessionId,
              workflowRunId: runId,
              projectId: effectiveProjectId,
              recoveryOwner: opts.recoveryOwner,
              stepLabel: stepName,
              source: `workflow:${label}`,
              trace: resolveTrace(),
              requireFinish: true,
              toolPolicy: sessionOpts.tools,
            });

            lastResponse = taskResult.lastAssistantText || "";
            history.push({ role: "assistant", text: lastResponse.slice(0, 2000) });

            // Track as a workflow step
            const step: CompletedStep = { step: stepName, sessionId: taskResult.sessionId, result: taskResult };
            localSteps.push(step);
            completedSteps.push(step);
            pruneCompletedSteps(completedSteps);

            // Persist step
            const wfStep: WorkflowStep = {
              sessionId: taskResult.sessionId,
              agent: agentName,
              task: message.slice(0, 200),
              status: taskResult.status,
              startedAt: taskResult.messages[0]?.timestamp ?? Date.now(),
              endedAt: Date.now(),
              lastAssistantText: taskResult.lastAssistantText,
            };
            run.steps.push(wfStep);
            // Step data persisted via sessions table (db-writer)

            onEvent?.({
              type: "workflow.step_completed",
              step: stepName,
              sessionId: taskResult.sessionId,
              result: taskResult,
            });

            // Fire guards
            if (guards.length > 0) {
              const guardEvent: WorkflowGuardEvent = {
                type: "step_done",
                source: "agent",
                step: stepName,
                sessionId: taskResult.sessionId,
                result: taskResult,
                completedSteps,
                task: message,
              };
              const demands = emitAndCollectDemands(guards, guardEvent);
              if (demands.length > 0) {
                await resolveDemands(
                  demands,
                  guardEvent,
                  runId,
                  completedSteps,
                  steeringQueue,
                  injectedStepCount,
                  maxInjected,
                  manager,
                  parentSessionId,
                  effectiveProjectId,
                  opts.recoveryOwner,
                  resolveTrace(),
                  onEvent,
                  run,
                  persistDir ?? undefined,
                  guardWarnings,
                  emitGuardSignal,
                );
              }
            }
          },
          lastText() {
            return lastResponse;
          },
          close() {
            /* no-op — each prompt() is an independent session */
          },
        };
      },
    };

    try {
      const result = await workflow.execute(ctx);

      // ── Guard: workflow_done event ──────────────────────────────────
      if (guards.length > 0) {
        const doneEvent: WorkflowGuardEvent = {
          type: "workflow_done",
          workflow: workflow.name,
          summary: result.type === "done" ? result.summary : result.reason,
          completedSteps,
        };
        const demands = emitAndCollectDemands(guards, doneEvent);
        await resolveDemands(
          demands,
          doneEvent,
          runId,
          completedSteps,
          steeringQueue,
          injectedStepCount,
          maxInjected,
          manager,
          parentSessionId,
          effectiveProjectId,
          opts.recoveryOwner,
          resolveTrace(),
          onEvent,
          run,
          persistDir ?? undefined,
          guardWarnings,
          emitGuardSignal,
        );
      }

      // Finalize the workflow run
      run.endedAt = Date.now();
      run.status = result.type === "done" ? "done" : "blocked";
      run.result = result.type === "done" ? { summary: result.summary } : { reason: result.reason };
      if (persistDir)
        updateWorkflowRun(persistDir, runId, {
          status: run.status,
          endedAt: run.endedAt,
          result_summary: run.result.summary,
          result_reason: run.result.reason,
        });
      if (result.type !== "done" && depth === 1) {
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
        type: result.type === "done" ? "workflow.completed" : "workflow.blocked",
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
      } else if (err instanceof WorkflowBlocked) {
        run.status = "blocked";
        run.result = { reason: `Blocked by guard: ${err.reason}` };
      } else {
        run.status = "error";
        run.result = { reason: err instanceof Error ? err.message : String(err) };
      }
      if (persistDir)
        updateWorkflowRun(persistDir, runId, {
          status: run.status,
          endedAt: run.endedAt,
          result_reason: run.result?.reason,
        });
      if (err instanceof WorkflowBlocked && depth === 1) {
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
      emitRuntimeEvent({
        type:
          err instanceof WorkflowInterrupted
            ? "workflow.interrupted"
            : err instanceof WorkflowBlocked
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
      throw err;
    }
  }

  /** Shared logic for both 'run' and 'resume' actions — sets up steering,
   *  executes the workflow, and maps the result to a tool response. */
  async function runOrResume(
    catalog: WorkflowCatalog,
    workflow: WorkflowModule,
    task: string,
    depth: number,
    parentSessionId: string | undefined,
    parentWorkflowRunId: string | undefined,
    previousRun?: WorkflowRun,
  ): Promise<WorkflowToolResult> {
    const completedSteps: CompletedStep[] = [];
    const steeringQueue: string[] = [];
    activeSteeringQueue = steeringQueue;
    activeWorkflowName = workflow.name;

    onEvent?.({ type: "workflow.started", workflow: workflow.name, task });

    try {
      const { result, runId } = await executeWorkflow(
        catalog,
        workflow,
        task,
        depth,
        parentSessionId,
        parentWorkflowRunId,
        completedSteps,
        steeringQueue,
        previousRun,
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
          steps: stepSummaries,
        };
        return toolResult;
      }

      onEvent?.({ type: "workflow.blocked", reason: result.reason });
      const toolResult: WorkflowToolResult = {
        type: "blocked",
        workflow: workflow.name,
        workflowRunId: runId,
        reason: result.reason,
        context: result.context,
        steps: stepSummaries,
      };
      return toolResult;
    } catch (err) {
      activeSteeringQueue = null;
      activeWorkflowName = null;

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
      const toolResult: WorkflowToolResult = { type: "error", workflow: workflow.name, error: msg };
      return toolResult;
    }
  }

  async function runTyped(name: string, task: string, existingCatalog?: WorkflowCatalog): Promise<WorkflowToolResult> {
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
    return runOrResume(catalog, workflow, task, 1, callerSessionId, callerMeta.workflowRunId);
  }

  const runner: WorkflowRunner = {
    run: runTyped,

    async resolve(name: string): Promise<WorkflowModule | null> {
      const catalog = await buildWorkflowCatalog(workflowDir);
      return findWorkflow(catalog, name).workflow;
    },

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
      "Results include workflowRunId — use subagents.trace(workflowRunId) to see the full session tree.",
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
          return textResult(JSON.stringify(result, null, 2));
        }

        case "run": {
          if (!params.name || !params.task) {
            return textResult(JSON.stringify({ type: "error", error: "action 'run' requires 'name' and 'task'" }));
          }

          const result = await runTyped(params.name, params.task, catalog);
          return textResult(JSON.stringify(result, null, 2));
        }

        case "resume": {
          if (!params.workflowRunId) {
            return workflowResumeError({
              reason: "action 'resume' requires 'workflowRunId'",
              category: "invalid_request",
            });
          }
          if (!persistDir) {
            return workflowResumeError({
              workflowRunId: params.workflowRunId,
              reason: "workflow resume requires persistDir",
              category: "invalid_request",
            });
          }

          const prevRunRecord = getWorkflowRun(persistDir, params.workflowRunId);
          if (!prevRunRecord) {
            return workflowResumeError({
              workflowRunId: params.workflowRunId,
              reason: `Workflow run "${params.workflowRunId}" not found`,
              category: "not_found",
            });
          }

          if (prevRunRecord.artifact_error) {
            return workflowResumeError({
              workflowRunId: params.workflowRunId,
              workflow: prevRunRecord.workflow,
              projectId: prevRunRecord.projectId ?? opts.projectId,
              reason: `Workflow run "${params.workflowRunId}" has incomplete persisted state: ${prevRunRecord.artifact_error}`,
              category: "corrupt_state",
            });
          }

          if (!prevRunRecord.workflow || !prevRunRecord.task || typeof prevRunRecord.depth !== "number") {
            return workflowResumeError({
              workflowRunId: params.workflowRunId,
              workflow: prevRunRecord.workflow,
              projectId: prevRunRecord.projectId ?? opts.projectId,
              reason: `Workflow run "${params.workflowRunId}" has incomplete persisted state`,
              category: "corrupt_state",
            });
          }

          // Reconstruct WorkflowRun with steps from sessions table
          const stepSessions = getWorkflowStepSessions(persistDir, params.workflowRunId);
          const prevRun: WorkflowRun = {
            runId: prevRunRecord.runId,
            workflow: prevRunRecord.workflow,
            task: prevRunRecord.task,
            parentSessionId: prevRunRecord.parentSessionId ?? "unknown",
            parentWorkflowRunId: prevRunRecord.parentWorkflowRunId ?? undefined,
            projectId: prevRunRecord.projectId ?? opts.projectId,
            depth: prevRunRecord.depth,
            startedAt: prevRunRecord.startedAt,
            endedAt: prevRunRecord.endedAt ?? undefined,
            status: prevRunRecord.status as WorkflowRun["status"],
            resumedFromRunId: prevRunRecord.resumedFromRunId ?? undefined,
            sourcePath: prevRunRecord.sourcePath ?? undefined,
            sourceScope: prevRunRecord.sourceScope ?? undefined,
            entryContentHash: prevRunRecord.entryContentHash ?? undefined,
            steps: stepSessions.map((s) => ({
              sessionId: s.sessionId,
              agent: s.agent,
              task: s.task,
              status: s.status === "done" || s.status === "error" || s.status === "interrupted" ? s.status : "done",
              startedAt: s.startedAt,
              endedAt: s.endedAt ?? Date.now(),
              lastAssistantText: s.outcome ?? null,
            })),
          };

          if (prevRun.status === "done") {
            emitWorkflowResumeSkipped({
              workflowRunId: prevRun.runId,
              workflow: prevRun.workflow,
              status: prevRun.status,
              projectId: prevRun.projectId,
              reason: "workflow already reached terminal status",
            });
            const result: WorkflowToolResult = {
              type: "done",
              workflow: prevRun.workflow,
              workflowRunId: prevRun.runId,
              summary: prevRunRecord.result_summary ?? "workflow already done",
              steps: buildStoredStepSummaries(prevRun.steps),
            };
            return textResult(JSON.stringify(result, null, 2));
          }

          if (prevRun.status === "blocked" || prevRun.status === "escalated") {
            emitWorkflowResumeSkipped({
              workflowRunId: prevRun.runId,
              workflow: prevRun.workflow,
              status: prevRun.status,
              projectId: prevRun.projectId,
              reason: "workflow already reached terminal status",
            });
            const result: WorkflowToolResult = {
              type: "blocked",
              workflow: prevRun.workflow,
              workflowRunId: prevRun.runId,
              reason: prevRunRecord.result_reason ?? "workflow already blocked",
              steps: buildStoredStepSummaries(prevRun.steps),
            };
            return textResult(JSON.stringify(result, null, 2));
          }

          const { workflow: resumeWf, error: resumeFindError } = findWorkflow(catalog, prevRun.workflow);
          if (!resumeWf) {
            return workflowResumeError({
              workflowRunId: prevRun.runId,
              workflow: prevRun.workflow,
              projectId: prevRun.projectId,
              reason: resumeFindError ?? `Workflow "${prevRun.workflow}" not found`,
              category: "workflow_definition_missing",
              recoverable: true,
            });
          }

          const result = await runOrResume(
            catalog,
            resumeWf,
            prevRun.task,
            prevRun.depth,
            prevRun.parentSessionId === "unknown" ? undefined : prevRun.parentSessionId,
            prevRun.parentWorkflowRunId,
            prevRun,
          );
          return textResult(JSON.stringify(result, null, 2));
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
