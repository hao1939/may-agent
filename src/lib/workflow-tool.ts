import { readdirSync } from "node:fs";
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
} from "./workflow.js";
import { WorkflowInterrupted } from "./workflow.js";
import type { WorkflowRun, WorkflowStep } from "./persistence.js";
import { saveWorkflowRun, readWorkflowRun } from "./persistence.js";
import { summarizeForHandoff } from "./handoff.js";

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

function buildStepSummaries(completedSteps: CompletedStep[]): WorkflowStepSummary[] {
  return completedSteps.map((step) => ({
    agent: step.step,
    sessionId: step.sessionId ?? "unknown",
    status: step.result.status,
    output: truncate(step.result.lastAssistantText ?? "(no output)", 2000),
    duration: step.result.duration,
  }));
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
  /** Persist directory for saving workflow run records. */
  persistDir?: string;
  /** The caller's session ID — used as parentSessionId for spawned sessions.
   *  Can be a string or a function returning a string (for lazy resolution). */
  callerSessionId?: string | (() => string);
  /** Maximum workflow nesting depth (default: 3). */
  maxDepth?: number;
  onEvent?: (event: WorkflowEvent) => void;
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

    const ctx: WorkflowContext = {
      task,

      runAgent: async (agentName: string, agentTask: string): Promise<TaskResult> => {
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

        const taskResult = await manager.callAgent(agentName, agentTask, {
          parentSessionId,
          workflowRunId: runId,
          stepLabel: agentName,
          source: "workflow",
        });

        const sid = taskResult.sessionId;

        const step: CompletedStep = { step: agentName, sessionId: sid, result: taskResult };
        localSteps.push(step);
        completedSteps.push(step);

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

        const steeringAfter = steeringQueue.shift();
        if (steeringAfter) {
          throw new WorkflowInterrupted(steeringAfter, completedSteps, runId);
        }

        return taskResult;
      },

      emit: (event: WorkflowEvent) => {
        onEvent?.(event);
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
