import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Type, StringEnum } from "@mariozechner/pi-ai";
import type { TSchema } from "@mariozechner/pi-ai";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
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
} from "./workflow.js";
import { WorkflowInterrupted, WorkflowBlocked } from "./workflow.js";
import type { WorkflowRun, WorkflowStep } from "./persistence.js";
import { saveWorkflowRun, readWorkflowRun } from "./persistence.js";
import { summarizeForHandoff } from "./handoff.js";
import { log } from "./log.js";
import type { RuntimeCtx } from "./handler-context.js";

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

let importCounter = 0;

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

function generateRunId(): string {
  return `wr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Max completed steps to keep full detail for. Older steps get trimmed to save memory. */
const MAX_DETAILED_STEPS = 20;

function buildStepSummaries(completedSteps: CompletedStep[]): WorkflowStepSummary[] {
  // For large step arrays, only include last MAX_DETAILED_STEPS in the returned result
  // to prevent context overflow when workflows run many iterations (e.g. persistent-task)
  const steps = completedSteps.length > MAX_DETAILED_STEPS
    ? completedSteps.slice(-MAX_DETAILED_STEPS)
    : completedSteps;
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

async function loadWorkflow(filePath: string): Promise<WorkflowModule> {
  const mod = await import(filePath + "?t=" + ++importCounter);
  if (typeof mod.name !== "string") {
    throw new Error(`Workflow file ${filePath} must export a 'name' string`);
  }
  if (typeof mod.execute !== "function") {
    throw new Error(`Workflow file ${filePath} must export an 'execute' function`);
  }
  return {
    name: mod.name,
    description: mod.description ?? "(no description)",
    execute: mod.execute,
  };
}

function listWorkflowFiles(workflowDir: string, sharedDir?: string): string[] {
  const files: string[] = [];
  // Agent-specific workflows first
  try {
    const agentFiles = readdirSync(workflowDir)
      .filter((f) => f.endsWith(".ts") && !f.includes("-helpers") && !f.includes("-utils"))
      .sort()
      .map((f) => join(workflowDir, f));
    files.push(...agentFiles);
  } catch {
    // workflowDir may not exist
  }
  // Shared workflows (agents/shared/workflows/) — only add if not already present by name
  if (sharedDir) {
    try {
      const agentNames = new Set(files.map((f) => f.split("/").pop()));
      const sharedFiles = readdirSync(sharedDir)
        .filter((f) => f.endsWith(".ts") && !f.includes("-helpers") && !f.includes("-utils") && !agentNames.has(f))
        .sort()
        .map((f) => join(sharedDir, f));
      files.push(...sharedFiles);
    } catch {
      // sharedDir may not exist
    }
  }
  return files;
}

async function findWorkflow(
  workflowDir: string,
  name: string,
  sharedDir?: string,
): Promise<{ workflow: WorkflowModule | null; error: string | null }> {
  const files = listWorkflowFiles(workflowDir, sharedDir);
  let loadError: string | null = null;

  for (const filePath of files) {
    try {
      const wf = await loadWorkflow(filePath);
      if (wf.name === name) {
        return { workflow: wf, error: null };
      }
    } catch (err) {
      loadError = err instanceof Error ? err.message : String(err);
    }
  }

  const error = loadError ? `Workflow "${name}" not found (load error: ${loadError})` : `Workflow "${name}" not found`;
  return { workflow: null, error };
}

// ── Guard Discovery ────────────────────────────────────────────────────

const MAX_INJECTION_DEPTH = 3;
const DEFAULT_MAX_INJECTED_STEPS = 5;

/** Load all guard modules from given directories. */
export async function loadGuards(...dirs: (string | undefined)[]): Promise<WorkflowGuard[]> {
  const guards: WorkflowGuard[] = [];
  const disabledNames = new Set(
    (process.env.DISABLED_GUARDS ?? "").split(",").map(s => s.trim()).filter(Boolean)
  );
  for (const dir of dirs) {
    if (!dir || !existsSync(dir)) continue;
    let files: string[];
    try {
      files = readdirSync(dir)
        .filter((f) => f.endsWith(".ts") && !f.startsWith("REGISTRY") && !f.endsWith(".disabled.ts"))
        .sort()
        .map((f) => join(dir, f));
    } catch {
      continue;
    }
    for (const filePath of files) {
      try {
        const mod = await import(filePath + "?t=" + ++importCounter);
        if (mod.guard && typeof mod.guard.handle === "function" && typeof mod.guard.name === "string") {
          if (disabledNames.has(mod.guard.name)) {
            log("info", `[guards] Skipping disabled guard "${mod.guard.name}" (DISABLED_GUARDS env)`);
            continue;
          }
          guards.push(mod.guard);
        }
      } catch (err) {
        log("error", `[guards] Failed to load guard from ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
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
      log("error", `[guards] Guard "${guard.name}" threw on event "${event.type}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return demands;
}

/** Resolve a list of demands: run injected steps, emit warnings, or block. */
async function resolveDemands(
  demands: Demand[],
  runId: string,
  completedSteps: CompletedStep[],
  steeringQueue: string[],
  injectedCount: { value: number },
  maxInjected: number,
  manager: SubagentManager,
  parentSessionId: string | undefined,
  onEvent: ((event: WorkflowEvent) => void) | undefined,
  run: WorkflowRun,
  persistDir: string | undefined,
  warnings: string[],
): Promise<void> {
  // Gap 3: Deduplicate run_step demands by label
  const seenRunStepLabels = new Set<string>();
  const dedupedDemands: Demand[] = [];
  for (const demand of demands) {
    if (demand.type === "run_step") {
      const label = demand.step?.label ?? demand.reason;
      if (seenRunStepLabels.has(label)) {
        log("info", `[guards] Deduplicating run_step demand with label "${label}" from "${demand.guardName}"`);
        continue;
      }
      seenRunStepLabels.add(label);
    }
    dedupedDemands.push(demand);
  }

  for (const demand of dedupedDemands) {
    switch (demand.type) {
      case "block":
        log("warn", `[guards] BLOCK from "${demand.guardName}": ${demand.reason}`);
        throw new WorkflowBlocked(demand.reason, completedSteps, runId);

      case "warn":
        log("warn", `[guards] WARNING from "${demand.guardName}": ${demand.reason}`);
        warnings.push(`${demand.reason} (from: ${demand.guardName})`);
        break;

      case "run_step": {
        if (!demand.step) {
          log("warn", `[guards] run_step demand from "${demand.guardName}" missing step config, skipping`);
          break;
        }
        if (injectedCount.value >= maxInjected) {
          log("warn", `[guards] Skipping injected step from "${demand.guardName}": limit ${maxInjected} reached`);
          break;
        }
        injectedCount.value++;
        const label = demand.step.label ?? `guard:${demand.guardName}`;
        log("info", `[guards] Injecting step "${label}" (${injectedCount.value}/${maxInjected}) from guard "${demand.guardName}"`);

        onEvent?.({ type: "step_start", step: label });

        const taskResult = await manager.callAgent(demand.step.agent, demand.step.task, {
          parentSessionId,
          workflowRunId: runId,
          stepLabel: label,
          source: "guard",
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
        if (persistDir) saveWorkflowRun(persistDir, run);

        onEvent?.({ type: "step_done", step: label, sessionId: taskResult.sessionId, result: taskResult });
        break;
      }
    }
  }
}

// ── WorkflowTool type ──────────────────────────────────────────────────

export interface WorkflowTool extends AgentTool {
  steer(message: string): boolean;
  readonly isRunning: boolean;
  readonly activeWorkflow: string | null;
}

// ── createWorkflowTool ─────────────────────────────────────────────────

export interface WorkflowToolOptions {
  manager: SubagentManager;
  workflowDir: string;
  /** Shared workflows directory (agents/shared/workflows/). Workflows here
   *  are available to all agents, but agent-specific workflows take priority
   *  if they share the same filename. */
  sharedWorkflowDir?: string;
  /** Agent-specific guards directory. */
  guardsDir?: string;
  /** Shared guards directory (agents/shared/guards/). */
  sharedGuardsDir?: string;
  /** Persist directory for saving workflow run records. */
  persistDir?: string;
  /** The caller's session ID — used as parentSessionId for spawned sessions.
   *  Can be a string or a function returning a string (for lazy resolution). */
  callerSessionId?: string | (() => string);
  /** The name of the agent that owns this workflow tool.
   *  Exposed as `ctx.agent` so shared workflows can delegate to the calling agent. */
  agentName?: string;
  /** Maximum workflow nesting depth (default: 3). */
  maxDepth?: number;
  /** Maximum guard-injected steps per workflow run (default: 5). */
  maxInjectedSteps?: number;
  onEvent?: (event: WorkflowEvent) => void;
  /** Pre-built RuntimeCtx — shared infra (emit, getDb, log, notify, paths). */
  runtimeCtx?: RuntimeCtx;
}

export function createWorkflowTool(opts: WorkflowToolOptions): WorkflowTool {
  const { manager, workflowDir, sharedWorkflowDir, persistDir, onEvent } = opts;
  const maxDepth = opts.maxDepth ?? 3;

  const resolveCallerSessionId = (): string | undefined => {
    const v = opts.callerSessionId;
    return typeof v === "function" ? v() : v;
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
    // Once we detect a mismatch (workflow code changed), stop replaying
    let replayExhausted = false;

    // Create the workflow run record
    const run: WorkflowRun = {
      runId,
      workflow: workflow.name,
      task,
      parentSessionId: parentSessionId ?? "unknown",
      parentWorkflowRunId,
      depth,
      startedAt: Date.now(),
      status: "running",
      steps: [],
      resumedFromRunId: previousRun?.runId,
    };
    if (persistDir) saveWorkflowRun(persistDir, run);

    // ── Load guards ────────────────────────────────────────────────────
    const guards = await loadGuards(opts.guardsDir, opts.sharedGuardsDir);
    const maxInjected = opts.maxInjectedSteps ?? DEFAULT_MAX_INJECTED_STEPS;
    const injectedStepCount = { value: 0 };
    const guardWarnings: string[] = [];

    if (guards.length > 0) {
      log("info", `[guards] Loaded ${guards.length} guard(s): ${guards.map(g => g.name).join(", ")}`);
      // Emit workflow_start to guards
      const startEvent: WorkflowGuardEvent = { type: "workflow_start", workflow: workflow.name, task };
      emitAndCollectDemands(guards, startEvent); // start events: collect but don't expect demands (logging only)
    }

    const ctx: WorkflowContext = {
      task,
      agent: (opts.agentName && opts.agentName !== "undefined") ? opts.agentName : "unknown",

      // ── RuntimeCtx (shared infra) — spread pre-built or fallback ──
      ...(opts.runtimeCtx ?? {
        emit: (event: { type: string; [key: string]: unknown }) => { onEvent?.(event as WorkflowEvent); },
        getDb: () => { throw new Error("No runtimeCtx — getDb unavailable"); },
        log: (_msg: string) => {},
        notify: (_msg: string) => {},
        persistDir: persistDir ?? "",
        projectRoot: "",
        agentsRoot: "",
      }),
      // Overlay emit to also call onEvent for workflow lifecycle logging
      emit: (event: { type: string; [key: string]: unknown }) => {
        opts.runtimeCtx?.emit(event);
        onEvent?.(event as WorkflowEvent);
      },

      runAgent: async (agentName: string, agentTask: string): Promise<TaskResult> => {
        // Defensive guard: catch undefined/null agent names before they reach manager.callAgent()
        // where they'd produce the confusing "Agent \"undefined\" not registered" error.
        // This can happen when workflows use ctx.agent on a binary compiled before the agent field was added.
        if (!agentName || typeof agentName !== "string" || agentName === "undefined" || agentName === "unknown") {
          throw new Error(
            `runAgent called with invalid agent name: ${JSON.stringify(agentName)}. ` +
            `If using ctx.agent, ensure the workflow tool was created with agentName option ` +
            `and that the binary has been restarted after deploy.`
          );
        }
        const currentStep = stepCounter++;

        // Replay: if we have a previous run with a completed step at this index,
        // return the archived result instead of spawning a new session.
        if (previousRun && !replayExhausted && currentStep < previousRun.steps.length) {
          const prevStep = previousRun.steps[currentStep];
          if (prevStep.agent === agentName) {
            // Agent matches — replay from archive
            try {
              const taskResult = manager.result(prevStep.sessionId);

              const step: CompletedStep = { step: agentName, sessionId: prevStep.sessionId, result: taskResult };
              localSteps.push(step);
              completedSteps.push(step);
              pruneCompletedSteps(completedSteps);

              // Record the replayed step in the new run
              const wfStep: WorkflowStep = {
                sessionId: prevStep.sessionId,
                agent: agentName,
                task: agentTask,
                status: taskResult.status,
                startedAt: prevStep.startedAt,
                endedAt: prevStep.endedAt,
                lastAssistantText: taskResult.lastAssistantText,
              };
              run.steps.push(wfStep);
              if (persistDir) saveWorkflowRun(persistDir, run);

              onEvent?.({ type: "step_done", step: agentName, sessionId: prevStep.sessionId, result: taskResult });
              return taskResult;
            } catch {
              // Archived data unavailable — fall through to live execution
              replayExhausted = true;
            }
          } else {
            // Agent name mismatch — workflow code changed, stop replaying
            replayExhausted = true;
          }
        }

        // Live execution
        const steering = steeringQueue.shift();
        if (steering) {
          throw new WorkflowInterrupted(steering, completedSteps, runId);
        }

        onEvent?.({ type: "step_start", step: agentName });

        // Gap 1: Inject accumulated guard warnings into the task
        let effectiveTask = agentTask;
        if (guardWarnings.length > 0) {
          effectiveTask += `\n\n## Guard Warnings\n${guardWarnings.map(w => "- " + w).join("\n")}`;
          guardWarnings.length = 0; // clear after delivery
        }

        const taskResult = await manager.callAgent(agentName, effectiveTask, {
          parentSessionId,
          workflowRunId: runId,
          stepLabel: agentName,
          source: "workflow",
        });

        const sid = taskResult.sessionId;

        const step: CompletedStep = { step: agentName, sessionId: sid, result: taskResult };
        localSteps.push(step);
        completedSteps.push(step);
        pruneCompletedSteps(completedSteps);

        // Persist step to the workflow run
        const wfStep: WorkflowStep = {
          sessionId: sid,
          agent: agentName,
          task: agentTask,
          status: taskResult.status,
          startedAt: taskResult.messages[0]?.timestamp ?? Date.now(),
          endedAt: Date.now(),
          lastAssistantText: taskResult.lastAssistantText,
        };
        run.steps.push(wfStep);
        if (persistDir) saveWorkflowRun(persistDir, run);

        onEvent?.({ type: "step_done", step: agentName, sessionId: sid, result: taskResult });

        // ── Guard: step_done event ────────────────────────────────────
        if (guards.length > 0) {
          const guardEvent: WorkflowGuardEvent = {
            type: "step_done",
            source: "agent",
            step: agentName,
            result: taskResult,
            completedSteps,
            task: agentTask,
          };
          const demands = emitAndCollectDemands(guards, guardEvent);
          if (demands.length > 0) {
            await resolveDemands(demands, runId, completedSteps, steeringQueue, injectedStepCount, maxInjected,
              manager, parentSessionId, onEvent, run, persistDir ?? undefined, guardWarnings);
          }
        }

        const steeringAfter = steeringQueue.shift();
        if (steeringAfter) {
          throw new WorkflowInterrupted(steeringAfter, completedSteps, runId);
        }

        return taskResult;
      },

      runFunction: async (label: string, fn: () => Promise<string>): Promise<TaskResult> => {
        const start = Date.now();
        onEvent?.({ type: "step_start", step: `fn:${label}` });

        let output: string;
        let hadError = false;
        let errorMsg: string | undefined;
        try {
          const timeout = 30_000;
          output = await Promise.race([
            fn(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`runFunction("${label}") timed out after ${timeout}ms`)), timeout),
            ),
          ]);
          // Truncate output to 50KB
          if (output.length > 50_000) {
            output = output.slice(0, 50_000) + "\n…(truncated)";
          }
        } catch (err) {
          hadError = true;
          errorMsg = err instanceof Error ? err.message : String(err);
          output = `ERROR: ${errorMsg}`;
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

        onEvent?.({ type: "step_done", step: `fn:${label}`, sessionId: taskResult.sessionId, result: taskResult });

        // Guard: step_done for function steps
        if (guards.length > 0) {
          const guardEvent: WorkflowGuardEvent = {
            type: "step_done",
            source: "function",
            step: label,
            result: taskResult,
            completedSteps,
            task: label,
          };
          const demands = emitAndCollectDemands(guards, guardEvent);
          if (demands.length > 0) {
            await resolveDemands(demands, runId, completedSteps, steeringQueue, injectedStepCount, maxInjected,
              manager, parentSessionId, onEvent, run, persistDir ?? undefined, guardWarnings);
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
          return { type: "escalate", reason: `Maximum workflow nesting depth (${maxDepth}) exceeded` };
        }

        const { workflow: subWf, error: subErr } = await findWorkflow(workflowDir, wfName, sharedWorkflowDir);
        if (!subWf) {
          return { type: "escalate", reason: subErr ?? `Workflow "${wfName}" not found` };
        }

        onEvent?.({ type: "workflow_start", workflow: subWf.name, task: wfTask });

        const sub = await executeWorkflow(
          subWf,
          wfTask,
          depth + 1,
          parentSessionId,
          runId,
          completedSteps,
          steeringQueue,
        );

        if (sub.result.type === "done") {
          onEvent?.({ type: "workflow_done", summary: sub.result.summary });
        } else {
          onEvent?.({ type: "workflow_escalate", reason: sub.result.reason });
        }

        return sub.result;
      },

      done: (summary: string) => ({ type: "done" as const, summary }),
      escalate: (reason: string, context?: unknown) => ({ type: "escalate" as const, reason, context }),
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
        await resolveDemands(demands, runId, completedSteps, steeringQueue, injectedStepCount, maxInjected,
          manager, parentSessionId, onEvent, run, persistDir ?? undefined, guardWarnings);
      }

      // Finalize the workflow run
      run.endedAt = Date.now();
      run.status = result.type === "done" ? "done" : "escalated";
      run.result = result.type === "done" ? { summary: result.summary } : { reason: result.reason };
      if (persistDir) saveWorkflowRun(persistDir, run);

      return { result, runId, steps: localSteps };
    } catch (err) {
      run.endedAt = Date.now();
      if (err instanceof WorkflowInterrupted) {
        run.status = "interrupted";
      } else if (err instanceof WorkflowBlocked) {
        run.status = "error";
        run.result = { reason: `Blocked by guard: ${err.reason}` };
      } else {
        run.status = "error";
        run.result = { reason: err instanceof Error ? err.message : String(err) };
      }
      if (persistDir) saveWorkflowRun(persistDir, run);
      throw err;
    }
  }

  /** Shared logic for both 'run' and 'resume' actions — sets up steering,
   *  executes the workflow, and maps the result to a tool response. */
  async function runOrResume(
    workflow: WorkflowModule,
    task: string,
    depth: number,
    parentSessionId: string | undefined,
    parentWorkflowRunId: string | undefined,
    previousRun?: WorkflowRun,
  ): ReturnType<WorkflowTool["execute"]> {
    const completedSteps: CompletedStep[] = [];
    const steeringQueue: string[] = [];
    activeSteeringQueue = steeringQueue;
    activeWorkflowName = workflow.name;

    onEvent?.({ type: "workflow_start", workflow: workflow.name, task });

    try {
      const { result, runId } = await executeWorkflow(
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
        onEvent?.({ type: "workflow_done", summary: result.summary });
        const toolResult: WorkflowToolResult = {
          type: "done",
          workflow: workflow.name,
          workflowRunId: runId,
          summary: result.summary,
          steps: stepSummaries,
        };
        return textResult(JSON.stringify(toolResult, null, 2));
      }

      onEvent?.({ type: "workflow_escalate", reason: result.reason });
      const toolResult: WorkflowToolResult = {
        type: "escalated",
        workflow: workflow.name,
        workflowRunId: runId,
        reason: result.reason,
        context: result.context,
        steps: stepSummaries,
      };
      return textResult(JSON.stringify(toolResult, null, 2));
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
        return textResult(JSON.stringify(toolResult, null, 2));
      }

      if (err instanceof WorkflowBlocked) {
        const toolResult: WorkflowToolResult = {
          type: "blocked",
          workflow: workflow.name,
          workflowRunId: err.workflowRunId,
          reason: err.reason,
          completedSteps: err.completedSteps,
        };
        return textResult(JSON.stringify(toolResult, null, 2));
      }

      const msg = err instanceof Error ? err.message : String(err);
      const toolResult: WorkflowToolResult = { type: "error", workflow: workflow.name, error: msg };
      return textResult(JSON.stringify(toolResult, null, 2));
    }
  }

  const tool: WorkflowTool = {
    name: "workflow",
    label: "Workflow",
    description:
      "List available workflows or run a workflow by name. " +
      "Workflows are predefined step sequences that coordinate sub-agents efficiently. " +
      "Use 'list' to see what's available, 'run' to execute one. " +
      "Results include workflowRunId — use subagents.trace(workflowRunId) to see the full session tree.",
    parameters: WorkflowToolParams,

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

    execute: async (_toolCallId, _params) => {
      const params = _params as WorkflowInput;
      switch (params.action) {
        case "list": {
          const files = listWorkflowFiles(workflowDir, sharedWorkflowDir);
          const workflows: Array<{ name: string; description: string }> = [];

          for (const filePath of files) {
            try {
              const wf = await loadWorkflow(filePath);
              workflows.push({ name: wf.name, description: wf.description });
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              workflows.push({ name: filePath, description: `(load error: ${msg})` });
            }
          }

          const result: WorkflowToolResult = { type: "list", workflows };
          return textResult(JSON.stringify(result, null, 2));
        }

        case "run": {
          if (!params.name || !params.task) {
            return textResult(JSON.stringify({ type: "error", error: "action 'run' requires 'name' and 'task'" }));
          }

          const { workflow, error: findError } = await findWorkflow(workflowDir, params.name, sharedWorkflowDir);
          if (!workflow) {
            return textResult(JSON.stringify({ type: "error", workflow: params.name, error: findError }));
          }

          return runOrResume(workflow, params.task, 1, resolveCallerSessionId(), undefined);
        }

        case "resume": {
          if (!params.workflowRunId) {
            return textResult(JSON.stringify({ type: "error", error: "action 'resume' requires 'workflowRunId'" }));
          }
          if (!persistDir) {
            return textResult(JSON.stringify({ type: "error", error: "workflow resume requires persistDir" }));
          }

          const prevRun = readWorkflowRun(persistDir, params.workflowRunId);
          if (!prevRun) {
            return textResult(
              JSON.stringify({ type: "error", error: `Workflow run "${params.workflowRunId}" not found` }),
            );
          }

          const { workflow: resumeWf, error: resumeFindError } = await findWorkflow(
            workflowDir,
            prevRun.workflow,
            sharedWorkflowDir,
          );
          if (!resumeWf) {
            return textResult(JSON.stringify({ type: "error", workflow: prevRun.workflow, error: resumeFindError }));
          }

          return runOrResume(
            resumeWf,
            prevRun.task,
            prevRun.depth,
            prevRun.parentSessionId,
            prevRun.parentWorkflowRunId,
            prevRun,
          );
        }

        default: {
          return textResult(JSON.stringify({ error: `Unknown action: ${params.action}` }));
        }
      }
    },
  };

  return tool;
}
